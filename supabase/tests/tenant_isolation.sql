-- ============================================================================
--  Tenant isolation — proving the policies, not just reading them
-- ============================================================================
--  Paste into the Supabase SQL editor and run. It builds two throwaway clinics
--  with a patient each plus a portal patient, impersonates each identity in turn,
--  and asserts that everything belonging to anyone else is invisible.
--
--  Everything is rolled back at the end, so it leaves no trace whatever the
--  result. Your real data is never touched: the fixtures live and die inside the
--  transaction.
--
--  A pass ends with ALL TENANT ISOLATION CHECKS PASSED in the Messages/Notices
--  pane. A failure aborts with a message naming exactly what leaked.
--
--  Why this file exists: Row Level Security is the whole of the isolation story.
--  Reading the policies and agreeing with them is not the same as proving that a
--  query run as one clinic returns nothing belonging to another — and the gap
--  between those two things is precisely where this class of bug lives. Re-run it
--  after any migration that adds a table or touches a policy.
-- ============================================================================

begin;

do $test$
declare
  v_clinic_a   uuid;
  v_clinic_b   uuid;
  v_user_a     uuid := gen_random_uuid();  -- owner of clinic A
  v_user_b     uuid := gen_random_uuid();  -- owner of clinic B
  v_user_p     uuid := gen_random_uuid();  -- portal patient, linked to A's patient
  v_patient_a  uuid;
  v_patient_b  uuid;
  v_encounter  uuid;
  v_doc_shared uuid;
  v_doc_private uuid;
  v_count      integer;
