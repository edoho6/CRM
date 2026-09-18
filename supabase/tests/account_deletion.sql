-- ============================================================================
--  Account deletion — what goes, what stays, and who is refused
-- ============================================================================
--  Paste into the Supabase SQL editor after 32_account_deletion_to_run.sql.
--  Everything is rolled back at the end; your real data is never touched.
--
--  The promises being tested:
--    1. a patient's sign-in is deleted; the patient's file is not
--    2. a practitioner's sign-in is gone, the memberships are gone, the
--       treatment note still names them
--    3. a clinic's only owner, with patients on file, is refused — and the
--       clinic, the owner and the patients are all still there
--    4. a clinic's only owner with other members but no other owner is
--       refused, so the clinic is never left ownerless
--    5. the only owner of an empty clinic takes the clinic with them
--    6. the password door to the portal opens only in a synthetic clinic
-- ============================================================================

begin;

do $test$
declare
  v_clinic_a   uuid;
  v_clinic_b   uuid;
  v_clinic_c   uuid;
  v_owner_a    uuid := gen_random_uuid();
  v_doctor_a   uuid := gen_random_uuid();
  v_patient_u  uuid := gen_random_uuid();
  v_owner_b    uuid := gen_random_uuid();
  v_helper_b   uuid := gen_random_uuid();
  v_owner_c    uuid := gen_random_uuid();
  v_patient_a  uuid;
  v_note       uuid;
  v_result     jsonb;
  v_count      integer;
  v_text       text;
  v_bool       boolean;
