-- ============================================================================
--  The website and the desk cannot both take the same hour
-- ============================================================================
--  Two constraints keep the diary from double-booking: without a room, one
--  practitioner cannot be in two places (appointments_no_overlap); with rooms,
--  one room cannot (appointments_room_no_overlap). The gap between them is
--  deliberate — a practitioner running two beds books both from the desk.
--
--  But the booking page and the "move my appointment" link check that an hour is
--  free (booking_slots) and only then write, and in that instant the desk could
--  put the same practitioner into a room at the same hour: the room-less booking
--  and the roomed one match neither constraint, and both were kept.
--
--  So every write that sets an appointment's time takes a short lock per
--  practitioner, and a write from the public pages (flagged by the transaction
--  setting `herbalist.online_booking`, which booking_request already sets)
--  checks again inside it, against every appointment of that practitioner, in
--  a room or not. The desk takes the lock too — that is what makes the check
--  see a desk booking that is being saved at that moment — but is never
--  refused by it: two beds at one hour stays the desk's choice.
--
--  The refusal is raised as exclusion_violation, which booking_request and
--  move_appointment_by_token already turn into "that hour was just taken".
-- ============================================================================

create or replace function public.appointments_public_overlap_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.practitioner_id is null then
    return new;
  end if;

  -- Released at the end of the transaction. Waits only for another write of
  -- the same practitioner's diary — a desk save is milliseconds.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('appointments:' || new.practitioner_id::text, 0)
  );

  if new.status = 'cancelled'
     or coalesce(pg_catalog.current_setting('herbalist.online_booking', true), '') <> 'on' then
    return new;
  end if;

  if exists (
    select 1
      from public.appointments a
     where a.practitioner_id = new.practitioner_id
       and a.id <> new.id
       and a.status <> 'cancelled'
       and a.start_at < new.end_at
       and a.end_at > new.start_at
  ) then
    raise exception 'slot_taken' using errcode = '23P01';
  end if;
  return new;
end;
$$;

revoke all on function public.appointments_public_overlap_guard() from public, anon, authenticated;

drop trigger if exists appointments_public_overlap_guard on public.appointments;
create trigger appointments_public_overlap_guard
  before insert or update of start_at, end_at, practitioner_id, status on public.appointments
  for each row execute function public.appointments_public_overlap_guard();

-- The move from the reminder link is a public write too: the same flag, around
-- its update only. Otherwise as in migration 75, with 20260919090000's reset of
-- the reminder left to the appointment_rescheduled trigger.
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

  perform set_config('herbalist.online_booking', 'on', true);
  update public.appointments
     set start_at = p_start_at,
         end_at = p_start_at + (a.end_at - a.start_at),
         status = 'confirmed',
         confirmation_response = 'confirmed',
         responded_at = now()
   where id = a.id;
  perform set_config('herbalist.online_booking', '', true);

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
    perform set_config('herbalist.online_booking', '', true);
    raise exception 'slot_taken' using errcode = '23P01';
end;
$$;
