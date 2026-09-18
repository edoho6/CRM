-- ============================================================================
--  One invoice per treatment, one payment per Grow transaction
--  (migration 20260919092000)
-- ============================================================================
--  Paste into the Supabase SQL editor after 76_one_invoice_per_treatment_to_run.sql.
--  Everything is rolled back at the end; your real data is never touched.
--
--    1. a second invoice for the same treatment is refused
--    2. once the first is cancelled, a new one may be made
--    3. one Grow transaction cannot settle two payments
-- ============================================================================

begin;

do $test$
declare
  v_clinic    uuid;
  v_doctor    uuid := gen_random_uuid();
  v_patient   uuid;
  v_encounter uuid;
  v_first     uuid;
  v_invoice   uuid;
  v_ok        boolean;
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (v_doctor, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'doctor@invoice-once.test', 'x', now(), '{}', '{}', now(), now());
  insert into public.clinics (name, slug) values ('Invoice once', 'invoice-once') returning id into v_clinic;
  insert into public.memberships (clinic_id, user_id, role) values (v_clinic, v_doctor, 'owner');
  insert into public.patients (clinic_id, first_name, last_name) values (v_clinic, 'Once', 'Only') returning id into v_patient;
  insert into public.encounters (clinic_id, patient_id, practitioner_id, encounter_date)
  values (v_clinic, v_patient, v_doctor, current_date) returning id into v_encounter;

  insert into public.invoices (clinic_id, patient_id, encounter_id) values (v_clinic, v_patient, v_encounter) returning id into v_first;

  v_ok := false;
  begin
    insert into public.invoices (clinic_id, patient_id, encounter_id) values (v_clinic, v_patient, v_encounter);
  exception when unique_violation then v_ok := true;
  end;
  if not v_ok then raise exception 'FAIL 1: a second invoice was made for one treatment'; end if;
  raise notice 'PASS 1: one invoice per treatment';

  update public.invoices set status = 'cancelled' where id = v_first;
  insert into public.invoices (clinic_id, patient_id, encounter_id) values (v_clinic, v_patient, v_encounter) returning id into v_invoice;
  raise notice 'PASS 2: a cancelled invoice makes room for a new one';

  insert into public.payments (clinic_id, invoice_id, amount, provider, provider_transaction_id)
  values (v_clinic, v_invoice, 10, 'grow', 'tx-once');
  v_ok := false;
  begin
    insert into public.payments (clinic_id, invoice_id, amount, provider, provider_transaction_id)
    values (v_clinic, v_invoice, 10, 'grow', 'tx-once');
  exception when unique_violation then v_ok := true;
  end;
  if not v_ok then raise exception 'FAIL 3: one Grow transaction settled two payments'; end if;
  raise notice 'PASS 3: one payment per Grow transaction';

  raise notice 'ALL ONE-INVOICE CHECKS PASSED';
end;
$test$;

rollback;
