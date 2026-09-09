-- ============================================================================
-- 33 · Locations: the clinics a practitioner works in
-- ============================================================================
-- One account, several addresses: Tuesdays in Haifa, Thursdays in Tel Aviv.
-- A location is where a booking happens; a room is a bed inside one. The
-- free-text `appointments.location` stays for what was typed before, and the
-- new column is the structured answer that a booking page and a printed
-- confirmation can rely on.
-- ============================================================================

create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null default public.current_clinic_id() references public.clinics(id) on delete cascade,
  name text not null,
  address text,
  color text not null default '#64748b' check (color ~ '^#[0-9a-fA-F]{6}$'),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint locations_name_not_blank check (length(btrim(name)) > 0),
  constraint locations_name_unique unique (clinic_id, name)
);

create index if not exists locations_clinic_idx on public.locations (clinic_id, is_active, sort_order);

drop trigger if exists locations_set_updated_at on public.locations;
create trigger locations_set_updated_at
  before update on public.locations
  for each row execute function public.set_updated_at();

alter table public.locations enable row level security;

drop policy if exists locations_staff_all on public.locations;
create policy locations_staff_all on public.locations
  for all using (public.is_clinic_member(clinic_id))
  with check (public.is_clinic_member(clinic_id));

-- A room belongs to a location, when the practice has more than one.
alter table public.rooms
  add column if not exists location_id uuid references public.locations(id) on delete set null;

alter table public.appointments
  add column if not exists location_id uuid references public.locations(id) on delete set null;

create index if not exists appointments_location_idx
  on public.appointments (clinic_id, location_id, start_at)
  where location_id is not null;

comment on table public.locations is
  'The addresses a practice works from. A booking names one; a room sits inside one.';
