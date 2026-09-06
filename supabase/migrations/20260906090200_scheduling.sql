-- ============================================================================
-- 04 · Scheduling
-- ============================================================================
-- The double-booking rule is enforced by a Postgres exclusion constraint rather
-- than by a check in application code. Two requests arriving at the same instant
-- cannot both pass a "is this slot free?" query, so the guarantee has to live in
-- the database — and it then covers the calendar UI, future online booking, and
-- any manual SQL equally.
-- ============================================================================

create table if not exists public.appointment_types (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null default public.current_clinic_id() references public.clinics(id) on delete cascade,
  name_he text not null,
  name_en text not null,
  default_duration_minutes integer not null default 60
    check (default_duration_minutes between 5 and 480),
  color text not null default '#0ea5e9' check (color ~ '^#[0-9a-fA-F]{6}$'),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists appointment_types_clinic_idx
  on public.appointment_types (clinic_id, is_active, sort_order);

-- ---------------------------------------------------------------------------
-- Recurring weekly availability
-- ---------------------------------------------------------------------------
-- weekday follows Postgres `extract(dow)`: 0 = Sunday, which is the start of the
-- working week in Israel.

create table if not exists public.practitioner_schedules (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null default public.current_clinic_id() references public.clinics(id) on delete cascade,
  practitioner_id uuid not null references public.profiles(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  check (end_time > start_time)
);

create index if not exists practitioner_schedules_lookup_idx
  on public.practitioner_schedules (clinic_id, practitioner_id, weekday) where is_active;

-- Holidays, time off, and one-off changed hours.
create table if not exists public.schedule_exceptions (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null default public.current_clinic_id() references public.clinics(id) on delete cascade,
  practitioner_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  is_closed boolean not null default true,
  start_time time,
  end_time time,
  reason text,
  created_at timestamptz not null default now(),
  unique (practitioner_id, date),
  check (is_closed or (start_time is not null and end_time is not null and end_time > start_time))
);

-- ---------------------------------------------------------------------------
-- appointments
-- ---------------------------------------------------------------------------

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null default public.current_clinic_id() references public.clinics(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  practitioner_id uuid not null references public.profiles(id) on delete restrict,
  appointment_type_id uuid references public.appointment_types(id) on delete set null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'confirmed', 'checked_in', 'completed', 'cancelled', 'no_show')),
  location text,
  notes text,
  cancelled_reason text,
  cancelled_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appointments_end_after_start check (end_at > start_at)
);

create index if not exists appointments_calendar_idx
  on public.appointments (clinic_id, practitioner_id, start_at);

create index if not exists appointments_patient_idx
  on public.appointments (clinic_id, patient_id, start_at desc);

-- The double-booking guard. Cancelled appointments release their slot.
alter table public.appointments
  drop constraint if exists appointments_no_overlap;

alter table public.appointments
  add constraint appointments_no_overlap
  exclude using gist (
    practitioner_id with =,
    tstzrange(start_at, end_at) with &&
  ) where (status <> 'cancelled');

create trigger appointments_set_updated_at
  before update on public.appointments
  for each row execute function public.set_updated_at();

-- Stamp the cancellation time automatically so reporting never depends on the UI
-- remembering to set it.
create or replace function public.stamp_appointment_cancellation()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'cancelled' and coalesce(old.status, '') <> 'cancelled' then
    new.cancelled_at := now();
  elsif new.status <> 'cancelled' then
    new.cancelled_at := null;
    new.cancelled_reason := null;
  end if;
  return new;
end;
$$;

create trigger appointments_stamp_cancellation
  before update on public.appointments
  for each row execute function public.stamp_appointment_cancellation();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.appointment_types enable row level security;
alter table public.practitioner_schedules enable row level security;
alter table public.schedule_exceptions enable row level security;
alter table public.appointments enable row level security;

drop policy if exists appointment_types_staff_all on public.appointment_types;
create policy appointment_types_staff_all on public.appointment_types
  for all using (public.is_clinic_member(clinic_id))
  with check (public.is_clinic_member(clinic_id));

drop policy if exists practitioner_schedules_staff_all on public.practitioner_schedules;
create policy practitioner_schedules_staff_all on public.practitioner_schedules
  for all using (public.is_clinic_member(clinic_id))
  with check (public.is_clinic_member(clinic_id));

drop policy if exists schedule_exceptions_staff_all on public.schedule_exceptions;
create policy schedule_exceptions_staff_all on public.schedule_exceptions
  for all using (public.is_clinic_member(clinic_id))
  with check (public.is_clinic_member(clinic_id));

drop policy if exists appointments_staff_all on public.appointments;
create policy appointments_staff_all on public.appointments
  for all using (public.is_clinic_member(clinic_id))
  with check (public.is_clinic_member(clinic_id));
