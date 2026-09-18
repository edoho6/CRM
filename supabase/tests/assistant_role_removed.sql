-- ============================================================================
--  The `assistant` membership role is gone (migration 20260919091000)
-- ============================================================================
--  Paste into the Supabase SQL editor after 75_remove_assistant_role_to_run.sql.
--  Everything is rolled back at the end; your real data is never touched.
--
--  The promises being tested — the role cannot come back by any door:
--    1. not by the owner's role switch
--    2. not by an invitation
--    3. not by a direct write, even the database owner's
--    4. the three remaining roles still work
-- ============================================================================

begin;

do $test$
declare
  v_clinic  uuid;
  v_owner   uuid := gen_random_uuid();
  v_member  uuid := gen_random_uuid();
  v_row     uuid;
  v_ok      boolean;
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  select u.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u.email, 'x', now(), '{}', '{}', now(), now()
    from (values (v_owner, 'owner@roles.test'), (v_member, 'member@roles.test')) as u(id, email);
  insert into public.clinics (name, slug) values ('Roles', 'roles-test') returning id into v_clinic;
  insert into public.memberships (clinic_id, user_id, role) values (v_clinic, v_owner, 'owner');
  insert into public.memberships (clinic_id, user_id, role) values (v_clinic, v_member, 'staff') returning id into v_row;

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_owner, 'role', 'authenticated')::text, true);

  -- 1 -------------------------------------------------------------------------
  v_ok := false;
  begin
    perform public.set_membership_role(v_row, 'assistant');
  exception when others then v_ok := true;
  end;
  if not v_ok then raise exception 'FAIL 1: the role switch gave out the removed role'; end if;
  raise notice 'PASS 1: not by the role switch';

  -- 2 -------------------------------------------------------------------------
  v_ok := false;
  begin
    insert into public.clinic_invitations (clinic_id, role, invitee_name, invited_by)
    values (v_clinic, 'assistant', 'Someone', v_owner);
  exception when others then v_ok := true;
  end;
  if not v_ok then raise exception 'FAIL 2: an invitation carried the removed role'; end if;
  raise notice 'PASS 2: not by an invitation';

  -- 4 -------------------------------------------------------------------------
  perform public.set_membership_role(v_row, 'practitioner');
  perform public.set_membership_role(v_row, 'staff');
  insert into public.clinic_invitations (clinic_id, role, invitee_name, invited_by)
  values (v_clinic, 'practitioner', 'Someone', v_owner);
  raise notice 'PASS 4: the three roles remain';

  -- 3 -------------------------------------------------------------------------
  perform set_config('role', 'postgres', true);
  v_ok := false;
  begin
    update public.memberships set role = 'assistant' where id = v_row;
  exception when check_violation then v_ok := true;
  end;
  if not v_ok then raise exception 'FAIL 3: a direct write stored the removed role'; end if;
  raise notice 'PASS 3: not by a direct write';

  raise notice 'ALL ROLE REMOVAL CHECKS PASSED';
end;
$test$;

rollback;