begin
  -- ---- fixtures ------------------------------------------------------------
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  select u.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u.email, 'x', now(), '{}', '{}', now(), now()
    from (values
      (v_owner_a,   'owner-a@deletion.test'),
      (v_doctor_a,  'doctor-a@deletion.test'),
      (v_patient_u, 'patient@deletion.test'),
      (v_owner_b,   'owner-b@deletion.test'),
      (v_helper_b,  'helper-b@deletion.test'),
      (v_owner_c,   'owner-c@deletion.test')
    ) as u(id, email);
  insert into auth.identities (id, user_id, provider_id, provider, identity_data, created_at, updated_at, last_sign_in_at)
  select gen_random_uuid(), u.id, u.id::text, 'email', jsonb_build_object('sub', u.id::text), now(), now(), now()
    from (values (v_owner_a), (v_doctor_a), (v_patient_u), (v_owner_b), (v_helper_b), (v_owner_c)) as u(id);
  -- The profile trigger may or may not have run for these rows; make sure they exist.
  insert into public.profiles (id, full_name, phone)
  select u.id, u.name, '050-0000000'
    from (values
      (v_owner_a, 'Owner A'), (v_doctor_a, 'Doctor A'), (v_patient_u, 'Patient'),
      (v_owner_b, 'Owner B'), (v_helper_b, 'Helper B'), (v_owner_c, 'Owner C')
    ) as u(id, name)
  on conflict (id) do update set full_name = excluded.full_name, phone = excluded.phone;

  insert into public.clinics (name, slug) values ('Deletion test A', 'deletion-test-a') returning id into v_clinic_a;
  insert into public.clinics (name, slug) values ('Deletion test B', 'deletion-test-b') returning id into v_clinic_b;
  insert into public.clinics (name, slug) values ('Deletion test C', 'deletion-test-c') returning id into v_clinic_c;
  insert into public.memberships (clinic_id, user_id, role) values
    (v_clinic_a, v_owner_a, 'owner'),
    (v_clinic_a, v_doctor_a, 'practitioner'),
    (v_clinic_b, v_owner_b, 'owner'),
    (v_clinic_b, v_helper_b, 'staff'),
    (v_clinic_c, v_owner_c, 'owner');

  insert into public.patients (clinic_id, first_name, last_name)
  values (v_clinic_a, 'Test', 'Patient') returning id into v_patient_a;
  insert into public.patient_portal_access (clinic_id, patient_id, user_id, email, activated_at)
  values (v_clinic_a, v_patient_a, v_patient_u, 'patient@deletion.test', now());

  -- A note signed by the practitioner: the record that must keep its author.
  insert into public.encounters (clinic_id, patient_id, practitioner_id)
  values (v_clinic_a, v_patient_a, v_doctor_a) returning id into v_note;

  -- ---- 1 · the patient ------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', v_patient_u, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  v_result := public.request_account_deletion('moving abroad');
  perform set_config('role', 'postgres', true);
  if v_result ->> 'status' <> 'deleted' then
    raise exception 'FAIL 1: patient deletion returned %', v_result;
  end if;
  select count(*) into v_count from auth.users where id = v_patient_u;
  if v_count <> 0 then raise exception 'FAIL 1: the patient''s sign-in still exists'; end if;
  select count(*) into v_count from public.patients where id = v_patient_a;
  if v_count <> 1 then raise exception 'FAIL 1: the patient''s file was deleted with the sign-in'; end if;
  select count(*) into v_count from public.patient_portal_access where patient_id = v_patient_a and user_id is null and not is_active;
  if v_count <> 1 then raise exception 'FAIL 1: the portal invitation was not unlinked and closed'; end if;
  raise notice 'PASS 1: a patient''s sign-in goes, the file stays';

  -- ---- 2 · the practitioner ------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', v_doctor_a, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  v_result := public.request_account_deletion(null);
  perform set_config('role', 'postgres', true);
  if v_result ->> 'status' <> 'deleted' then
    raise exception 'FAIL 2: practitioner deletion returned %', v_result;
  end if;
  select count(*) into v_count from public.memberships where user_id = v_doctor_a;
  if v_count <> 0 then raise exception 'FAIL 2: memberships remain'; end if;
  select count(*) into v_count from auth.identities where user_id = v_doctor_a;
  if v_count <> 0 then raise exception 'FAIL 2: identities remain'; end if;
  select email into v_text from auth.users where id = v_doctor_a;
  if v_text not like 'deleted+%@deleted.invalid' then raise exception 'FAIL 2: the address was kept (%)', v_text; end if;
  select full_name into v_text from public.profiles where id = v_doctor_a;
  if v_text <> 'Doctor A' then raise exception 'FAIL 2: the professional name is gone from the tombstone'; end if;
  select phone into v_text from public.profiles where id = v_doctor_a;
  if v_text is not null then raise exception 'FAIL 2: the phone was kept'; end if;
  select practitioner_id::text into v_text from public.encounters where id = v_note;
  if v_text <> v_doctor_a::text then raise exception 'FAIL 2: the note lost its practitioner'; end if;
  raise notice 'PASS 2: a practitioner''s sign-in goes, the note keeps its author';

  -- ---- 3 · the only owner, with patients -----------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', v_owner_a, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  v_result := public.request_account_deletion('closing');
  perform set_config('role', 'postgres', true);
  if v_result ->> 'status' <> 'needs_review' or v_result ->> 'blocker' <> 'clinic_has_records' then
    raise exception 'FAIL 3: expected clinic_has_records, got %', v_result;
  end if;
  select count(*) into v_count from public.memberships where user_id = v_owner_a and role = 'owner' and is_active;
  if v_count <> 1 then raise exception 'FAIL 3: the owner lost the clinic'; end if;
  select email into v_text from auth.users where id = v_owner_a;
  if v_text <> 'owner-a@deletion.test' then raise exception 'FAIL 3: the owner''s sign-in was touched'; end if;
  select count(*) into v_count from public.account_deletion_requests where user_id = v_owner_a and status = 'needs_review' and email = 'owner-a@deletion.test';
  if v_count <> 1 then raise exception 'FAIL 3: the request was not kept for review'; end if;
  raise notice 'PASS 3: the only owner of a clinic with records is refused and recorded';

  -- ---- 4 · the only owner, other members, no patients ----------------------
  perform set_config('request.jwt.claims', json_build_object('sub', v_owner_b, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  v_result := public.request_account_deletion(null);
  perform set_config('role', 'postgres', true);
  if v_result ->> 'status' <> 'needs_review' or v_result ->> 'blocker' <> 'clinic_needs_owner' then
    raise exception 'FAIL 4: expected clinic_needs_owner, got %', v_result;
  end if;
  select count(*) into v_count from public.memberships where clinic_id = v_clinic_b and role = 'owner' and is_active;
  if v_count <> 1 then raise exception 'FAIL 4: clinic B lost its owner'; end if;
  raise notice 'PASS 4: an owner cannot leave members behind without an owner';

  -- ---- 5 · the only owner of an empty clinic -------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', v_owner_c, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  v_result := public.request_account_deletion(null);
  perform set_config('role', 'postgres', true);
  if v_result ->> 'status' <> 'deleted' then
    raise exception 'FAIL 5: expected deleted, got %', v_result;
  end if;
  select count(*) into v_count from public.clinics where id = v_clinic_c;
  if v_count <> 0 then raise exception 'FAIL 5: the empty clinic remains'; end if;
  select email into v_text from auth.users where id = v_owner_c;
  if v_text not like 'deleted+%' then raise exception 'FAIL 5: the owner''s sign-in remains'; end if;
  raise notice 'PASS 5: an empty clinic closes with its only owner';

  -- ---- 6 · the reviewers'' door -----------------------------------------------
  -- Owner B is not a portal user: the door is closed to staff.
  perform set_config('request.jwt.claims', json_build_object('sub', v_owner_b, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  v_bool := public.portal_password_login_allowed();
  perform set_config('role', 'postgres', true);
  if v_bool then raise exception 'FAIL 6: a member of staff passed the portal door'; end if;
  -- A portal user of a real clinic: closed.
  update public.patient_portal_access
     set user_id = v_helper_b, is_active = true, email = 'helper-b@deletion.test'
   where patient_id = v_patient_a;
  perform set_config('request.jwt.claims', json_build_object('sub', v_helper_b, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  v_bool := public.portal_password_login_allowed();
  perform set_config('role', 'postgres', true);
  if v_bool then raise exception 'FAIL 6: a real clinic''s patient passed the portal door'; end if;
  -- The same person once the clinic is synthetic: open.
  update public.clinics set is_synthetic = true where id = v_clinic_a;
  perform set_config('request.jwt.claims', json_build_object('sub', v_helper_b, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  v_bool := public.portal_password_login_allowed();
  perform set_config('role', 'postgres', true);
  if not v_bool then raise exception 'FAIL 6: the sandbox clinic''s patient was refused the door'; end if;
  raise notice 'PASS 6: the password door opens only in a synthetic clinic';

  raise notice 'ALL ACCOUNT DELETION CHECKS PASSED';
end;
$test$;

rollback;
