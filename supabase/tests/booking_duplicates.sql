-- ============================================================================
--  The booking page and the files the clinic already has (migration 74)
-- ============================================================================
--  Paste into the Supabase SQL editor after 68_booking_duplicates_to_run.sql.
--  Everything is rolled back at the end; your real data is never touched.
--
--  The promises being tested:
--    1. a phone typed another way is the same phone (last nine digits)
--    2. phone and first name agreeing is certain, whatever the case and spacing
--    3. the same phone under another first name is a match, but not a certain one
--    4. a number nobody has, or too short to compare, matches nothing
--    5. another clinic's patient is never matched
--    6. a clinic member and an anonymous caller cannot call the matcher
-- ============================================================================

begin;

do $test$
declare
  v_clinic_a uuid;
  v_clinic_b uuid;
  v_dana     uuid;
  v_other    uuid;
  v_id       uuid;
  v_certain  boolean;
  v_count    integer;
begin
  insert into public.clinics (name, slug) values ('Booking dup A', 'booking-dup-a') returning id into v_clinic_a;
  insert into public.clinics (name, slug) values ('Booking dup B', 'booking-dup-b') returning id into v_clinic_b;
  insert into public.patients (clinic_id, first_name, last_name, phone)
  values (v_clinic_a, 'Dana', 'Levi', '050-123-4567') returning id into v_dana;
  insert into public.patients (clinic_id, first_name, last_name, phone)
  values (v_clinic_b, 'Other', 'Clinic', '0527654321') returning id into v_other;

  if public.phone_key('+972 50 123 4567') is distinct from public.phone_key('050-1234567') then
    raise exception 'FAIL 1: the same phone written two ways gave two keys';
  end if;
  raise notice 'PASS 1: a phone typed another way is the same phone';

  select m.patient_id, m.certain into v_id, v_certain from public.booking_match_patient(v_clinic_a, '+972501234567', ' dana ') m;
  if v_id is distinct from v_dana or not v_certain then raise exception 'FAIL 2: phone and first name did not match with certainty'; end if;
  raise notice 'PASS 2: phone and first name agreeing is certain';

  select m.patient_id, m.certain into v_id, v_certain from public.booking_match_patient(v_clinic_a, '0501234567', 'Yoni') m;
  if v_id is distinct from v_dana or v_certain then raise exception 'FAIL 3: another first name on the same phone was not an uncertain match'; end if;
  raise notice 'PASS 3: the same phone under another name is a match, not a certain one';

  select count(*) into v_count from public.booking_match_patient(v_clinic_a, '0509999999', 'Dana');
  if v_count <> 0 then raise exception 'FAIL 4: an unknown number matched a file'; end if;
  select count(*) into v_count from public.booking_match_patient(v_clinic_a, '4567', 'Dana');
  if v_count <> 0 then raise exception 'FAIL 4: four digits matched a file'; end if;
  raise notice 'PASS 4: an unknown or short number matches nothing';

  select count(*) into v_count from public.booking_match_patient(v_clinic_a, '0527654321', 'Other');
  if v_count <> 0 then raise exception 'FAIL 5: another clinic''s patient was matched'; end if;
  raise notice 'PASS 5: another clinic''s patient is never matched';

  if has_function_privilege('authenticated', 'public.booking_match_patient(uuid, text, text)', 'execute')
     or has_function_privilege('anon', 'public.booking_match_patient(uuid, text, text)', 'execute') then
    raise exception 'FAIL 6: the matcher is open to callers';
  end if;
  raise notice 'PASS 6: only the booking function reaches the matcher';

  raise notice 'ALL BOOKING DUPLICATE CHECKS PASSED';
end;
$test$;

rollback;
