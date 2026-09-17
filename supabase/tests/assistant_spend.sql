-- ============================================================================
--  The ceiling on questions about the data (migration 77)
-- ============================================================================
--  Paste into the Supabase SQL editor after 71_model_spend_to_run.sql.
--  Everything is rolled back at the end; your real data is never touched.
--
--  The promises being tested:
--    1. the log counts only this person's answered questions, in this clinic
--    2. a member of another clinic cannot read the rows
--    3. the table is not writable from outside the function
--    4. an anonymous caller reaches neither function
--    5. the library's log keeps cache writes and cache reads apart
-- ============================================================================

begin;

do $test$
declare
  v_clinic_a uuid;
  v_clinic_b uuid;
  v_asker    uuid := gen_random_uuid();
  v_other    uuid := gen_random_uuid();
  v_seen     integer;
  v_row      record;
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  select u.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u.email, 'x', now(), '{}', '{}', now(), now()
    from (values (v_asker, 'asker@spend.test'), (v_other, 'other@spend.test')) as u(id, email);
  insert into public.profiles (id, full_name) values (v_asker, 'Asker'), (v_other, 'Other') on conflict (id) do nothing;
  insert into public.clinics (name, slug) values ('Spend A', 'spend-a') returning id into v_clinic_a;
  insert into public.clinics (name, slug) values ('Spend B', 'spend-b') returning id into v_clinic_b;
  insert into public.memberships (clinic_id, user_id, role) values (v_clinic_a, v_asker, 'owner');
  insert into public.memberships (clinic_id, user_id, role) values (v_clinic_b, v_other, 'owner');

  perform set_config('request.jwt.claims', json_build_object('sub', v_asker, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  if public.assistant_questions_today() <> 0 then
    raise exception 'FAIL 1: a person who has asked nothing was counted at %', public.assistant_questions_today();
  end if;
  perform public.assistant_log_query('answered', 'claude-sonnet-5', 120, 2400, 2400, 80, 900);
  perform public.assistant_log_query('answered', 'claude-sonnet-5', 120, 0, 2400, 80, 700);
  -- A refusal costs nothing and must not count against the day.
  perform public.assistant_log_query('refused_quota', null, 0, 0, 0, 0, 5);
  if public.assistant_questions_today() <> 2 then
    raise exception 'FAIL 1: two answered questions counted as %', public.assistant_questions_today();
  end if;
  raise notice 'PASS 1: answered questions count, refusals do not';

  select * into v_row from public.assistant_queries where cache_write_tokens = 2400 limit 1;
  if v_row.cache_read_tokens is distinct from 2400 or v_row.input_tokens is distinct from 120 then
    raise exception 'FAIL 1: the four token counts did not survive the write';
  end if;

  perform set_config('request.jwt.claims', json_build_object('sub', v_other, 'role', 'authenticated')::text, true);
  select count(*) into v_seen from public.assistant_queries;
  if v_seen <> 0 then
    raise exception 'FAIL 2: another clinic read % row(s) of questions', v_seen;
  end if;
  if public.assistant_questions_today() <> 0 then
    raise exception 'FAIL 2: another clinic''s count leaked';
  end if;
  raise notice 'PASS 2: the rows stay in the clinic that asked';

  begin
    insert into public.assistant_queries (user_id, clinic_id, status) values (v_other, v_clinic_b, 'answered');
    raise exception 'FAIL 3: the table was written from outside the function';
  exception
    when insufficient_privilege then null;
  end;
  raise notice 'PASS 3: only the function writes the log';

  perform set_config('request.jwt.claims', json_build_object('sub', null, 'role', 'anon')::text, true);
  perform set_config('role', 'anon', true);
  begin
    perform public.assistant_questions_today();
    raise exception 'FAIL 4: an anonymous caller read the count';
  exception
    when insufficient_privilege then null;
  end;
  begin
    perform public.assistant_log_query('answered', 'claude-sonnet-5', 1, 1, 1, 1, 1);
    raise exception 'FAIL 4: an anonymous caller wrote to the log';
  exception
    when insufficient_privilege then null;
  end;
  raise notice 'PASS 4: neither function is open to anyone signed out';

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_asker, 'role', 'authenticated')::text, true);
  perform public.library_log_query('answered', '[]'::jsonb, 'claude-sonnet-5', 300, 9000, 14000, 1200, 30000);
  select * into v_row from public.library_queries where user_id = v_asker limit 1;
  if v_row.cache_write_tokens is distinct from 9000 or v_row.cache_read_tokens is distinct from 14000 then
    raise exception 'FAIL 5: the library''s log lost the cache split';
  end if;
  raise notice 'PASS 5: the library tells a cache write from a cache read';

  raise notice 'ALL MODEL SPEND CHECKS PASSED';
end;
$test$;

rollback;
