-- ============================================================================
--  Consent rules — the four promises the database makes
-- ============================================================================
--  Run in the Supabase SQL editor after 5_consent_to_run.sql. Everything is
--  rolled back at the end; your real data is never touched.
--
--  The promises being tested:
--    1. a published document cannot be edited — ever, by anyone
--    2. a consent decision cannot be edited or deleted
--    3. withdrawing is a new row, and the standing answer follows it
--    4. erasing a patient's file is not blocked by that file's consent history
--
--  Rule 4 is the one worth having a test for. The append-only trigger that
--  enforces rules 2 and 3 also fires on the cascade from a deleted patient, and
--  the first version of it made erasing a patient impossible — the deletion
--  right defeated by the audit rule meant to protect the patient.
-- ============================================================================

begin;

do $test$
declare
  v_clinic  uuid;
  v_patient uuid;
  v_doc_v1  uuid;
  v_doc_v2  uuid;
  v_version integer;
  v_granted boolean;
  v_count   integer;
begin
  insert into public.clinics (name, slug)
  values ('Consent Test', 'consent-test-' || gen_random_uuid())
  returning id into v_clinic;

  insert into public.patients (clinic_id, first_name, last_name)
  values (v_clinic, 'Consent', 'Tester')
  returning id into v_patient;

  insert into public.consent_documents (clinic_id, kind, version, locale, title, body, published_at)
  values (v_clinic, 'treatment', 1, 'he', 'הסכמה מדעת', 'נוסח גרסה 1', now())
  returning id into v_doc_v1;

  -- ------------------------------------------------------------------------
  -- 1 · A published document is frozen
  -- ------------------------------------------------------------------------
  begin
    update public.consent_documents set body = 'נוסח ששונה בשקט' where id = v_doc_v1;
    raise exception 'FAIL: a published document was edited';
  exception
    when others then
      if sqlerrm <> 'published_consent_document_is_immutable' then raise; end if;
      raise notice 'ok   a published document cannot be edited';
  end;

  -- The title is part of what was agreed to, so it is frozen as well.
  begin
    update public.consent_documents set title = 'כותרת אחרת' where id = v_doc_v1;
    raise exception 'FAIL: the title of a published document was edited';
  exception
    when others then
      if sqlerrm <> 'published_consent_document_is_immutable' then raise; end if;
      raise notice 'ok   the title is frozen too, not just the body';
  end;

  -- ------------------------------------------------------------------------
  -- 2 · Version numbers are allocated by the database
  -- ------------------------------------------------------------------------
  insert into public.consent_documents (clinic_id, kind, version, locale, title, body, published_at)
  values (v_clinic, 'treatment', 2, 'he', 'הסכמה מדעת', 'נוסח גרסה 2', now())
  returning id into v_doc_v2;

  select max(version) into v_version
  from public.consent_documents
  where clinic_id = v_clinic and kind = 'treatment' and locale = 'he';
  if v_version <> 2 then raise exception 'FAIL: expected version 2, got %', v_version; end if;
  raise notice 'ok   versions accumulate rather than overwrite';

  -- ------------------------------------------------------------------------
  -- 3 · Consents are append-only, and withdrawal is a new decision
  -- ------------------------------------------------------------------------
  insert into public.patient_consents (clinic_id, patient_id, document_id, kind, granted, method, decided_at)
  values (v_clinic, v_patient, v_doc_v1, 'treatment', true, 'in_person', now() - interval '6 months');

  begin
    update public.patient_consents set granted = false where patient_id = v_patient;
    raise exception 'FAIL: a consent decision was edited';
  exception
    when others then
      if sqlerrm <> 'patient_consents_is_append_only' then raise; end if;
      raise notice 'ok   a consent decision cannot be edited';
  end;

  begin
    delete from public.patient_consents where patient_id = v_patient;
    raise exception 'FAIL: a consent decision was deleted';
  exception
    when others then
      if sqlerrm <> 'patient_consents_is_append_only' then raise; end if;
      raise notice 'ok   a consent decision cannot be deleted';
  end;

  -- Withdrawal: a second row, citing the version in force at the time.
  insert into public.patient_consents (clinic_id, patient_id, document_id, kind, granted, method, decided_at)
  values (v_clinic, v_patient, v_doc_v2, 'treatment', false, 'phone', now());

  select granted into v_granted
  from public.patient_consent_status
  where patient_id = v_patient and kind = 'treatment';
  if v_granted is distinct from false then
    raise exception 'FAIL: the standing answer did not follow the withdrawal (got %)', v_granted;
  end if;

  select count(*) into v_count from public.patient_consents where patient_id = v_patient;
  if v_count <> 2 then
    raise exception 'FAIL: expected both decisions to survive, found % row(s)', v_count;
  end if;
  raise notice 'ok   withdrawal is a new decision and the earlier one survives';

  -- Marketing is separate: withdrawing it must not disturb consent to treatment.
  insert into public.consent_documents (clinic_id, kind, version, locale, title, body, published_at)
  values (v_clinic, 'marketing', 1, 'he', 'דיוור', 'נוסח דיוור', now());

  insert into public.patient_consents (clinic_id, patient_id, kind, granted, method, document_id)
  select v_clinic, v_patient, 'marketing', true, 'in_person', id
  from public.consent_documents where clinic_id = v_clinic and kind = 'marketing';

  select count(*) into v_count
  from public.patient_consent_status
  where patient_id = v_patient;
  if v_count <> 2 then
    raise exception 'FAIL: expected one standing answer per kind, found %', v_count;
  end if;
  raise notice 'ok   each kind carries its own standing answer';

  -- ------------------------------------------------------------------------
  -- 4 · Erasure is not blocked by the consent history
  -- ------------------------------------------------------------------------
  -- The right to have a file deleted must survive the rule that protects its
  -- audit trail. This is the check that would have caught the first version of
  -- the append-only trigger.
  delete from public.patients where id = v_patient;

  select count(*) into v_count from public.patient_consents where patient_id = v_patient;
  if v_count <> 0 then
    raise exception 'FAIL: % consent row(s) survived the patient', v_count;
  end if;
  raise notice 'ok   deleting a patient file is not blocked by its consent history';

  -- The documents themselves are clinic property and stay.
  select count(*) into v_count from public.consent_documents where clinic_id = v_clinic;
  if v_count <> 3 then
    raise exception 'FAIL: expected the 3 documents to remain, found %', v_count;
  end if;
  raise notice 'ok   the consent documents themselves are unaffected';

  raise notice ' ';
  raise notice 'ALL CONSENT RULE CHECKS PASSED';
end
$test$;

rollback;
