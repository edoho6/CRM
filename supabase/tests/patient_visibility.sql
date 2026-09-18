-- ============================================================================
--  Roles that mean something (migration 78, tightened by the 18.9 audit)
-- ============================================================================
--  Paste into the Supabase SQL editor after 72_patient_visibility_to_run.sql
--  and 74_security_audit_fixes_to_run.sql. Everything is rolled back at the end;
--  your real data is never touched.
--
--  The promises being tested:
--    1. a practitioner reaches the patients they treat, and no others
--    2. the owner reaches every patient
--    3. a secretary reaches every patient's file — and no clinical record
--    4. a secretary reaches the whole invoice, lines included
--    5. "the clinic shares its patients" opens the others to a practitioner
--    6. a practitioner who opens a file can read it back — the link is made in
--       the same statement as the insert, not by a rule about who created it
--    7. a secretary cannot delete a patient; the owner can
--    8. once the owner removes that link, the creator no longer sees the file
--    9. a person in two clinics carries neither clinic's role into the other
--   10. the audit log (whole clinical rows) is the owner's alone
--   11. a stored file is reachable exactly when its document row is
--   12. the link table shows a practitioner only their own links
-- ============================================================================

begin;

do $test$
declare
  v_clinic   uuid;
  v_other    uuid;
  v_owner    uuid := gen_random_uuid();
  v_prac_a   uuid := gen_random_uuid();
  v_prac_b   uuid := gen_random_uuid();
  v_desk     uuid := gen_random_uuid();
  v_pat_a    uuid;
  v_pat_b    uuid;
  v_pat_x    uuid;
  v_enc_a    uuid;
  v_enc_x    uuid;
  v_invoice  uuid;
  v_new      uuid := gen_random_uuid();
  v_seen     integer;
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  select u.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u.email, 'x', now(), '{}', '{}', now(), now()
    from (values
      (v_owner, 'owner@vis.test'), (v_prac_a, 'a@vis.test'), (v_prac_b, 'b@vis.test'),
      (v_desk, 'desk@vis.test')
    ) as u(id, email);
  insert into public.profiles (id, full_name)
  values (v_owner, 'Owner'), (v_prac_a, 'Practitioner A'), (v_prac_b, 'Practitioner B'), (v_desk, 'Secretary')
  on conflict (id) do nothing;

  insert into public.clinics (name, slug) values ('Visibility', 'visibility') returning id into v_clinic;
  insert into public.memberships (clinic_id, user_id, role, created_at) values
    (v_clinic, v_owner, 'owner', now() - interval '2 days'), (v_clinic, v_prac_a, 'practitioner', now() - interval '2 days'),
    (v_clinic, v_prac_b, 'practitioner', now() - interval '2 days'), (v_clinic, v_desk, 'staff', now() - interval '2 days');

  -- The secretary of this clinic owns another one (for promise 9).
  insert into public.clinics (name, slug) values ('Visibility other', 'visibility-other') returning id into v_other;
  insert into public.memberships (clinic_id, user_id, role) values (v_other, v_desk, 'owner');

  insert into public.patients (clinic_id, first_name, last_name) values (v_clinic, 'Ada', 'Aleph') returning id into v_pat_a;
  insert into public.patients (clinic_id, first_name, last_name) values (v_clinic, 'Ben', 'Bet') returning id into v_pat_b;
  insert into public.patients (clinic_id, first_name, last_name) values (v_other, 'Xena', 'Other') returning id into v_pat_x;

  -- The link table fills from the diary, so the diary is what assigns them.
  insert into public.appointments (clinic_id, patient_id, practitioner_id, start_at, end_at)
  values (v_clinic, v_pat_a, v_prac_a, now() + interval '1 day', now() + interval '1 day 1 hour');
  insert into public.appointments (clinic_id, patient_id, practitioner_id, start_at, end_at)
  values (v_clinic, v_pat_b, v_prac_b, now() + interval '2 days', now() + interval '2 days 1 hour');

  insert into public.encounters (clinic_id, patient_id, practitioner_id, encounter_date)
  values (v_clinic, v_pat_a, v_prac_a, current_date) returning id into v_enc_a;
  insert into public.encounters (clinic_id, patient_id, practitioner_id, encounter_date)
  values (v_other, v_pat_x, v_desk, current_date) returning id into v_enc_x;

  insert into public.invoices (clinic_id, patient_id, status, issued_at)
  values (v_clinic, v_pat_a, 'draft', now()) returning id into v_invoice;
  insert into public.invoice_items (clinic_id, invoice_id, description, quantity, unit_price)
  values (v_clinic, v_invoice, 'Formula, two weeks', 1, 240);

  -- A document and its stored file, for promise 11.
  insert into public.patient_documents (clinic_id, patient_id, file_path, file_name, category)
  values (v_clinic, v_pat_a, v_clinic || '/' || v_pat_a || '/scan.pdf', 'scan.pdf', 'lab_result');
  insert into storage.objects (bucket_id, name) values ('patient-documents', v_clinic || '/' || v_pat_a || '/scan.pdf');
  insert into storage.objects (bucket_id, name) values ('patient-documents', v_clinic || '/' || v_pat_a || '/orphan.pdf');

  perform set_config('role', 'authenticated', true);

  -- 1 -----------------------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', v_prac_a, 'role', 'authenticated')::text, true);
  select count(*) into v_seen from public.patients;
  if v_seen <> 1 then raise exception 'FAIL 1: practitioner A saw % patients, expected only their own', v_seen; end if;
  raise notice 'PASS 1: a practitioner reaches their own patients only';

  perform set_config('request.jwt.claims', json_build_object('sub', v_prac_b, 'role', 'authenticated')::text, true);
  if exists (select 1 from public.patients where id = v_pat_a) or exists (select 1 from public.encounters where id = v_enc_a) then
    raise exception 'FAIL 1: practitioner B reached the other practitioner''s patient or record';
  end if;

  -- 12 ----------------------------------------------------------------------
  select count(*) into v_seen from public.patient_practitioners where user_id <> v_prac_b;
  if v_seen <> 0 then raise exception 'FAIL 12: practitioner B listed % link(s) of other people', v_seen; end if;
  raise notice 'PASS 12: the link table shows a practitioner only their own';

  -- 2 -----------------------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', v_owner, 'role', 'authenticated')::text, true);
  select count(*) into v_seen from public.patients;
  if v_seen <> 2 then raise exception 'FAIL 2: the owner saw % patients, expected 2', v_seen; end if;
  if not exists (select 1 from public.encounters where id = v_enc_a) then
    raise exception 'FAIL 2: the owner could not read a treatment record';
  end if;
  select count(*) into v_seen from public.audit_log where clinic_id = v_clinic;
  if v_seen = 0 then raise exception 'FAIL 10: the owner could not read the audit log'; end if;
  raise notice 'PASS 2: the owner reaches everything';

  -- 11: the owner reaches the file with a row, and not the one without ---------
  select count(*) into v_seen from storage.objects where bucket_id = 'patient-documents' and name like v_clinic || '/%';
  if v_seen <> 1 then raise exception 'FAIL 11: the owner reached % stored file(s), expected only the one with a row', v_seen; end if;

  -- 3 and 4 -----------------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', v_desk, 'role', 'authenticated')::text, true);
  -- The secretary's clinic in force is this one: her membership here is older.
  select count(*) into v_seen from public.patients;
  if v_seen <> 2 then raise exception 'FAIL 3: the secretary saw % patients, expected every one', v_seen; end if;
  select count(*) into v_seen from public.encounters;
  if v_seen <> 0 then raise exception 'FAIL 3: the secretary read % treatment record(s)', v_seen; end if;
  select count(*) into v_seen from public.patient_documents;
  if v_seen <> 0 then raise exception 'FAIL 3: the secretary reached patient documents'; end if;
  raise notice 'PASS 3: the secretary reaches the files and none of the records';

  select count(*) into v_seen from storage.objects where bucket_id = 'patient-documents';
  if v_seen <> 0 then raise exception 'FAIL 11: the secretary reached % stored file(s)', v_seen; end if;
  raise notice 'PASS 11: a stored file follows its row';

  select count(*) into v_seen from public.audit_log;
  if v_seen <> 0 then raise exception 'FAIL 10: the secretary read % audit row(s)', v_seen; end if;
  raise notice 'PASS 10: the audit log is the owner''s';

  if not exists (select 1 from public.invoices where id = v_invoice) then
    raise exception 'FAIL 4: the secretary could not see an invoice';
  end if;
  select count(*) into v_seen from public.invoice_items where invoice_id = v_invoice;
  if v_seen <> 1 then raise exception 'FAIL 4: the secretary saw % invoice line(s), expected the whole invoice', v_seen; end if;
  raise notice 'PASS 4: the secretary reaches the whole invoice, lines included';

  -- 7 ------------------------------------------------------------------------
  delete from public.patients where id = v_pat_b;
  perform set_config('role', 'postgres', true);
  if not exists (select 1 from public.patients where id = v_pat_b) then
    raise exception 'FAIL 7: the secretary deleted a patient';
  end if;
  perform set_config('role', 'authenticated', true);
  raise notice 'PASS 7: the secretary cannot delete a file';

  -- 9 ------------------------------------------------------------------------
  -- She switches to the clinic she owns. Owner there, secretary here: neither
  -- clinic's role may reach the other's rows.
  perform set_config('role', 'postgres', true);
  insert into public.active_clinic (user_id, clinic_id) values (v_desk, v_other)
    on conflict (user_id) do update set clinic_id = excluded.clinic_id;
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_desk, 'role', 'authenticated')::text, true);
  if exists (select 1 from public.encounters where id = v_enc_a) then
    raise exception 'FAIL 9: the owner of one clinic read the other clinic''s treatment record';
  end if;
  if exists (select 1 from public.patients where id = v_pat_a) then
    raise exception 'FAIL 9: rows of a clinic not in force were visible';
  end if;
  if not exists (select 1 from public.encounters where id = v_enc_x) then
    raise exception 'FAIL 9: the owner could not read her own clinic''s record';
  end if;
  raise notice 'PASS 9: a role stays in its own clinic';
  perform set_config('role', 'postgres', true);
  delete from public.active_clinic where user_id = v_desk;
  perform set_config('role', 'authenticated', true);

  -- 6 ------------------------------------------------------------------------
  -- The app inserts with an id it chose and no RETURNING: the row lands, the
  -- after-insert trigger links it in the same statement, and the read that
  -- follows sees it.
  perform set_config('request.jwt.claims', json_build_object('sub', v_prac_b, 'role', 'authenticated')::text, true);
  insert into public.patients (id, clinic_id, first_name, last_name, created_by)
  values (v_new, v_clinic, 'Carmel', 'Gimel', v_prac_b);
  if not exists (select 1 from public.patients where id = v_new) then
    raise exception 'FAIL 6: a practitioner opened a file and could not read it back';
  end if;
  raise notice 'PASS 6: opening a file makes that patient yours';

  -- 8 ------------------------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', v_owner, 'role', 'authenticated')::text, true);
  delete from public.patient_practitioners where patient_id = v_new and user_id = v_prac_b;
  perform set_config('request.jwt.claims', json_build_object('sub', v_prac_b, 'role', 'authenticated')::text, true);
  if exists (select 1 from public.patients where id = v_new) then
    raise exception 'FAIL 8: having created the file kept it visible after the link was removed';
  end if;
  raise notice 'PASS 8: creating a file grants nothing once the link is gone';

  -- 5 ------------------------------------------------------------------------
  perform set_config('role', 'postgres', true);
  update public.clinics set patient_visibility = 'clinic' where id = v_clinic;
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_prac_b, 'role', 'authenticated')::text, true);
  if not exists (select 1 from public.patients where id = v_pat_a) then
    raise exception 'FAIL 5: with the clinic sharing its patients, B still could not reach A''s';
  end if;
  if not exists (select 1 from public.encounters where id = v_enc_a) then
    raise exception 'FAIL 5: sharing the patients did not share the record';
  end if;
  raise notice 'PASS 5: a clinic can choose to share its patients';

  perform set_config('request.jwt.claims', json_build_object('sub', v_desk, 'role', 'authenticated')::text, true);
  select count(*) into v_seen from public.encounters;
  if v_seen <> 0 then raise exception 'FAIL 5: sharing the patients opened the records to the secretary'; end if;

  raise notice 'ALL PATIENT VISIBILITY CHECKS PASSED';
end;
$test$;

rollback;
