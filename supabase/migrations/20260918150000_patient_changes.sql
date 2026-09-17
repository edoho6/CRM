-- ============================================================================
-- 75 · Moving or cancelling an appointment from the reminder link
-- ============================================================================
-- The reminder's link (/confirm/<token>) answered "I'll come" or "I won't", and
-- "I won't" changed nothing but a red mark: the hour stayed taken, and finding
-- another one meant a phone call. A clinic may now let the patient do both from
-- the link — pick another free hour, or cancel — up to a notice it sets.
--
--   · Off by default, per clinic (clinics.patient_changes_enabled), with the
--     notice in hours (patient_changes_notice_hours, default 24). Inside the
--     notice the page says to call, and "I won't" still only marks.
--   · Another hour is offered only where the booking page could offer one: the
--     clinic's online booking is on and the treatment is bookable online. The
--     free hours are booking_slots' own, so the page and the diary agree; a
--     clinic without online booking lets the patient cancel only.
--   · The token is the whole credential, as for the answer itself. Each change
--     leaves the clinic a task naming the patient and both hours, so a move is
--     never discovered by looking at the diary.
-- ============================================================================

alter table public.clinics
  add column if not exists patient_changes_enabled boolean not null default false,
  add column if not exists patient_changes_notice_hours integer not null default 24
    check (patient_changes_notice_hours between 0 and 168);

-- What the link may do with this appointment, and why not when it may not.
create or replace function public.appointment_change_options(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'can_cancel', ok,
    'can_move', ok and movable,
    'reason', case
      when not c.patient_changes_enabled then 'disabled'
      when a.status not in ('scheduled', 'confirmed') then 'closed'
      when a.start_at - now() < make_interval(hours => c.patient_changes_notice_hours) then 'too_late'
    end,
    'notice_hours', c.patient_changes_notice_hours,
    'horizon_days', c.booking_horizon_days
  )
  from public.appointments a
  join public.clinics c on c.id = a.clinic_id
  left join public.appointment_types t on t.id = a.appointment_type_id
  cross join lateral (
    select c.patient_changes_enabled
           and a.status in ('scheduled', 'confirmed')
           and a.start_at - now() >= make_interval(hours => c.patient_changes_notice_hours) as ok,
           coalesce(c.booking_enabled and c.booking_slug is not null and t.is_active and t.online_bookable, false) as movable
  ) x
  where a.confirmation_token = p_token
    and a.end_at > now() - interval '1 day';
$$;

-- The free hours of a day for this appointment's treatment and practitioner.
create or replace function public.appointment_change_slots(p_token uuid, p_day date)
returns setof timestamptz
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  a public.appointments%rowtype;
  c public.clinics%rowtype;
begin
  select * into a from public.appointments where confirmation_token = p_token;
  if not found then return; end if;
  select * into c from public.clinics where id = a.clinic_id;
  if not coalesce((public.appointment_change_options(p_token) ->> 'can_move')::boolean, false) then return; end if;
  return query select s from public.booking_slots(c.booking_slug, a.appointment_type_id, a.practitioner_id, p_day) s;
end;
$$;

create or replace function public.move_appointment_by_token(p_token uuid, p_start_at timestamptz)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  a public.appointments%rowtype;
  c public.clinics%rowtype;
  v_name text;
begin
  select * into a from public.appointments where confirmation_token = p_token for update;
  if not found then return false; end if;
  select * into c from public.clinics where id = a.clinic_id;
  if not coalesce((public.appointment_change_options(p_token) ->> 'can_move')::boolean, false) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.booking_slots(c.booking_slug, a.appointment_type_id, a.practitioner_id,
                                       (p_start_at at time zone c.timezone)::date) s
     where s = p_start_at
  ) then raise exception 'slot_taken' using errcode = '23P01'; end if;

  update public.appointments
     set start_at = p_start_at,
         end_at = p_start_at + (a.end_at - a.start_at),
         status = 'confirmed',
         confirmation_response = 'confirmed',
         responded_at = now()
   where id = a.id;

  select coalesce(p.full_name, p.first_name) into v_name from public.patients p where p.id = a.patient_id;
  insert into public.clinic_tasks (clinic_id, title, notes, due_on, patient_id)
  values (
    c.id,
    case when c.default_locale = 'en' then 'Appointment moved: ' || v_name else 'תור הועבר: ' || v_name end,
    case when c.default_locale = 'en'
         then 'From ' || to_char(a.start_at at time zone c.timezone, 'DD/MM HH24:MI') || ' to ' || to_char(p_start_at at time zone c.timezone, 'DD/MM HH24:MI') || ', from the reminder link.'
         else 'מ-' || to_char(a.start_at at time zone c.timezone, 'DD/MM HH24:MI') || ' ל-' || to_char(p_start_at at time zone c.timezone, 'DD/MM HH24:MI') || ', מהקישור שבתזכורת.' end,
    (now() at time zone c.timezone)::date,
    a.patient_id
  );
  return true;
exception
  when exclusion_violation then
    raise exception 'slot_taken' using errcode = '23P01';
end;
$$;

create or replace function public.cancel_appointment_by_token(p_token uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  a public.appointments%rowtype;
  c public.clinics%rowtype;
  v_name text;
begin
  select * into a from public.appointments where confirmation_token = p_token for update;
  if not found then return false; end if;
  select * into c from public.clinics where id = a.clinic_id;
  if not coalesce((public.appointment_change_options(p_token) ->> 'can_cancel')::boolean, false) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  update public.appointments
     set status = 'cancelled',
         cancelled_reason = case when c.default_locale = 'en' then 'Cancelled by the patient from the reminder link' else 'בוטל על ידי המטופל מהקישור שבתזכורת' end,
         confirmation_response = 'declined',
         responded_at = now()
   where id = a.id;

  select coalesce(p.full_name, p.first_name) into v_name from public.patients p where p.id = a.patient_id;
  insert into public.clinic_tasks (clinic_id, title, notes, due_on, patient_id)
  values (
    c.id,
    case when c.default_locale = 'en' then 'Appointment cancelled: ' || v_name else 'תור בוטל: ' || v_name end,
    case when c.default_locale = 'en'
         then to_char(a.start_at at time zone c.timezone, 'DD/MM HH24:MI') || ', from the reminder link. The hour is free again.'
         else to_char(a.start_at at time zone c.timezone, 'DD/MM HH24:MI') || ', מהקישור שבתזכורת. השעה התפנתה.' end,
    (now() at time zone c.timezone)::date,
    a.patient_id
  );
  return true;
end;
$$;

revoke all on function public.appointment_change_options(uuid) from public;
revoke all on function public.appointment_change_slots(uuid, date) from public;
revoke all on function public.move_appointment_by_token(uuid, timestamptz) from public;
revoke all on function public.cancel_appointment_by_token(uuid) from public;
grant execute on function public.appointment_change_options(uuid) to anon, authenticated;
grant execute on function public.appointment_change_slots(uuid, date) to anon, authenticated;
grant execute on function public.move_appointment_by_token(uuid, timestamptz) to anon, authenticated;
grant execute on function public.cancel_appointment_by_token(uuid) to anon, authenticated;
