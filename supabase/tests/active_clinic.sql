-- ============================================================================
--  A practitioner in two clinics (migration 76)
-- ============================================================================
--  Paste into the Supabase SQL editor after 70_active_clinic_to_run.sql.
--  Everything is rolled back at the end; your real data is never touched.
--
--  The promises being tested:
--    1. with no choice made, the oldest membership is still the clinic
--    2. switching changes what current_clinic_id() — and so every policy — answers
--    3. the switch refuses a clinic this person is not a member of, and changes nothing
--    4. the context names the clinic switched to, and lists both clinics
--    5. the table itself cannot be written from outside the function
--    6. a member of one clinic is listed once and keeps that clinic
-- ============================================================================

begin;

do $test$
declare
  v_clinic_a uuid;
  v_clinic_b uuid;
  v_clinic_c uuid;
  v_both     uuid := gen_random_uuid();
  v_one      uuid := gen_random_uuid();
  v_context  jsonb;
  v_count    integer;
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  select u.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u.email, 'x', now(), '{}', '{}', now(), now()
    from (values (v_both, 'both@active.test'), (v_one, 'one@active.test')) as u(id, email);
  insert into public.profiles (id, full_name) values (v_both, 'Two clinics'), (v_one, 'One clinic') on conflict (id) do nothing;
  insert into public.clinics (name, slug) values ('Active A', 'active-a') returning id into v_clinic_a;
  insert into public.clinics (name, slug) values ('Active B', 'active-b') returning id into v_clinic_b;
  insert into public.clinics (name, slug) values ('Active C', 'active-c') returning id into v_clinic_c;
  -- The oldest membership first, so "oldest" is a fact and not the row order.
  insert into public.memberships (clinic_id, user_id, role, created_at) values (v_clinic_a, v_both, 'practitioner', now() - interval '1 year');
  insert into public.memberships (clinic_id, user_id, role, created_at) values (v_clinic_b, v_both, 'owner', now());
  insert into public.memberships (clinic_id, user_id, role) values (v_clinic_a, v_one, 'owner');

  perform set_config('request.jwt.claims', json_build_object('sub', v_both, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  if public.current_clinic_id() is distinct from v_clinic_a then
    raise exception 'FAIL 1: with no choice made the clinic was %, expected the oldest membership', public.current_clinic_id();
  end if;
  raise notice 'PASS 1: no choice made, the oldest membership answers';

  if not public.set_active_clinic(v_clinic_b) then raise exception 'FAIL 2: the switch refused a clinic this person belongs to'; end if;
  if public.current_clinic_id() is distinct from v_clinic_b then
    raise exception 'FAIL 2: after switching the clinic was %, expected %', public.current_clinic_id(), v_clinic_b;
  end if;
  raise notice 'PASS 2: switching changes the clinic every policy reads';

  if public.set_active_clinic(v_clinic_c) then raise exception 'FAIL 3: the switch accepted a clinic this person is not a member of'; end if;
  if public.current_clinic_id() is distinct from v_clinic_b then
    raise exception 'FAIL 3: the refused switch changed the clinic to %', public.current_clinic_id();
  end if;
  raise notice 'PASS 3: a clinic without a membership is refused, and nothing changes';

  v_context := public.current_membership_context();
  if (v_context -> 'clinic' ->> 'id')::uuid is distinct from v_clinic_b then
    raise exception 'FAIL 4: the context named clinic %, expected %', v_context -> 'clinic' ->> 'id', v_clinic_b;
  end if;
  if (v_context -> 'membership' ->> 'role') <> 'owner' then
    raise exception 'FAIL 4: the context carried the other clinic''s membership (role %)', v_context -> 'membership' ->> 'role';
  end if;
  if jsonb_array_length(v_context -> 'clinics') <> 2 then
    raise exception 'FAIL 4: the context listed % clinic(s), expected 2', jsonb_array_length(v_context -> 'clinics');
  end if;
  raise notice 'PASS 4: the context follows the switch and lists both clinics';

  begin
    insert into public.active_clinic (user_id, clinic_id) values (v_both, v_clinic_c);
    raise exception 'FAIL 5: the table was written from outside the function';
  exception
    when insufficient_privilege then null;
  end;
  begin
    update public.active_clinic set clinic_id = v_clinic_c where user_id = v_both;
    if public.current_clinic_id() is distinct from v_clinic_b then
      raise exception 'FAIL 5: an update from outside the function moved the clinic';
    end if;
  exception
    when insufficient_privilege then null;
  end;
  raise notice 'PASS 5: only the function writes the choice';

  perform set_config('request.jwt.claims', json_build_object('sub', v_one, 'role', 'authenticated')::text, true);
  v_context := public.current_membership_context();
  if jsonb_array_length(v_context -> 'clinics') <> 1 or (v_context -> 'clinic' ->> 'id')::uuid is distinct from v_clinic_a then
    raise exception 'FAIL 6: a member of one clinic saw %', v_context -> 'clinics';
  end if;
  raise notice 'PASS 6: one membership, one clinic, no switcher';

  raise notice 'ALL ACTIVE CLINIC CHECKS PASSED';
end;
$test$;

rollback;
