-- ============================================================================
-- 74 · The booking page finds the patient the diary already has
-- ============================================================================
-- The online booking page looked a caller up by the digits of the phone, all
-- of them: "050-123-4567" typed at the desk and "+972 50 123 4567" typed on the
-- page are one number and were two files. The desk form already compares the
-- last nine digits (features/patients/duplicate.ts); the page now does the same.
--
-- A phone is not a person, though: a couple, a parent and child share one. The
-- desk shows its warning to a person who decides; the page has nobody to ask.
-- So the appointment joins an existing file only when the first name agrees as
-- well (letters only, any case — "Dana" and "dana " are one name). A number that
-- matches a file under another first name opens a new file, as before, and leaves
-- a task for the desk to look at the two — an appointment in the wrong person's
-- medical file is the worse mistake, and a second file is one the desk can close.
--
-- Also: the page's last name is optional, but patients.last_name is not null, and the
-- function wrote null for an empty one — a new patient without a last name could not
-- book at all. It writes an empty string now, as the column allows.
--
-- (The portal never opens a patient: it attaches a sign-in to a file the clinic
-- invited. The booking page was the one door without a check.)
-- ============================================================================

-- The comparable part of a phone: its last nine digits, an Israeli subscriber
-- number without the country code; null when there are fewer to go on.
create or replace function public.phone_key(p_phone text)
returns text
language sql
immutable
set search_path = public
as $$
  select case when length(d) >= 9 then right(d, 9) end
    from (select regexp_replace(coalesce(p_phone, ''), '\D', '', 'g') as d) x;
$$;

-- A first name as comparable letters: case and everything but letters dropped.
create or replace function public.name_key(p_name text)
returns text
language sql
immutable
set search_path = public
as $$
  -- Explicit ranges, not [:alpha:]: under the C locale that class knows no Hebrew letter.
  select nullif(regexp_replace(lower(coalesce(p_name, '')), '[^a-zא-ת]', '', 'g'), '');
$$;

-- The file a booking belongs to. `certain` is true when the phone and the first
-- name both agree; a phone match under another name comes back with certain =
-- false and the file it matched, for the desk's task; no match is (null, false).
create or replace function public.booking_match_patient(p_clinic_id uuid, p_phone text, p_first_name text)
returns table (patient_id uuid, certain boolean)
language sql
stable
security definer
set search_path = public
as $$
  with candidates as (
    select p.id, coalesce(public.name_key(p.first_name) = public.name_key(p_first_name), false) as same_name, p.is_active, p.created_at
      from public.patients p
     where p.clinic_id = p_clinic_id
       and public.phone_key(p_phone) is not null
       and public.phone_key(p.phone) = public.phone_key(p_phone)
  )
  select c.id, c.same_name
    from candidates c
   order by c.same_name desc, c.is_active desc, c.created_at
   limit 1;
$$;

revoke all on function public.booking_match_patient(uuid, text, text) from public;
revoke execute on function public.booking_match_patient(uuid, text, text) from anon, authenticated;

