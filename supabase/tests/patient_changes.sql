-- ============================================================================
--  Moving or cancelling from the reminder link (migration 75)
-- ============================================================================
--  Paste into the Supabase SQL editor after 69_patient_changes_to_run.sql.
--  Everything is rolled back at the end; your real data is never touched.
--
--  The promises being tested:
--    1. a clinic that has not allowed it: the link may neither cancel nor move
--    2. allowed, far enough ahead: cancel yes; move no while online booking is off
--    3. inside the notice: neither, and the reason says so
--    4. a cancel frees the hour, marks the answer, and leaves the clinic a task
--    5. a cancelled appointment cannot be cancelled again
--    6. a clinic that has not allowed it refuses the cancel outright
-- ============================================================================

begin;

do $test$
declare
  v_clinic   uuid;
  v_doctor   uuid := gen_random_uuid();
  v_patient  uuid;
  v_type     uuid;
  v_far      public.appointments%rowtype;
  v_near     public.appointments%rowtype;
  v_options  jsonb;
  v_count    integer;
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (v_doctor, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'doctor@changes.test', 'x', now(), '{}', '{}', now(), now());
  insert into public.profiles (id, full_name) values (v_doctor, 'Doctor') on conflict (id) do nothing;
  insert into public.clinics (name, slug) values ('Changes test', 'changes-test') returning id into v_clinic;
  insert into public.memberships (clinic_id, user_id, role) values (v_clinic, v_doctor, 'owner');
  insert into public.appointment_types (clinic_id, name_he, name_en, default_duration_minutes)
  values (v_clinic, 'טיפול', 'Treatment', 60) returning id into v_type;
  insert into public.patients (clinic_id, first_name, last_name, phone)
  values (v_clinic, 'Noa', 'Test', '050-0000001') returning id into v_patient;
  insert into public.appointments (clinic_id, patient_id, practitioner_id, appointment_type_id, start_at, end_at)
  values (v_clinic, v_patient, v_doctor, v_type, now() + interval '3 days', now() + interval '3 days 1 hour')
  returning * into v_far;
  insert into public.appointments (clinic_id, patient_id, practitioner_id, appointment_type_id, start_at, end_at)
  values (v_clinic, v_patient, v_doctor, v_type, now() + interval '2 hours', now() + interval '3 hours')
  returning * into v_near;

  v_options := public.appointment_change_options(v_far.confirmation_token);
  if (v_options ->> 'can_cancel')::boolean or (v_options ->> 'can_move')::boolean or v_options ->> 'reason' <> 'disabled' then
    raise exception 'FAIL 1: a clinic that has not allowed changes offered one: %', v_options;
  end if;
  raise notice 'PASS 1: not allowed, nothing offered';

  update public.clinics set patient_changes_enabled = true, patient_changes_notice_hours = 24 where id = v_clinic;
  v_options := public.appointment_change_options(v_far.confirmation_token);
  if not (v_options ->> 'can_cancel')::boolean or (v_options ->> 'can_move')::boolean then
    raise exception 'FAIL 2: three days ahead should cancel but not move without online booking: %', v_options;
  end if;
  raise notice 'PASS 2: cancel offered, move not while the booking page is off';

  v_options := public.appointment_change_options(v_near.confirmation_token);
  if (v_options ->> 'can_cancel')::boolean or v_options ->> 'reason' <> 'too_late' then
    raise exception 'FAIL 3: two hours ahead with a 24-hour notice was offered a change: %', v_options;
  end if;
  begin
    perform public.cancel_appointment_by_token(v_near.confirmation_token);
    raise exception 'FAIL 3: a cancel inside the notice went through';
  exception
    when insufficient_privilege then null;
  end;
  raise notice 'PASS 3: inside the notice, neither';

  if not public.cancel_appointment_by_token(v_far.confirmation_token) then
    raise exception 'FAIL 4: the cancel did not go through';
  end if;
  select count(*) into v_count from public.appointments
   where id = v_far.id and status = 'cancelled' and confirmation_response = 'declined' and cancelled_at is not null;
  if v_count <> 1 then raise exception 'FAIL 4: the appointment was not marked cancelled'; end if;
  select count(*) into v_count from public.clinic_tasks where clinic_id = v_clinic and patient_id = v_patient;
  if v_count <> 1 then raise exception 'FAIL 4: the clinic was left % task(s), expected 1', v_count; end if;
  raise notice 'PASS 4: cancelled, answered, and a task for the clinic';

  begin
    perform public.cancel_appointment_by_token(v_far.confirmation_token);
    raise exception 'FAIL 5: a cancelled appointment was cancelled again';
  exception
    when insufficient_privilege then null;
  end;
  raise notice 'PASS 5: a cancelled appointment stays as it is';

  update public.clinics set patient_changes_enabled = false where id = v_clinic;
  update public.appointments set start_at = now() + interval '5 days', end_at = now() + interval '5 days 1 hour' where id = v_near.id;
  begin
    perform public.cancel_appointment_by_token(v_near.confirmation_token);
    raise exception 'FAIL 6: a clinic that has not allowed it let a cancel through';
  exception
    when insufficient_privilege then null;
  end;
  raise notice 'PASS 6: not allowed, the cancel is refused';

  raise notice 'ALL PATIENT CHANGE CHECKS PASSED';
end;
$test$;

rollback;
