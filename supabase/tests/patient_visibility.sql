-- ============================================================================
--  Roles that mean something (migration 78)
-- ============================================================================
--  Paste into the Supabase SQL editor after 72_patient_visibility_to_run.sql.
--  Everything is rolled back at the end; your real data is never touched.
--
--  The promises being tested:
--    1. a practitioner reaches the patients they treat, and no others
--    2. the owner reaches every patient
--    3. a secretary reaches every patient's file — and no clinical record
--    4. a secretary reaches the whole invoice, lines included
--    5. "the clinic shares its patients" opens the others to a practitioner
--    6. a practitioner who opens a file can read it back
--    7. a secretary cannot delete a patient; the owner can
--    8. an assistant reaches nothing at all
-- ============================================================================

begin;

do $test$
declare
  v_clinic   uuid;
  v_owner    uuid := gen_random_uuid();
  v_prac_a   uuid := gen_random_uuid();
  v_prac_b   uuid := gen_random_uuid();
  v_desk     uuid := gen_random_uuid();
  v_helper   uuid := gen_random_uuid();
  v_pat_a    uuid;
  v_pat_b    uuid;
  v_enc_a    uuid;
  v_invoice  uuid;
  v_new      uuid;
  v_seen     integer;
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  select u.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u.email, 'x', now(), '{}', '{}', now(), now()
    from (values
      (v_owner, 'owner@vis.test'), (v_prac_a, 'a@vis.test'), (v_prac_b, 'b@vis.test'),
      (v_desk, 'desk@vis.test'), (v_helper, 'help@vis.test')
    ) as u(id, email);
  insert into public.profiles (id, full_name)
  values (v_owner, 'Owner'), (v_prac_a, 'Practitioner A'), (v_prac_b, 'Practitioner B'), (v_desk, 'Secretary'), (v_helper, 'Assistant')
  on conflict (id) do nothing;

  insert into public.clinics (name, slug) values ('Visibility', 'visibility') returning id into v_clinic;
  insert into public.memberships (clinic_id, user_id, role) values
    (v_clinic, v_owner, 'owner'), (v_clinic, v_prac_a, 'practitioner'),
    (v_clinic, v_prac_b, 'practitioner'), (v_clinic, v_desk, 'staff'),
    (v_clinic, v_helper, 'assistant');

  insert into public.patients (clinic_id, first_name, last_name) values (v_clinic, 'Ada', 'Aleph') returning id into v_pat_a;
  insert into public.patients (clinic_id, first_name, last_name) values (v_clinic, 'Ben', 'Bet') returning id into v_pat_b;

  -- The link table fills from the diary, so the diary is what assigns them.
  insert into public.appointments (clinic_id, patient_id, practitioner_id, start_at, end_at)
  values (v_clinic, v_pat_a, v_prac_a, now() + interval '1 day', now() + interval '1 day 1 hour');
  insert into public.appointments (clinic_id, patient_id, practitioner_id, start_at, end_at)
  values (v_clinic, v_pat_b, v_prac_b, now() + interval '2 days', now() + interval '2 days 1 hour');

  insert into public.encounters (clinic_id, patient_id, practitioner_id, encounter_date)
  values (v_clinic, v_pat_a, v_prac_a, current_date) returning id into v_enc_a;

  -- invoice_number is assigned by the table's own trigger.
  insert into public.invoices (clinic_id, patient_id, status, issued_at)
  values (v_clinic, v_pat_a, 'draft', now()) returning id into v_invoice;
  insert into public.invoice_items (clinic_id, invoice_id, description, quantity, unit_price)
  values (v_clinic, v_invoice, 'Formula, two weeks', 1, 240);

  perform set_config('role', 'authenticated', true);

  -- 1 -----------------------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', v_prac_a, 'role', 'authenticated')::text, true);
  select count(*) into v_seen from public.patients;
  if v_seen <> 1 then raise exception 'FAIL 1: practitioner A saw % patients, expected only their own', v_seen; end if;
  if not exists (select 1 from public.patients where id = v_pat_a) then
    raise exception 'FAIL 1: practitioner A could not see their own patient';
  end if;
  raise notice 'PASS 1: a practitioner reaches their own patients only';

  perform set_config('request.jwt.claims', json_build_object('sub', v_prac_b, 'role', 'authenticated')::text, true);
  if exists (select 1 from public.patients where id = v_pat_a) then
    raise exception 'FAIL 1: practitioner B reached the other practitioner''s patient';
  end if;
  if exists (select 1 from public.encounters where id = v_enc_a) then
    raise exception 'FAIL 1: practitioner B read the other practitioner''s treatment record';
  end if;

  -- 2 -----------------------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', v_owner, 'role', 'authenticated')::text, true);
  select count(*) into v_seen from public.patients;
  if v_seen <> 2 then raise exception 'FAIL 2: the owner saw % patients, expected 2', v_seen; end if;
  if not exists (select 1 from public.encounters where id = v_enc_a) then
    raise exception 'FAIL 2: the owner could not read a treatment record';
  end if;
  raise notice 'PASS 2: the owner reaches everything';

  -- 3 and 4 -----------------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', v_desk, 'role', 'authenticated')::text, true);
  select count(*) into v_seen from public.patients;
  if v_seen <> 2 then raise exception 'FAIL 3: the secretary saw % patients, expected every one', v_seen; end if;
  select count(*) into v_seen from public.encounters;
  if v_seen <> 0 then raise exception 'FAIL 3: the secretary read % treatment record(s)', v_seen; end if;
  select count(*) into v_seen from public.patient_documents;
  if v_seen <> 0 then raise exception 'FAIL 3: the secretary reached patient documents'; end if;
  raise notice 'PASS 3: the secretary reaches the files and none of the records';

  if not exists (select 1 from public.invoices where id = v_invoice) then
    raise exception 'FAIL 4: the secretary could not see an invoice';
  end if;
  select count(*) into v_seen from public.invoice_items where invoice_id = v_invoice;
  if v_seen <> 1 then raise exception 'FAIL 4: the secretary saw % invoice line(s), expected the whole invoice', v_seen; end if;
  raise notice 'PASS 4: the secretary reaches the whole invoice, lines included';

  -- 7 ------------------------------------------------------------------------
  delete from public.patients where id = v_pat_b;
  if not exists (select 1 from public.patients where id = v_pat_b) then
    raise exception 'FAIL 7: the secretary deleted a patient';
  end if;
  raise notice 'PASS 7: the secretary cannot delete a file';

  -- 8 ------------------------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', v_helper, 'role', 'authenticated')::text, true);
  select count(*) into v_seen from public.patients;
  if v_seen <> 0 then raise exception 'FAIL 8: the assistant reached % patient(s)', v_seen; end if;
  raise notice 'PASS 8: the unused role reaches nothing';

  -- 6 ------------------------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', v_prac_b, 'role', 'authenticated')::text, true);
  insert into public.patients (clinic_id, first_name, last_name)
  values (v_clinic, 'Carmel', 'Gimel') returning id into v_new;
  if not exists (select 1 from public.patients where id = v_new) then
    raise exception 'FAIL 6: a practitioner opened a file and could not read it back';
  end if;
  raise notice 'PASS 6: opening a file makes that patient yours';

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

  -- And sharing patients must not have handed the secretary the records.
  perform set_config('request.jwt.claims', json_build_object('sub', v_desk, 'role', 'authenticated')::text, true);
  select count(*) into v_seen from public.encounters;
  if v_seen <> 0 then raise exception 'FAIL 5: sharing the patients opened the records to the secretary'; end if;

  raise notice 'ALL PATIENT VISIBILITY CHECKS PASSED';
end;
$test$;

rollback;
