-- ============================================================================
-- 34 · Online booking
-- ============================================================================
-- A link a clinic hands out — /book/<its-slug> — on which a patient, new or
-- known, picks a treatment, a free hour, leaves a name and a number, and the
-- booking appears in the diary. No account, no sign-in: the page reads and
-- writes only through the four functions below, which run as the database
-- owner, take the clinic's slug, and give back the least the page needs.
--
-- Free hours are computed here, not in the browser: the working pattern,
-- the day's exception, the blocked windows and the existing bookings are all
-- tables, and the answer to "is 10:30 free" must be the same one the diary
-- gives. The race — two people taking the last slot — is settled by the
-- overlap constraint on the appointments table, which the request function
-- reports back as `slot_taken`.
--
-- Verification by SMS is optional per clinic and off by default, because it
-- needs a sending provider. When on, a six-digit code is queued through the
-- same message log as everything else and checked here, hashed.
-- ============================================================================

alter table public.clinics
  add column if not exists booking_enabled boolean not null default false,
  add column if not exists booking_slug text,
  add column if not exists booking_intro text,
  add column if not exists booking_lead_hours integer not null default 24
    check (booking_lead_hours between 0 and 720),
  add column if not exists booking_horizon_days integer not null default 60
    check (booking_horizon_days between 1 and 365),
  add column if not exists booking_verify_sms boolean not null default false;

-- The public handle. Short, lower-case, letters digits and dashes; unique
-- across the whole service because it is a URL.
create unique index if not exists clinics_booking_slug_idx
  on public.clinics (booking_slug) where booking_slug is not null;

alter table public.clinics
  drop constraint if exists clinics_booking_slug_shape;
alter table public.clinics
  add constraint clinics_booking_slug_shape
  check (booking_slug is null or booking_slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$');

alter table public.appointment_types
  add column if not exists online_bookable boolean not null default false;

alter table public.appointments
  add column if not exists booked_online boolean not null default false;

alter table public.patients
  add column if not exists created_via text not null default 'staff'
    check (created_via in ('staff', 'online', 'portal'));

-- ---------------------------------------------------------------------------
-- Verification codes
-- ---------------------------------------------------------------------------
-- Hashed, short-lived, and never readable from outside: the table has
-- row-level security switched on and no policy at all, so only the two
-- functions below — which run as the owner — can touch it.
create table if not exists public.booking_codes (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  phone text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists booking_codes_lookup_idx
  on public.booking_codes (clinic_id, phone, created_at desc);

alter table public.booking_codes enable row level security;

/** Digits only, so "050-123 4567" and "0501234567" are the same person. */
create or replace function public.phone_digits(p_phone text)
returns text
language sql
immutable
as $$
  select regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
$$;

-- ---------------------------------------------------------------------------
-- What the page shows
-- ---------------------------------------------------------------------------
create or replace function public.booking_clinic(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'clinic', jsonb_build_object(
      'id', c.id,
      'name', c.name,
      'intro', c.booking_intro,
      'address', c.address,
      'phone', c.phone,
      'locale', c.default_locale,
      'timezone', c.timezone,
      'lead_hours', c.booking_lead_hours,
      'horizon_days', c.booking_horizon_days,
      'verify_sms', c.booking_verify_sms
    ),
    'types', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id, 'name_he', t.name_he, 'name_en', t.name_en,
        'minutes', t.default_duration_minutes, 'price', t.price
      ) order by t.sort_order, t.created_at)
      from public.appointment_types t
      where t.clinic_id = c.id and t.is_active and t.online_bookable
    ), '[]'::jsonb),
    'practitioners', coalesce((
      select jsonb_agg(jsonb_build_object('id', m.user_id, 'name', pr.full_name) order by m.created_at)
      from public.memberships m
      join public.profiles pr on pr.id = m.user_id
      where m.clinic_id = c.id and m.is_active and m.role in ('owner', 'practitioner')
    ), '[]'::jsonb),
    'locations', coalesce((
      select jsonb_agg(jsonb_build_object('id', l.id, 'name', l.name, 'address', l.address) order by l.sort_order, l.created_at)
      from public.locations l
      where l.clinic_id = c.id and l.is_active
    ), '[]'::jsonb)
  )
  from public.clinics c
  where c.booking_slug = lower(btrim(p_slug))
    and c.booking_enabled;
$$;

