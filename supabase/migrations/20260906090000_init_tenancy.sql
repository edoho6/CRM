-- ============================================================================
-- 01 · Tenancy foundation
-- ============================================================================
-- Every table in this system is scoped by `clinic_id` and protected by Row Level
-- Security, even though only one clinic exists today. That is deliberate: it is the
-- mechanism that lets this become a multi-clinic product later without a schema
-- rewrite, and it means a bug in application code cannot leak another clinic's
-- medical records.
-- ============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "btree_gist";

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- clinics
-- ---------------------------------------------------------------------------

create table if not exists public.clinics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  timezone text not null default 'Asia/Jerusalem',
  default_locale text not null default 'he' check (default_locale in ('he', 'en')),
  address text,
  phone text,
  email text,
  tax_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger clinics_set_updated_at
  before update on public.clinics
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- profiles — one row per auth user (staff and patients alike)
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  preferred_locale text not null default 'he' check (preferred_locale in ('he', 'en')),
  avatar_url text,
  title text,
  license_number text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-create a profile whenever someone signs up, so no code path has to remember to.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, preferred_locale)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'preferred_locale', 'he')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- memberships — which users belong to which clinic, and in what role
-- ---------------------------------------------------------------------------
-- Milestone 1 only ever creates a single `owner` row, but modelling it as a join
-- table now is what makes multi-practitioner (M7) and multi-clinic (M8) additive.

create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'practitioner'
    check (role in ('owner', 'practitioner', 'staff', 'assistant')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (clinic_id, user_id)
);

create index if not exists memberships_user_idx on public.memberships (user_id) where is_active;

-- ---------------------------------------------------------------------------
-- Tenancy functions used by every RLS policy in the system
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER is required: these read `memberships`, and a policy on
-- `memberships` that called a function which itself queried `memberships` would
-- recurse. Definer rights break that cycle.

create or replace function public.current_clinic_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select m.clinic_id
  from public.memberships m
  where m.user_id = auth.uid()
    and m.is_active
  order by m.created_at
  limit 1;
$$;

comment on function public.current_clinic_id() is
  'The clinic the signed-in staff user belongs to. Used as a column default and inside every RLS policy. When multi-clinic support lands (M8) this reads the active clinic from a JWT claim instead.';

create or replace function public.is_clinic_member(target_clinic uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memberships m
    where m.user_id = auth.uid()
      and m.clinic_id = target_clinic
      and m.is_active
  );
$$;

create or replace function public.has_clinic_role(target_clinic uuid, allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memberships m
    where m.user_id = auth.uid()
      and m.clinic_id = target_clinic
      and m.is_active
      and m.role = any(allowed_roles)
  );
$$;

comment on function public.has_clinic_role(uuid, text[]) is
  'Role gate for Milestone 7. Policies can tighten from is_clinic_member() to this without restructuring.';

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.clinics enable row level security;
alter table public.profiles enable row level security;
alter table public.memberships enable row level security;

-- Clinics: members read and update their own clinic.
drop policy if exists clinics_select on public.clinics;
create policy clinics_select on public.clinics
  for select using (public.is_clinic_member(id));

drop policy if exists clinics_update on public.clinics;
create policy clinics_update on public.clinics
  for update using (public.has_clinic_role(id, array['owner']))
  with check (public.has_clinic_role(id, array['owner']));

-- Profiles: everyone reads their own; clinic staff read each other's.
drop policy if exists profiles_select_self on public.profiles;
create policy profiles_select_self on public.profiles
  for select using (id = auth.uid());

drop policy if exists profiles_select_colleagues on public.profiles;
create policy profiles_select_colleagues on public.profiles
  for select using (
    exists (
      select 1
      from public.memberships mine
      join public.memberships theirs on theirs.clinic_id = mine.clinic_id
      where mine.user_id = auth.uid()
        and mine.is_active
        and theirs.user_id = public.profiles.id
        and theirs.is_active
    )
  );

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- Memberships: a user sees their own rows. Non-recursive on purpose.
drop policy if exists memberships_select_self on public.memberships;
create policy memberships_select_self on public.memberships
  for select using (user_id = auth.uid());

drop policy if exists memberships_select_clinic on public.memberships;
create policy memberships_select_clinic on public.memberships
  for select using (public.is_clinic_member(clinic_id));

drop policy if exists memberships_manage on public.memberships;
create policy memberships_manage on public.memberships
  for all using (public.has_clinic_role(clinic_id, array['owner']))
  with check (public.has_clinic_role(clinic_id, array['owner']));
