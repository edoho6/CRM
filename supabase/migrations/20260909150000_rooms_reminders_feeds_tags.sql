-- ============================================================================
-- 30 · Rooms, arrival confirmations, calendar feeds, patient tags
-- ============================================================================
-- Four things a diary needs once a practice is busy enough to have more than
-- one bed, and which are all about the same booking row:
--
--   rooms          — a practitioner treating in two rooms at once is not
--                    double-booked; a room holding two people at once is.
--   confirmations  — a link the patient taps to say "I am coming" (or not),
--                    so the calendar can show it in colour instead of the
--                    practitioner ringing round the night before.
--   calendar feeds — a private iCalendar URL per practitioner, which Google
--                    Calendar and the iPhone both subscribe to. One-way, no
--                    OAuth, no third-party app registration.
--   patient tags   — free labels on a file ("headaches", "diabetic", "stopped
--                    after two"), editable in one place, clickable everywhere.
--
-- The two public functions at the end are the only way in without a session.
-- They are SECURITY DEFINER, take a random 122-bit token, and return the least
-- that the page or the feed needs. Nothing here adds a service key anywhere.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Rooms
-- ---------------------------------------------------------------------------
create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null default public.current_clinic_id() references public.clinics(id) on delete cascade,
  name text not null,
  color text not null default '#64748b' check (color ~ '^#[0-9a-fA-F]{6}$'),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rooms_name_not_blank check (length(btrim(name)) > 0),
  constraint rooms_name_unique unique (clinic_id, name)
);

create index if not exists rooms_clinic_idx on public.rooms (clinic_id, is_active, sort_order);

drop trigger if exists rooms_set_updated_at on public.rooms;
create trigger rooms_set_updated_at
  before update on public.rooms
  for each row execute function public.set_updated_at();

alter table public.rooms enable row level security;

drop policy if exists rooms_staff_all on public.rooms;
create policy rooms_staff_all on public.rooms
  for all using (public.is_clinic_member(clinic_id))
  with check (public.is_clinic_member(clinic_id));

comment on table public.rooms is
  'Treatment rooms (or branches). A booking in a room is a booking of the room, so two practitioners cannot share one at the same hour, and one practitioner can hold two rooms at once.';

-- ---------------------------------------------------------------------------
-- Appointments: the room, and the confirmation trail
-- ---------------------------------------------------------------------------
alter table public.appointments
  add column if not exists room_id uuid references public.rooms(id) on delete set null,
  add column if not exists reminder_sent_at timestamptz,
  add column if not exists confirmation_token uuid not null default gen_random_uuid(),
  add column if not exists confirmation_response text
    check (confirmation_response in ('confirmed', 'declined')),
  add column if not exists responded_at timestamptz;

create unique index if not exists appointments_confirmation_token_idx
  on public.appointments (confirmation_token);

create index if not exists appointments_room_idx
  on public.appointments (clinic_id, room_id, start_at)
  where room_id is not null;

/*
 * The double-booking guard, now in two halves.
 *
 * Without a room, a practitioner is one person and two bookings at one hour
 * are a clash — exactly as before. With rooms, the thing that cannot be in two
 * places is the room: a practitioner running two beds books both, and the
 * constraint moves to the room so that nobody else can be put in it either.
 *
 * Known gap, accepted: a room-less booking and a roomed booking for the same
 * practitioner at the same hour do not clash. Once a clinic has rooms the
 * dialog always sets one, so this only concerns bookings made before rooms
 * existed, and those are in the past.
 */
alter table public.appointments drop constraint if exists appointments_no_overlap;
alter table public.appointments
  add constraint appointments_no_overlap
  exclude using gist (
    practitioner_id with =,
    tstzrange(start_at, end_at) with &&
  ) where (status <> 'cancelled' and room_id is null);

alter table public.appointments drop constraint if exists appointments_room_no_overlap;
alter table public.appointments
  add constraint appointments_room_no_overlap
  exclude using gist (
    room_id with =,
    tstzrange(start_at, end_at) with &&
  ) where (status <> 'cancelled' and room_id is not null);

comment on column public.appointments.confirmation_token is
  'Random capability in the reminder link. Whoever holds it can say whether this one appointment will be kept — nothing else.';

-- ---------------------------------------------------------------------------
-- The reminder wording, per clinic
-- ---------------------------------------------------------------------------
-- Null means "use the built-in text in the patient''s language". Placeholders
-- are filled in the app: {name} {date} {time} {clinic} {link}.
alter table public.clinics
  add column if not exists reminder_template text;