revoke all on function public.booking_clinic(text) from public;
grant execute on function public.booking_clinic(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- The free hours of one day
-- ---------------------------------------------------------------------------
-- Every quarter hour at which a treatment of this type would fit inside the
-- practitioner's open hours, clear of their blocked windows and their
-- bookings, and far enough ahead. Times are worked in the clinic's own zone
-- and returned as instants.
create or replace function public.booking_slots(
  p_slug text,
  p_type_id uuid,
  p_practitioner_id uuid,
  p_day date
)
returns setof timestamptz
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  c public.clinics%rowtype;
  v_minutes integer;
  v_dur interval;
  v_earliest timestamptz;
  v_exception public.schedule_exceptions%rowtype;
  v_open record;
  v_ts timestamptz;
  v_end timestamptz;
begin
  select * into c from public.clinics where booking_slug = lower(btrim(p_slug)) and booking_enabled;
  if not found then return; end if;

  select default_duration_minutes into v_minutes
    from public.appointment_types
   where id = p_type_id and clinic_id = c.id and is_active and online_bookable;
  if not found then return; end if;
  v_dur := make_interval(mins => v_minutes);
  v_earliest := now() + make_interval(hours => c.booking_lead_hours);

  if p_day < (now() at time zone c.timezone)::date
     or p_day > (now() at time zone c.timezone)::date + c.booking_horizon_days then
    return;
  end if;

  if not exists (
    select 1 from public.memberships m
     where m.clinic_id = c.id and m.user_id = p_practitioner_id and m.is_active
  ) then return; end if;

  select * into v_exception from public.schedule_exceptions e
   where e.practitioner_id = p_practitioner_id and e.date = p_day;

  for v_open in
    select start_time, end_time
      from (
        select e.start_time, e.end_time
          from public.schedule_exceptions e
         where e.practitioner_id = p_practitioner_id and e.date = p_day
           and not e.is_closed and e.start_time is not null and e.end_time is not null
        union all
        select s.start_time, s.end_time
          from public.practitioner_schedules s
         where s.practitioner_id = p_practitioner_id and s.is_active
           and s.weekday = extract(dow from p_day)::int
           and v_exception.id is null
      ) open
     order by start_time
  loop
    v_ts := (p_day + v_open.start_time) at time zone c.timezone;
    v_end := (p_day + v_open.end_time) at time zone c.timezone;
    while v_ts + v_dur <= v_end loop
      if v_ts >= v_earliest
         and not exists (
           select 1 from public.schedule_blocks b
            where b.practitioner_id = p_practitioner_id
              and b.start_at < v_ts + v_dur and b.end_at > v_ts
         )
         and not exists (
           select 1 from public.appointments a
            where a.practitioner_id = p_practitioner_id
              and a.status <> 'cancelled'
              and a.start_at < v_ts + v_dur and a.end_at > v_ts
         )
      then
        return next v_ts;
      end if;
      v_ts := v_ts + interval '15 minutes';
    end loop;
  end loop;
  return;
end;
$$;

revoke all on function public.booking_slots(text, uuid, uuid, date) from public;
grant execute on function public.booking_slots(text, uuid, uuid, date) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- The code, when the clinic asks for one
-- ---------------------------------------------------------------------------
create or replace function public.booking_send_code(p_slug text, p_phone text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.clinics%rowtype;
  v_phone text := public.phone_digits(p_phone);
  v_code text;
begin
  select * into c from public.clinics where booking_slug = lower(btrim(p_slug)) and booking_enabled;
  if not found or not c.booking_verify_sms then return false; end if;
  if length(v_phone) < 8 then raise exception 'bad_phone' using errcode = '22023'; end if;

  -- Three an hour to one number. More than that is not a person.
  if (select count(*) from public.booking_codes k
       where k.clinic_id = c.id and k.phone = v_phone and k.created_at > now() - interval '1 hour') >= 3 then
    raise exception 'too_many' using errcode = '54000';
  end if;

  v_code := lpad((floor(random() * 1000000))::int::text, 6, '0');

  insert into public.booking_codes (clinic_id, phone, code_hash, expires_at)
  values (c.id, v_phone, crypt(v_code, gen_salt('bf')), now() + interval '10 minutes');

  insert into public.message_log (clinic_id, channel, template_key, recipient, body, status)
  values (c.id, 'sms', 'booking_code', p_phone,
          case when c.default_locale = 'en'
            then c.name || ': your verification code is ' || v_code
            else c.name || ': קוד האימות שלך הוא ' || v_code
          end,
          'queued');
  return true;
end;
$$;

revoke all on function public.booking_send_code(text, text) from public;
grant execute on function public.booking_send_code(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- The booking itself
-- ---------------------------------------------------------------------------
-- A known number joins its file; a new one opens one, marked as having come
-- from the page. The appointment is written as a booking is written from the
-- diary, with the same constraints, so the diary and the page can never
-- disagree about whether an hour was free.
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

  select p.id into v_patient from public.patients p
   where p.clinic_id = c.id and public.phone_digits(p.phone) = v_phone
   order by p.is_active desc, p.created_at limit 1;

  if v_patient is null then
    insert into public.patients (clinic_id, first_name, last_name, phone, email, preferred_locale, created_via)
    values (c.id, btrim(p_first_name), nullif(btrim(coalesce(p_last_name, '')), ''), btrim(p_phone),
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
  'The public booking page''s one write. Joins a known phone number to its file or opens a new one, and books the hour under the diary''s own constraints.';