begin
  -- ==========================================================================
  -- Fixtures — created as the session role, which owns the tables and so is
  -- not subject to RLS. That is the point: the setup must be able to write
  -- rows the tests will then try, and fail, to reach.
  -- ==========================================================================
  raise notice '--- fixtures ---';

  insert into public.clinics (name, slug)
  values ('Isolation Test A', 'iso-a-' || gen_random_uuid())
  returning id into v_clinic_a;

  insert into public.clinics (name, slug)
  values ('Isolation Test B', 'iso-b-' || gen_random_uuid())
  returning id into v_clinic_b;

  -- profiles references auth.users, so the fixture identities must exist there
  -- first. The on_auth_user_created trigger fills public.profiles for us.
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                          email_confirmed_at, created_at, updated_at)
  values
    (v_user_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'iso-a-' || v_user_a || '@example.test', '', now(), now(), now()),
    (v_user_b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'iso-b-' || v_user_b || '@example.test', '', now(), now(), now()),
    (v_user_p, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'iso-p-' || v_user_p || '@example.test', '', now(), now(), now());

  insert into public.memberships (clinic_id, user_id, role, is_active)
  values (v_clinic_a, v_user_a, 'owner', true),
         (v_clinic_b, v_user_b, 'owner', true);

  insert into public.patients (clinic_id, first_name, last_name)
  values (v_clinic_a, 'Alice', 'ClinicA') returning id into v_patient_a;

  insert into public.patients (clinic_id, first_name, last_name)
  values (v_clinic_b, 'Bob', 'ClinicB') returning id into v_patient_b;

  insert into public.patient_medical_history (clinic_id, patient_id, allergies)
  values (v_clinic_a, v_patient_a, 'Isolation test allergy');

  insert into public.herbs (clinic_id, pinyin_name) values (v_clinic_a, 'Iso Test Herb A');
  insert into public.herbs (clinic_id, pinyin_name) values (v_clinic_b, 'Iso Test Herb B');

  insert into public.encounters (clinic_id, patient_id, practitioner_id)
  values (v_clinic_a, v_patient_a, v_user_a) returning id into v_encounter;

  insert into public.tcm_notes (clinic_id, encounter_id, chief_complaint)
  values (v_clinic_a, v_encounter, 'Isolation test note');

  insert into public.patient_documents (clinic_id, patient_id, file_path, file_name, shared_with_patient)
  values (v_clinic_a, v_patient_a, v_clinic_a || '/' || v_patient_a || '/shared.pdf', 'shared.pdf', true)
  returning id into v_doc_shared;

  insert into public.patient_documents (clinic_id, patient_id, file_path, file_name, shared_with_patient)
  values (v_clinic_a, v_patient_a, v_clinic_a || '/' || v_patient_a || '/private.pdf', 'private.pdf', false)
  returning id into v_doc_private;

  -- The portal patient: an auth user with no membership, linked to A's patient.
  insert into public.patient_portal_access (clinic_id, patient_id, user_id, email, activated_at)
  values (v_clinic_a, v_patient_a, v_user_p, 'iso-p-' || v_user_p || '@example.test', now());

  raise notice 'clinic A = %', v_clinic_a;
  raise notice 'clinic B = %', v_clinic_b;

  -- ==========================================================================
  -- Identity 1 · clinic A's owner
  -- ==========================================================================
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_user_a, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  raise notice '--- as clinic A ---';

  -- The helper resolves from the membership, not from anything the caller sends.
  if public.current_clinic_id() is distinct from v_clinic_a then
    raise exception 'FAIL: current_clinic_id() returned %, expected %',
      public.current_clinic_id(), v_clinic_a;
  end if;
  raise notice 'ok   current_clinic_id resolves from the membership';

  select count(*) into v_count from public.patients where id = v_patient_a;
  if v_count <> 1 then raise exception 'FAIL: clinic A cannot read its own patient'; end if;

  select count(*) into v_count from public.patients where id = v_patient_b;
  if v_count <> 0 then raise exception 'FAIL: clinic A read clinic B patients (% rows)', v_count; end if;
  raise notice 'ok   patients isolated';

  -- The shape a forgotten WHERE clause takes: an unfiltered scan of the table.
  select count(*) into v_count from public.patients where clinic_id = v_clinic_b;
  if v_count <> 0 then raise exception 'FAIL: an unfiltered patients scan reached clinic B'; end if;
  raise notice 'ok   an unfiltered scan returns nothing from the other clinic';

  select count(*) into v_count from public.patient_medical_history where clinic_id = v_clinic_b;
  if v_count <> 0 then raise exception 'FAIL: medical history leaked across clinics'; end if;

  select count(*) into v_count from public.tcm_notes where clinic_id = v_clinic_b;
  if v_count <> 0 then raise exception 'FAIL: clinical notes leaked across clinics'; end if;
  raise notice 'ok   medical history and clinical notes isolated';

  -- The reference catalogue is clinic-scoped too — herbs are not a global table.
  select count(*) into v_count from public.herbs where clinic_id = v_clinic_b;
  if v_count <> 0 then raise exception 'FAIL: herb catalogue leaked across clinics'; end if;
  raise notice 'ok   herb catalogue isolated';

  -- Views are declared security_invoker, so they must inherit the caller's policies
  -- rather than running with the rights of whoever created them.
  select count(*) into v_count from public.herb_stock_levels where clinic_id = v_clinic_b;
  if v_count <> 0 then raise exception 'FAIL: herb_stock_levels bypassed RLS'; end if;

  select count(*) into v_count from public.access_activity where clinic_id = v_clinic_b;
  if v_count <> 0 then raise exception 'FAIL: access_activity bypassed RLS'; end if;
  raise notice 'ok   views inherit the caller''s policies';

  -- Writing into another clinic must be refused outright, not silently redirected
  -- into the caller's own clinic.
  begin
    insert into public.patients (clinic_id, first_name, last_name)
    values (v_clinic_b, 'Injected', 'Row');
    raise exception 'FAIL: clinic A inserted a patient into clinic B';
  exception
    when insufficient_privilege then
      raise notice 'ok   cross-clinic insert refused';
  end;

  update public.patients set city = 'Injected' where id = v_patient_b;
  get diagnostics v_count = row_count;
  if v_count <> 0 then
    raise exception 'FAIL: clinic A updated % row(s) belonging to clinic B', v_count;
  end if;
  raise notice 'ok   cross-clinic update affects no rows';

  delete from public.patients where id = v_patient_b;
  get diagnostics v_count = row_count;
  if v_count <> 0 then
    raise exception 'FAIL: clinic A deleted % row(s) belonging to clinic B', v_count;
  end if;
  raise notice 'ok   cross-clinic delete affects no rows';

  -- The audit trail is written by SECURITY DEFINER triggers and by
  -- log_record_access(). Nothing else may write to it, or it proves nothing.
  begin
    insert into public.audit_log (clinic_id, table_name, record_id, action)
    values (v_clinic_a, 'patients', v_patient_a, 'view');
    raise exception 'FAIL: audit_log accepted a hand-written entry';
  exception
    when insufficient_privilege then
      raise notice 'ok   audit_log rejects a forged entry';
  end;

  -- An existing audit row must not be editable, in any clinic.
  update public.audit_log set action = 'insert' where clinic_id = v_clinic_a;
  get diagnostics v_count = row_count;
  if v_count <> 0 then
    raise exception 'FAIL: % audit row(s) were rewritten', v_count;
  end if;
  delete from public.audit_log where clinic_id = v_clinic_a;
  get diagnostics v_count = row_count;
  if v_count <> 0 then
    raise exception 'FAIL: % audit row(s) were deleted', v_count;
  end if;
  raise notice 'ok   audit_log is append-only in practice, not just by intent';

  -- ==========================================================================
  -- Identity 2 · clinic B's owner — the mirror image
  -- ==========================================================================
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_user_b, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  raise notice '--- as clinic B ---';

  select count(*) into v_count from public.patients where id = v_patient_b;
  if v_count <> 1 then raise exception 'FAIL: clinic B cannot read its own patient'; end if;

  select count(*) into v_count from public.patients where id = v_patient_a;
  if v_count <> 0 then raise exception 'FAIL: clinic B read clinic A patients'; end if;

  select count(*) into v_count from public.tcm_notes;
  if v_count <> 0 then raise exception 'FAIL: clinic B read % clinical note(s)', v_count; end if;
  raise notice 'ok   isolation holds in both directions';

  -- ==========================================================================
  -- Identity 3 · the portal patient
  -- ==========================================================================
  -- This is the boundary that matters most in day-to-day use: a patient signs in
  -- to the portal as a real auth user, holds no membership, and must see their own
  -- appointments and shared files and absolutely nothing clinical.
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_user_p, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  raise notice '--- as the portal patient ---';

  if public.current_patient_id() is distinct from v_patient_a then
    raise exception 'FAIL: current_patient_id() returned %, expected %',
      public.current_patient_id(), v_patient_a;
  end if;

  if public.current_clinic_id() is not null then
    raise exception 'FAIL: a portal patient resolved a clinic membership (%)',
      public.current_clinic_id();
  end if;
  raise notice 'ok   portal identity resolves to a patient and to no clinic';

  select count(*) into v_count from public.patients where id = v_patient_a;
  if v_count <> 1 then raise exception 'FAIL: the portal patient cannot read their own file'; end if;

  select count(*) into v_count from public.patients where id = v_patient_b;
  if v_count <> 0 then raise exception 'FAIL: the portal patient read another patient''s file'; end if;
  raise notice 'ok   the portal patient sees only their own record';

  -- The headline safety property: no policy on tcm_notes mentions patients at all.
  select count(*) into v_count from public.tcm_notes;
  if v_count <> 0 then
    raise exception 'FAIL: the portal patient read % clinical note(s)', v_count;
  end if;

  select count(*) into v_count from public.patient_medical_history;
  if v_count <> 0 then
    raise exception 'FAIL: the portal patient read their own medical history table';
  end if;

  select count(*) into v_count from public.encounters;
  if v_count <> 0 then
    raise exception 'FAIL: the portal patient read % encounter(s)', v_count;
  end if;

  select count(*) into v_count from public.herbs;
  if v_count <> 0 then
    raise exception 'FAIL: the portal patient read the herb catalogue';
  end if;

  select count(*) into v_count from public.audit_log;
  if v_count <> 0 then
    raise exception 'FAIL: the portal patient read the audit log';
  end if;
  raise notice 'ok   clinical records, encounters, catalogue and audit log are unreachable';

  -- Sharing is a deliberate act, so an unshared document must stay invisible.
  select count(*) into v_count from public.patient_documents where id = v_doc_shared;
  if v_count <> 1 then raise exception 'FAIL: a shared document was not visible to the patient'; end if;

  select count(*) into v_count from public.patient_documents where id = v_doc_private;
  if v_count <> 0 then raise exception 'FAIL: an unshared document was visible to the patient'; end if;
  raise notice 'ok   only documents explicitly shared reach the portal';

  -- A patient may read, never write.
  begin
    update public.patients set city = 'Self-edited' where id = v_patient_a;
    get diagnostics v_count = row_count;
    if v_count <> 0 then
      raise exception 'FAIL: the portal patient edited their own record (% row(s))', v_count;
    end if;
    raise notice 'ok   the portal patient cannot write to their record';
  exception
    when insufficient_privilege then
      raise notice 'ok   the portal patient cannot write to their record';
  end;

  -- ==========================================================================
  -- Identity 4 · no session at all
  -- ==========================================================================
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
  perform set_config('role', 'anon', true);

  raise notice '--- as an anonymous caller ---';

  select count(*) into v_count from public.patients;
  if v_count <> 0 then raise exception 'FAIL: anonymous read returned % patient row(s)', v_count; end if;

  select count(*) into v_count from public.tcm_notes;
  if v_count <> 0 then raise exception 'FAIL: anonymous read returned % clinical note(s)', v_count; end if;

  select count(*) into v_count from public.clinics;
  if v_count <> 0 then raise exception 'FAIL: anonymous read returned % clinic row(s)', v_count; end if;
  raise notice 'ok   anonymous callers see nothing';

  perform set_config('role', 'postgres', true);
  raise notice ' ';
  raise notice 'ALL TENANT ISOLATION CHECKS PASSED';
end
$test$;

-- Nothing above is kept. The fixtures existed only for the length of this
-- transaction, whether it passed or failed.
rollback;
