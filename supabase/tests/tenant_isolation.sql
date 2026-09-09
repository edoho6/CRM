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
  v_package_a uuid;
  v_package_b uuid;
  v_consent_a uuid;
  v_room_a    uuid;
  v_room_b    uuid;
  v_tag_a     uuid;
  v_tag_b     uuid;
  v_feed_a    uuid;
  v_feed_b    uuid;
  v_confirm_a uuid;
  v_confirm_b uuid;
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

  -- A punch card in each clinic, and a redemption against B's, so the
  -- balances view has something to leak if it is going to.
  insert into public.patient_packages (clinic_id, patient_id, name, total_sessions)
  values (v_clinic_a, v_patient_a, 'Iso Card A', 3) returning id into v_package_a;

  insert into public.patient_packages (clinic_id, patient_id, name, total_sessions)
  values (v_clinic_b, v_patient_b, 'Iso Card B', 3) returning id into v_package_b;

  insert into public.package_redemptions (clinic_id, package_id)
  values (v_clinic_b, v_package_b);

  -- A signed consent in each. The signature is the evidence; it must not be
  -- readable across a tenant boundary any more than the decision is.
  insert into public.patient_consents (clinic_id, patient_id, kind, granted, method)
  values (v_clinic_a, v_patient_a, 'treatment', true, 'in_person')
  returning id into v_consent_a;

  insert into public.signatures (clinic_id, patient_id, consent_id, method, content)
  values (v_clinic_a, v_patient_a, v_consent_a, 'typed', 'Alice ClinicA');

  insert into public.patient_consents (clinic_id, patient_id, kind, granted, method)
  values (v_clinic_b, v_patient_b, 'treatment', true, 'in_person');

  insert into public.signatures (clinic_id, patient_id, consent_id, method, content)
  select v_clinic_b, v_patient_b, c.id, 'typed', 'Bob ClinicB'
  from public.patient_consents c
  where c.clinic_id = v_clinic_b limit 1;

  -- A treatment confirmation in each: a statement about a named patient, which
  -- is as identifying as the record it summarises.
  insert into public.treatment_confirmations
    (clinic_id, patient_id, practitioner_id, treatment_dates,
     practitioner_name, patient_name)
  values (v_clinic_a, v_patient_a, v_user_a, array[current_date]::date[],
          'Practitioner A', 'Alice ClinicA');

  insert into public.treatment_confirmations
    (clinic_id, patient_id, practitioner_id, treatment_dates,
     practitioner_name, patient_name)
  values (v_clinic_b, v_patient_b, v_user_b, array[current_date]::date[],
          'Practitioner B', 'Bob ClinicB');

  -- A protocol in each clinic. Not patient data, but it is a practitioner's
  -- clinical working material and has exactly the same reason to stay put.
  insert into public.treatment_protocols (clinic_id, name, indications)
  values (v_clinic_a, 'Iso Protocol A', 'Isolation test');

  insert into public.treatment_protocols (clinic_id, name, indications)
  values (v_clinic_b, 'Iso Protocol B', 'Isolation test');

  -- Working hours and a closure for each owner, for the same reason: the diary
  -- is a schedule of when a named person is at work.
  insert into public.practitioner_schedules (clinic_id, practitioner_id, weekday, start_time, end_time)
  values (v_clinic_a, v_user_a, 0, '09:00', '17:00'),
         (v_clinic_b, v_user_b, 0, '09:00', '17:00');

  insert into public.schedule_exceptions (clinic_id, practitioner_id, date, is_closed, reason)
  values (v_clinic_a, v_user_a, current_date + 30, true, 'Iso closure A'),
         (v_clinic_b, v_user_b, current_date + 30, true, 'Iso closure B');

  insert into public.patient_documents (clinic_id, patient_id, file_path, file_name, shared_with_patient)
  values (v_clinic_a, v_patient_a, v_clinic_a || '/' || v_patient_a || '/shared.pdf', 'shared.pdf', true)
  returning id into v_doc_shared;

  insert into public.patient_documents (clinic_id, patient_id, file_path, file_name, shared_with_patient)
  values (v_clinic_a, v_patient_a, v_clinic_a || '/' || v_patient_a || '/private.pdf', 'private.pdf', false)
  returning id into v_doc_private;

  -- The portal patient: an auth user with no membership, linked to A's patient.
  insert into public.patient_portal_access (clinic_id, patient_id, user_id, email, activated_at)
  values (v_clinic_a, v_patient_a, v_user_p, 'iso-p-' || v_user_p || '@example.test', now());

  -- Rooms, tags and calendar feeds: one of each per clinic. A room name or a
  -- tag says something about the practice; a feed token opens the whole diary.
  insert into public.rooms (clinic_id, name)
  values (v_clinic_a, 'Iso Room A') returning id into v_room_a;

  insert into public.rooms (clinic_id, name)
  values (v_clinic_b, 'Iso Room B') returning id into v_room_b;

  insert into public.patient_tags (clinic_id, name)
  values (v_clinic_a, 'Iso Tag A') returning id into v_tag_a;

  insert into public.patient_tags (clinic_id, name)
  values (v_clinic_b, 'Iso Tag B') returning id into v_tag_b;

  insert into public.patient_tag_links (clinic_id, patient_id, tag_id)
  values (v_clinic_a, v_patient_a, v_tag_a),
         (v_clinic_b, v_patient_b, v_tag_b);

  insert into public.calendar_feeds (clinic_id, practitioner_id)
  values (v_clinic_a, v_user_a) returning token into v_feed_a;

  insert into public.calendar_feeds (clinic_id, practitioner_id)
  values (v_clinic_b, v_user_b) returning token into v_feed_b;

  -- A booking in each room, so the feeds and the confirmation link have
  -- something to leak if they were going to.
  insert into public.appointments (clinic_id, patient_id, practitioner_id, room_id, start_at, end_at)
  values (v_clinic_a, v_patient_a, v_user_a, v_room_a, now() + interval '2 days', now() + interval '2 days 1 hour')
  returning confirmation_token into v_confirm_a;

  insert into public.appointments (clinic_id, patient_id, practitioner_id, room_id, start_at, end_at)
  values (v_clinic_b, v_patient_b, v_user_b, v_room_b, now() + interval '2 days', now() + interval '2 days 1 hour')
  returning confirmation_token into v_confirm_b;

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

  -- A protocol is a practitioner's own clinical material. Reading a colleague's
  -- across a tenant boundary is reading how they treat.
  select count(*) into v_count from public.treatment_protocols where clinic_id = v_clinic_a;
  if v_count <> 1 then raise exception 'FAIL: clinic A cannot read its own protocol'; end if;

  select count(*) into v_count from public.treatment_protocols where clinic_id = v_clinic_b;
  if v_count <> 0 then raise exception 'FAIL: treatment protocols leaked across clinics'; end if;
  raise notice 'ok   treatment protocols isolated';

  -- Punch cards, their redemptions, and the view that counts them. The view is
  -- security_invoker, and this is the check that says so.
  select count(*) into v_count from public.patient_packages where clinic_id = v_clinic_b;
  if v_count <> 0 then raise exception 'FAIL: packages leaked across clinics'; end if;

  select count(*) into v_count from public.package_redemptions where clinic_id = v_clinic_b;
  if v_count <> 0 then raise exception 'FAIL: package redemptions leaked across clinics'; end if;

  select count(*) into v_count from public.package_balances where clinic_id = v_clinic_b;
  if v_count <> 0 then raise exception 'FAIL: package_balances bypassed RLS'; end if;

  select count(*) into v_count from public.package_balances where clinic_id = v_clinic_a;
  if v_count <> 1 then raise exception 'FAIL: clinic A cannot read its own package balance'; end if;
  raise notice 'ok   packages, redemptions and the balances view isolated';

  -- A signature is the evidence behind a consent, and travels with it.
  select count(*) into v_count from public.signatures where clinic_id = v_clinic_b;
  if v_count <> 0 then raise exception 'FAIL: signatures leaked across clinics'; end if;

  select count(*) into v_count from public.treatment_confirmations where clinic_id = v_clinic_b;
  if v_count <> 0 then raise exception 'FAIL: treatment confirmations leaked across clinics'; end if;
  raise notice 'ok   signatures and treatment confirmations isolated';

  -- A signature cannot be edited or removed, on the same reasoning as the
  -- consent it belongs to: it is evidence, and evidence that can be revised is
  -- not evidence.
  --
  -- Two independent things stop the write, and either is a pass: the table has
  -- no UPDATE policy at all, so RLS makes the row invisible to UPDATE and it
  -- matches zero rows with no error raised — and the append-only trigger is
  -- there in case a future policy ever made the row visible. Assuming only the
  -- second one and treating "the trigger didn't fire" as a leak was the bug
  -- here: on RLS alone the trigger never runs, and this failed on a target the
  -- policy already protects more strongly than the trigger does.
  declare
    v_blocked boolean := false;
  begin
    begin
      update public.signatures set content = 'Forged' where clinic_id = v_clinic_a;
    exception
      when sqlstate 'P0001' then
        if sqlerrm like '%append_only%' then
          v_blocked := true;
        else
          raise;
        end if;
    end;
    get diagnostics v_count = row_count;
    if v_blocked then
      raise notice 'ok   signatures are append-only (trigger refused the update)';
    elsif v_count = 0 then
      raise notice 'ok   signatures are append-only (no UPDATE policy leaves no row to touch)';
    else
      raise exception 'FAIL: % signature row(s) were edited', v_count;
    end if;
  end;

  -- The card cannot be overdrawn, and the refusal comes from the database
  -- rather than from a button. Three sessions, three redemptions, and the
  -- fourth must fail.
  insert into public.package_redemptions (clinic_id, package_id)
  values (v_clinic_a, v_package_a), (v_clinic_a, v_package_a), (v_clinic_a, v_package_a);

  begin
    insert into public.package_redemptions (clinic_id, package_id)
    values (v_clinic_a, v_package_a);
    raise exception 'FAIL: a package was overdrawn';
  exception
    when sqlstate 'P0001' then
      if sqlerrm not like '%package_exhausted%' then raise; end if;
      raise notice 'ok   the database refuses to overdraw a package';
  end;

  -- When someone works, and when they are closed, is not the other clinic's
  -- business either.
  select count(*) into v_count from public.practitioner_schedules where clinic_id = v_clinic_b;
  if v_count <> 0 then raise exception 'FAIL: working hours leaked across clinics'; end if;

  select count(*) into v_count from public.schedule_exceptions where clinic_id = v_clinic_b;
  if v_count <> 0 then raise exception 'FAIL: schedule exceptions leaked across clinics'; end if;
  raise notice 'ok   working hours and closures isolated';

  -- Rooms, tags and feeds follow the same rule as everything else.
  select count(*) into v_count from public.rooms where clinic_id = v_clinic_b;
  if v_count <> 0 then raise exception 'FAIL: rooms leaked across clinics'; end if;

  select count(*) into v_count from public.patient_tags where clinic_id = v_clinic_b;
  if v_count <> 0 then raise exception 'FAIL: patient tags leaked across clinics'; end if;

  select count(*) into v_count from public.patient_tag_links where clinic_id = v_clinic_b;
  if v_count <> 0 then raise exception 'FAIL: patient tag links leaked across clinics'; end if;

  select count(*) into v_count from public.appointments where clinic_id = v_clinic_b;
  if v_count <> 0 then raise exception 'FAIL: appointments leaked across clinics'; end if;
  raise notice 'ok   rooms, tags and appointments isolated';

  -- A feed token is a secret: not even a colleague in the same clinic sees it,
  -- and clinic B's is invisible twice over.
  select count(*) into v_count from public.calendar_feeds;
  if v_count <> 1 then raise exception 'FAIL: clinic A sees % calendar feed(s), expected only its own', v_count; end if;
  raise notice 'ok   calendar feed tokens are private to their owner';

  -- Two people in one room at one hour is refused by the database itself.
  begin
    insert into public.appointments (clinic_id, patient_id, practitioner_id, room_id, start_at, end_at)
    values (v_clinic_a, v_patient_a, v_user_a, v_room_a, now() + interval '2 days', now() + interval '2 days 30 minutes');
    raise exception 'FAIL: a room was double-booked';
  exception
    when exclusion_violation then
      raise notice 'ok   the database refuses to double-book a room';
  end;

  -- Views are declared security_invoker, so they must inherit the caller's policies
  -- rather than running with the rights of whoever created them.
  select count(*) into v_count from public.herb_stock_levels where clinic_id = v_clinic_b;
  if v_count <> 0 then raise exception 'FAIL: herb_stock_levels bypassed RLS'; end if;

  select count(*) into v_count from public.access_activity where clinic_id = v_clinic_b;
  if v_count <> 0 then raise exception 'FAIL: access_activity bypassed RLS'; end if;
  raise notice 'ok   views inherit the caller''s policies';

  -- The diary view reads as the caller: clinic B's patients do not appear
  -- through it any more than through the table.
  select count(*) into v_count from public.patients_with_diary where clinic_id = v_clinic_b;
  if v_count <> 0 then raise exception 'FAIL: patients_with_diary showed % row(s) of clinic B', v_count; end if;
  select count(*) into v_count from public.patients_with_diary where id = v_patient_a;
  if v_count <> 1 then raise exception 'FAIL: patients_with_diary hid clinic A''s own patient'; end if;
  raise notice 'ok   patients_with_diary reads as the caller';

  -- The service overview is empty for a clinic owner who is not on the
  -- platform list, and the clinic-making function refuses someone who already
  -- belongs somewhere — a second clinic is never one click away.
  select count(*) into v_count from public.platform_clinics();
  if v_count <> 0 then raise exception 'FAIL: platform_clinics() showed % clinic(s) to a plain owner', v_count; end if;
  begin
    perform public.create_clinic_for_current_user('Iso Second Clinic', null);
    raise exception 'FAIL: an existing member created a second clinic';
  exception
    when unique_violation then
      raise notice 'ok   platform overview hidden; one clinic per account';
  end;

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

  -- The token functions are the only doors without a session. A guessed
  -- token opens nothing; a real one opens exactly its own appointment or diary.
  select count(*) into v_count from public.appointment_by_token(gen_random_uuid());
  if v_count <> 0 then raise exception 'FAIL: a random confirmation token returned % row(s)', v_count; end if;

  select count(*) into v_count from public.appointment_by_token(v_confirm_a);
  if v_count <> 1 then raise exception 'FAIL: the real confirmation token returned % row(s), expected 1', v_count; end if;

  -- A random feed token is refused outright — the function raises rather
  -- than answering with an empty diary — so a regenerated address fails
  -- loudly at the subscriber instead of quietly showing nothing.
  begin
    perform * from public.calendar_feed_events(gen_random_uuid());
    raise exception 'FAIL: a random feed token was accepted';
  exception
    when no_data_found then null;
  end;

  select count(*) into v_count from public.calendar_feed_events(v_feed_a)
   where patient_name like '%ClinicB%';
  if v_count <> 0 then raise exception 'FAIL: clinic A''s feed listed clinic B''s patient'; end if;

  select count(*) into v_count from public.calendar_feed_events(v_feed_a);
  if v_count <> 1 then raise exception 'FAIL: clinic A''s feed returned % event(s), expected 1', v_count; end if;

  if not public.respond_to_appointment(v_confirm_b, 'confirmed') then
    raise exception 'FAIL: a valid confirmation token was refused';
  end if;
  if public.respond_to_appointment(gen_random_uuid(), 'confirmed') then
    raise exception 'FAIL: a random token confirmed an appointment';
  end if;
  raise notice 'ok   confirmation and feed tokens open only their own door';

  perform set_config('role', 'postgres', true);
  raise notice ' ';
  raise notice 'ALL TENANT ISOLATION CHECKS PASSED';
end
$test$;

-- Nothing above is kept. The fixtures existed only for the length of this
-- transaction, whether it passed or failed.
rollback;
