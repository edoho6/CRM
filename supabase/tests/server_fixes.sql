-- ============================================================================
--  Payment links from the desk (migration 20260919110000, server_fixes)
-- ============================================================================
--  Paste into the Supabase SQL editor after 78_server_fixes_to_run.sql.
--  Everything is rolled back at the end; your real data is never touched.
--
--    1. the secretary reads the two identifiers a payment page needs
--    2. never another clinic's, never the API key, and not while it is off
--    3. an anonymous caller cannot ask at all
-- ============================================================================

begin;

do $test$
declare
  v_clinic_a uuid;
  v_clinic_b uuid;
  v_desk     uuid := gen_random_uuid();
  v_row      record;
  v_count    integer;
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (v_desk, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'desk@payconfig.test', 'x', now(), '{}', '{}', now(), now());
  insert into public.clinics (name, slug) values ('Pay A', 'pay-config-a') returning id into v_clinic_a;
  insert into public.clinics (name, slug) values ('Pay B', 'pay-config-b') returning id into v_clinic_b;
  insert into public.memberships (clinic_id, user_id, role) values (v_clinic_a, v_desk, 'staff');
  insert into public.clinic_payment_settings (clinic_id, environment, grow_user_id, grow_page_code, grow_api_key, is_active)
  values (v_clinic_a, 'sandbox', 'user-a', 'page-a', 'secret-a', true),
         (v_clinic_b, 'sandbox', 'user-b', 'page-b', 'secret-b', true);

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_desk, 'role', 'authenticated')::text, true);

  -- 1 -----------------------------------------------------------------------
  select * into v_row from public.grow_payment_config();
  if v_row.grow_page_code is distinct from 'page-a' then
    raise exception 'FAIL 1: the secretary could not read her clinic''s payment page (%)', v_row.grow_page_code;
  end if;
  raise notice 'PASS 1: the desk can make a payment link';

  -- 2 -----------------------------------------------------------------------
  select count(*) into v_count from public.grow_payment_config() c where c.grow_page_code = 'page-b';
  if v_count <> 0 then raise exception 'FAIL 2: another clinic''s payment page was returned'; end if;
  if to_jsonb(v_row) ? 'grow_api_key' then raise exception 'FAIL 2: the API key left the table'; end if;
  select count(*) into v_count from public.clinic_payment_settings;
  if v_count <> 0 then raise exception 'FAIL 2: the settings table itself became readable to the secretary'; end if;
  perform set_config('role', 'postgres', true);
  update public.clinic_payment_settings set is_active = false where clinic_id = v_clinic_a;
  perform set_config('role', 'authenticated', true);
  select count(*) into v_count from public.grow_payment_config();
  if v_count <> 0 then raise exception 'FAIL 2: a switched-off payment page was still handed out'; end if;
  raise notice 'PASS 2: only this clinic''s, only the two identifiers, only while on';

  -- 3 -----------------------------------------------------------------------
  perform set_config('role', 'postgres', true);
  if has_function_privilege('anon', 'public.grow_payment_config()', 'execute') then
    raise exception 'FAIL 3: an anonymous caller may ask for payment identifiers';
  end if;
  raise notice 'PASS 3: anonymous callers cannot ask';

  raise notice 'ALL SERVER FIX CHECKS PASSED';
end;
$test$;

rollback;