create or replace function public.booking_request(
  p_slug text,
  p_type_id uuid,
  p_practitioner_id uuid,
  p_location_id uuid,
  p_start_at timestamptz,
  p_first_name text,
  p_last_name text,
  p_phone text,
  p_email text,
  p_note text,
  p_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.clinics%rowtype;
  v_type public.appointment_types%rowtype;
  v_phone text := public.phone_digits(p_phone);
  v_patient uuid;
  v_certain boolean;
  v_other uuid;
  v_appointment public.appointments%rowtype;
  v_code public.booking_codes%rowtype;
begin
  select * into c from public.clinics where booking_slug = lower(btrim(p_slug)) and booking_enabled;
  if not found then raise exception 'not_available' using errcode = 'P0002'; end if;

  select * into v_type from public.appointment_types t
   where t.id = p_type_id and t.clinic_id = c.id and t.is_active and t.online_bookable;
  if not found then raise exception 'bad_type' using errcode = '22023'; end if;

  if length(btrim(coalesce(p_first_name, ''))) = 0 or length(v_phone) < 8 then
    raise exception 'missing' using errcode = '22023';
  end if;

  if p_location_id is not null and not exists (
    select 1 from public.locations l where l.id = p_location_id and l.clinic_id = c.id and l.is_active
  ) then raise exception 'bad_location' using errcode = '22023'; end if;

  -- The hour must be one the page would have offered.
  if not exists (
    select 1 from public.booking_slots(p_slug, p_type_id, p_practitioner_id,
                                       (p_start_at at time zone c.timezone)::date) s
     where s = p_start_at
  ) then raise exception 'slot_taken' using errcode = '23P01'; end if;

  if c.booking_verify_sms then
    select * into v_code from public.booking_codes k
     where k.clinic_id = c.id and k.phone = v_phone and k.used_at is null and k.expires_at > now()
     order by k.created_at desc limit 1;
    if not found then raise exception 'code_expired' using errcode = '28000'; end if;
    if v_code.attempts >= 5 then raise exception 'code_expired' using errcode = '28000'; end if;
    if v_code.code_hash <> crypt(coalesce(p_code, ''), v_code.code_hash) then
      update public.booking_codes set attempts = attempts + 1 where id = v_code.id;
      raise exception 'bad_code' using errcode = '28000';
    end if;
    update public.booking_codes set used_at = now() where id = v_code.id;
  end if;

  select m.patient_id, m.certain into v_patient, v_certain
    from public.booking_match_patient(c.id, p_phone, p_first_name) m;

  if v_patient is not null and not v_certain then
    v_other := v_patient;
    v_patient := null;
  end if;

  if v_patient is null then
    insert into public.patients (clinic_id, first_name, last_name, phone, email, preferred_locale, created_via)
    values (c.id, btrim(p_first_name), btrim(coalesce(p_last_name, '')), btrim(p_phone),
            nullif(btrim(coalesce(p_email, '')), ''), c.default_locale, 'online')
    returning id into v_patient;
  end if;

  insert into public.appointments
    (clinic_id, patient_id, practitioner_id, appointment_type_id, location_id, start_at, end_at,
     status, notes, booked_online)
  values
    (c.id, v_patient, p_practitioner_id, v_type.id, p_location_id, p_start_at,
     p_start_at + make_interval(mins => v_type.default_duration_minutes),
     'scheduled', nullif(btrim(coalesce(p_note, '')), ''), true)
  returning * into v_appointment;

  -- Same number, another first name: a new file, and a task so a person decides whether it is one.
  if v_other is not null then
    insert into public.clinic_tasks (clinic_id, title, notes, due_on, patient_id)
    select c.id,
           case when c.default_locale = 'en'
                then 'Online booking: possibly an existing patient'
                else 'זימון אונליין: ייתכן שזה מטופל קיים' end,
           case when c.default_locale = 'en'
                then 'The phone number matches the file of ' || coalesce(o.full_name, o.first_name) || '. If it is the same person, move the appointment to that file and deactivate the new one.'
                else 'מספר הטלפון זהה לתיק של ' || coalesce(o.full_name, o.first_name) || '. אם זה אותו אדם, מעבירים את התור לתיק הקיים ומבטלים את התיק החדש.' end,
           (now() at time zone c.timezone)::date,
           v_patient
      from public.patients o
     where o.id = v_other;
  end if;

  return jsonb_build_object(
    'token', v_appointment.confirmation_token,
    'start_at', v_appointment.start_at
  );
exception
  when exclusion_violation then
    raise exception 'slot_taken' using errcode = '23P01';
end;
$$;

revoke all on function public.booking_request(text, uuid, uuid, uuid, timestamptz, text, text, text, text, text, text) from public;
grant execute on function public.booking_request(text, uuid, uuid, uuid, timestamptz, text, text, text, text, text, text) to anon, authenticated;

comment on function public.booking_request is
  'The public booking page''s one write. Joins a file when the phone (last nine digits) and the first name agree, opens a new one otherwise — with a task for the desk when only the phone matched — and books the hour under the diary''s own constraints.';
