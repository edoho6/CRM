-- ============================================================================
--  The website and the desk cannot both take the same hour (migration
--  20260919120000)
-- ============================================================================
--  Paste into the Supabase SQL editor after 79_online_booking_race_to_run.sql.
--  Everything is rolled back at the end; your real data is never touched.
--
--  The race itself needs two sessions and cannot be staged in one; what is
--  tested is the check that the lock makes reliable:
--    1. a public write onto an hour the practitioner has in a room is refused
--    2. the desk may still book that practitioner's second bed at that hour
--    3. a cancelled appointment does not hold the hour
--    4. a public write onto a free hour goes through
--    5. the guard is not callable by anyone
-- ============================================================================

begin;

do $test$
declare
  v_clinic  uuid;
  v_doctor  uuid := gen_random_uuid();
  v_patient uuid;
  v_type    uuid;
  v_room_a  uuid;
  v_room_b  uuid;
  v_at      timestamptz := date_trunc('hour', now()) + interval '5 days';
  v_cancel  uuid;
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (v_doctor, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'doctor@race.test', 'x', now(), '{}', '{}', now(), now());
  insert into public.profiles (id, full_name) values (v_doctor, 'Doctor') on conflict (id) do nothing;
  insert into public.clinics (name, slug) values ('Race test', 'race-test') returning id into v_clinic;
  insert into public.memberships (clinic_id, user_id, role) values (v_clinic, v_doctor, 'owner');
  insert into public.appointment_types (clinic_id, name_he, name_en, default_duration_minutes)
  values (v_clinic, 'טיפול', 'Treatment', 60) returning id into v_type;
  insert into public.patients (clinic_id, first_name, last_name, phone)
  values (v_clinic, 'Noa', 'Race', '050-0000002') returning id into v_patient;
  insert into public.rooms (clinic_id, name) values (v_clinic, 'A') returning id into v_room_a;
  insert into public.rooms (clinic_id, name) values (v_clinic, 'B') returning id into v_room_b;

  -- The desk books the practitioner into room A.
  insert into public.appointments (clinic_id, patient_id, practitioner_id, appointment_type_id, room_id, start_at, end_at)
  values (v_clinic, v_patient, v_doctor, v_type, v_room_a, v_at, v_at + interval '1 hour');

  -- 1. The page writes the same hour, room-less: the constraints alone let it in.
  perform set_config('herbalist.online_booking', 'on', true);
  begin
    insert into public.appointments (clinic_id, patient_id, practitioner_id, appointment_type_id, start_at, end_at, booked_online)
    values (v_clinic, v_patient, v_doctor, v_type, v_at + interval '30 minutes', v_at + interval '90 minutes', true);
    raise exception 'FAIL 1: a public booking took an hour the practitioner has in a room';
  exception
    when exclusion_violation then null;
  end;
  perform set_config('herbalist.online_booking', '', true);
  raise notice 'PASS 1: the page cannot take an hour the desk has';

  -- 2. The desk, the second bed, the same hour.
  insert into public.appointments (clinic_id, patient_id, practitioner_id, appointment_type_id, room_id, start_at, end_at)
  values (v_clinic, v_patient, v_doctor, v_type, v_room_b, v_at, v_at + interval '1 hour');
  raise notice 'PASS 2: two beds at one hour is still the desk''s to book';

  -- 3. A cancelled visit at a later hour does not hold it.
  insert into public.appointments (clinic_id, patient_id, practitioner_id, appointment_type_id, room_id, start_at, end_at, status)
  values (v_clinic, v_patient, v_doctor, v_type, v_room_a, v_at + interval '3 hours', v_at + interval '4 hours', 'cancelled')
  returning id into v_cancel;
  perform set_config('herbalist.online_booking', 'on', true);
  insert into public.appointments (clinic_id, patient_id, practitioner_id, appointment_type_id, start_at, end_at, booked_online)
  values (v_clinic, v_patient, v_doctor, v_type, v_at + interval '3 hours', v_at + interval '4 hours', true);
  raise notice 'PASS 3: a cancelled visit releases its hour';

  -- 4. A free hour.
  insert into public.appointments (clinic_id, patient_id, practitioner_id, appointment_type_id, start_at, end_at, booked_online)
  values (v_clinic, v_patient, v_doctor, v_type, v_at + interval '6 hours', v_at + interval '7 hours', true);
  perform set_config('herbalist.online_booking', '', true);
  raise notice 'PASS 4: a free hour is booked';

  -- 5. The guard is a trigger function; nobody calls it.
  if has_function_privilege('anon', 'public.appointments_public_overlap_guard()', 'execute')
     or has_function_privilege('authenticated', 'public.appointments_public_overlap_guard()', 'execute') then
    raise exception 'FAIL 5: the guard is executable by anon or authenticated';
  end if;
  raise notice 'PASS 5: the guard is closed';

  raise notice 'ALL ONLINE BOOKING RACE CHECKS PASSED';
end
$test$;

rollback;