-- ---------------------------------------------------------------------------
-- Public: the confirmation page
-- ---------------------------------------------------------------------------
-- What the page shows before the patient answers. First name only, and only
-- for an appointment that is not long gone: a link forwarded months later
-- should open onto nothing.
create or replace function public.appointment_by_token(p_token uuid)
returns table (
  start_at timestamptz,
  end_at timestamptz,
  status text,
  confirmation_response text,
  clinic_name text,
  clinic_phone text,
  clinic_address text,
  practitioner_name text,
  patient_first_name text,
  type_name_he text,
  type_name_en text,
  room_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    a.start_at,
    a.end_at,
    a.status,
    a.confirmation_response,
    c.name,
    c.phone,
    c.address,
    pr.full_name,
    p.first_name,
    t.name_he,
    t.name_en,
    r.name
  from public.appointments a
  join public.clinics c on c.id = a.clinic_id
  join public.patients p on p.id = a.patient_id
  left join public.profiles pr on pr.id = a.practitioner_id
  left join public.appointment_types t on t.id = a.appointment_type_id
  left join public.rooms r on r.id = a.room_id
  where a.confirmation_token = p_token
    and a.end_at > now() - interval '1 day';
$$;

revoke all on function public.appointment_by_token(uuid) from public;
grant execute on function public.appointment_by_token(uuid) to anon, authenticated;

-- The answer. "Confirmed" also moves a merely scheduled booking to confirmed,
-- so the status the practitioner already knows follows without a second step.
-- "Declined" changes nothing but the response: cancelling is the
-- practitioner's decision, made after seeing the red mark.
create or replace function public.respond_to_appointment(p_token uuid, p_response text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_response not in ('confirmed', 'declined') then
    raise exception 'invalid_response';
  end if;

  update public.appointments
     set confirmation_response = p_response,
         responded_at = now(),
         status = case
           when p_response = 'confirmed' and status = 'scheduled' then 'confirmed'
           else status
         end
   where confirmation_token = p_token
     and status in ('scheduled', 'confirmed')
     and end_at > now() - interval '1 day'
  returning id into v_id;

  return v_id is not null;
end;
$$;

revoke all on function public.respond_to_appointment(uuid, text) from public;
grant execute on function public.respond_to_appointment(uuid, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Calendar feeds
-- ---------------------------------------------------------------------------
create table if not exists public.calendar_feeds (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null default public.current_clinic_id() references public.clinics(id) on delete cascade,
  practitioner_id uuid not null references public.profiles(id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now(),
  last_fetched_at timestamptz,
  constraint calendar_feeds_one_per_practitioner unique (clinic_id, practitioner_id)
);

alter table public.calendar_feeds enable row level security;

-- The token is the whole secret, so only its owner may read the row — a
-- colleague in the same clinic has no reason to see it.
drop policy if exists calendar_feeds_own on public.calendar_feeds;
create policy calendar_feeds_own on public.calendar_feeds
  for all using (practitioner_id = auth.uid() and public.is_clinic_member(clinic_id))
  with check (practitioner_id = auth.uid() and public.is_clinic_member(clinic_id));

comment on table public.calendar_feeds is
  'One private iCalendar subscription URL per practitioner. Regenerating the token is how a leaked URL is revoked.';

-- Everything the feed lists. Sixty days back so a phone shows last month,
-- and a long way forward so a course booked for the year appears in full.
create or replace function public.calendar_feed_events(p_token uuid)
returns table (
  id uuid,
  start_at timestamptz,
  end_at timestamptz,
  status text,
  patient_name text,
  patient_phone text,
  type_name_he text,
  type_name_en text,
  room_name text,
  notes text,
  updated_at timestamptz,
  clinic_name text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_feed public.calendar_feeds%rowtype;
begin
  select * into v_feed from public.calendar_feeds f where f.token = p_token;
  -- An unknown token is an error rather than an empty diary, so the feed
  -- route can answer 404 and count the attempt — and so a subscriber whose
  -- address was regenerated is told, instead of quietly shown nothing.
  if not found then
    raise exception 'unknown_feed_token' using errcode = 'P0002';
  end if;

  update public.calendar_feeds set last_fetched_at = now() where calendar_feeds.id = v_feed.id;

  return query
    select
      a.id,
      a.start_at,
      a.end_at,
      a.status,
      p.full_name,
      p.phone,
      t.name_he,
      t.name_en,
      r.name,
      a.notes,
      a.updated_at,
      c.name
    from public.appointments a
    join public.patients p on p.id = a.patient_id
    join public.clinics c on c.id = a.clinic_id
    left join public.appointment_types t on t.id = a.appointment_type_id
    left join public.rooms r on r.id = a.room_id
    where a.clinic_id = v_feed.clinic_id
      and a.practitioner_id = v_feed.practitioner_id
      and a.status <> 'cancelled'
      and a.start_at > now() - interval '60 days'
      and a.start_at < now() + interval '400 days'
    order by a.start_at;
end;
$$;

revoke all on function public.calendar_feed_events(uuid) from public;
grant execute on function public.calendar_feed_events(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Patient tags
-- ---------------------------------------------------------------------------
create table if not exists public.patient_tags (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null default public.current_clinic_id() references public.clinics(id) on delete cascade,
  name text not null,
  -- A named tone rather than a hex: the app maps it to its own palette in
  -- both themes, and "amber" still means amber in dark mode.
  color text not null default 'ink'
    check (color in ('ink', 'jade', 'sky', 'amber', 'red')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint patient_tags_name_not_blank check (length(btrim(name)) > 0)
);

-- "Headaches" and "headaches " are the same tag.
create unique index if not exists patient_tags_unique_name
  on public.patient_tags (clinic_id, lower(btrim(name)));

drop trigger if exists patient_tags_set_updated_at on public.patient_tags;
create trigger patient_tags_set_updated_at
  before update on public.patient_tags
  for each row execute function public.set_updated_at();

alter table public.patient_tags enable row level security;

drop policy if exists patient_tags_staff_all on public.patient_tags;
create policy patient_tags_staff_all on public.patient_tags
  for all using (public.is_clinic_member(clinic_id))
  with check (public.is_clinic_member(clinic_id));

create table if not exists public.patient_tag_links (
  -- A surrogate id only so the audit trigger has a record id to write.
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null default public.current_clinic_id() references public.clinics(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  tag_id uuid not null references public.patient_tags(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint patient_tag_links_once unique (patient_id, tag_id)
);

create index if not exists patient_tag_links_tag_idx
  on public.patient_tag_links (clinic_id, tag_id);

-- Putting "did not respond to treatment" on a file is a statement about a
-- patient, and belongs in the same log as every other change to their record.
drop trigger if exists patient_tag_links_audit on public.patient_tag_links;
create trigger patient_tag_links_audit
  after insert or delete on public.patient_tag_links
  for each row execute function public.write_audit_log();

alter table public.patient_tag_links enable row level security;

drop policy if exists patient_tag_links_staff_all on public.patient_tag_links;
create policy patient_tag_links_staff_all on public.patient_tag_links
  for all using (public.is_clinic_member(clinic_id))
  with check (public.is_clinic_member(clinic_id));

comment on table public.patient_tags is
  'Free labels a clinic puts on patient files. Edited in one place; a click on any tag lists everyone who carries it.';

-- ---------------------------------------------------------------------------
-- Tasks: a moment, and how to be told
-- ---------------------------------------------------------------------------
-- `due_on` stays the day the list sorts by. `due_at` is the instant the alert
-- fires, when the task has one. `remind_via` keeps the choice for all three
-- channels, but only `app` can fire without a sending provider — the bell in
-- the header, and a browser notification if the person allowed it.
-- `reminded_at` is what stops the same alert firing on every poll and in every
-- open tab.
alter table public.clinic_tasks
  add column if not exists due_at timestamptz,
  add column if not exists remind_via text not null default 'app'
    check (remind_via in ('app', 'email', 'sms')),
  add column if not exists reminded_at timestamptz;

create index if not exists clinic_tasks_due_idx
  on public.clinic_tasks (clinic_id, due_at)
  where done_at is null and due_at is not null;

-- ---------------------------------------------------------------------------
-- Patients, with what the diary knows about them
-- ---------------------------------------------------------------------------
-- "Who has no next appointment" is a question about every active file at
-- once, and answering it in the app would mean fetching every booking. Two
-- correlated lookups per row instead, so the list can filter on the answer.
--
-- `security_invoker` makes the view read as the caller: the row-level rules on
-- `patients` and `appointments` apply exactly as they do on the tables.
-- `p.*` is frozen at creation — a column added to `patients` later needs this
-- view recreated before it shows through.
drop view if exists public.patients_with_diary;
create view public.patients_with_diary
with (security_invoker = true) as
select
  p.*,
  (select min(a.start_at) from public.appointments a
     where a.patient_id = p.id
       and a.start_at >= now()
       and a.status not in ('cancelled', 'no_show')) as next_appointment_at,
  (select max(a.start_at) from public.appointments a
     where a.patient_id = p.id
       and a.start_at < now()
       and a.status not in ('cancelled', 'no_show')) as last_appointment_at
from public.patients p;

comment on view public.patients_with_diary is
  'patients plus the next and the last kept appointment. Reads as the caller. Filter on next_appointment_at is null for the people nobody has booked again.';
