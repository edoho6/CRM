-- ============================================================================
-- 31 · Self-service sign-up, and the platform view
-- ============================================================================
-- Until now a clinic came into being by hand, in SQL. With many separate
-- clinics — each its own practitioner, its own patients, nothing shared — the
-- first clinic a person sees has to be the one they made themselves, in the
-- minute after signing up.
--
-- Two things:
--
--   create_clinic_for_current_user — the only way the app makes a clinic. It
--     runs as the database owner because the caller has no clinic yet and so
--     no row-level rule lets them write one; it writes exactly one clinic and
--     one owner membership for the signed-in user, and refuses for anyone who
--     already belongs somewhere or who is a portal patient.
--
--   platform_admins — the short list of people who run the service, and a
--     read-only overview of every clinic for them. Membership of this list is
--     granted in SQL, never from the app: an owner of one clinic must have no
--     way to promote themselves to see the others.
-- ============================================================================

create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.platform_admins enable row level security;

-- A person may see whether they are on the list, and nothing more. There is
-- no insert or update policy at all: the list is written in the SQL editor.
drop policy if exists platform_admins_self on public.platform_admins;
create policy platform_admins_self on public.platform_admins
  for select using (user_id = auth.uid());

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.platform_admins a where a.user_id = auth.uid());
$$;

revoke all on function public.is_platform_admin() from public;
grant execute on function public.is_platform_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- The first clinic
-- ---------------------------------------------------------------------------
create or replace function public.create_clinic_for_current_user(p_name text, p_phone text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clinic uuid;
  v_name text := btrim(coalesce(p_name, ''));
begin
  if auth.uid() is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  if length(v_name) = 0 or length(v_name) > 120 then
    raise exception 'name_required' using errcode = '22023';
  end if;
  -- One clinic per account, made once. A second call is a repeated click,
  -- not a second practice.
  if exists (select 1 from public.memberships m where m.user_id = auth.uid() and m.is_active) then
    raise exception 'already_member' using errcode = '23505';
  end if;
  -- A patient's portal login is not a practitioner's account, and must not
  -- be able to turn itself into one.
  if exists (select 1 from public.patient_portal_access a where a.user_id = auth.uid()) then
    raise exception 'portal_account' using errcode = '42501';
  end if;

  insert into public.clinics (name, slug, phone)
  values (
    v_name,
    'c-' || replace(gen_random_uuid()::text, '-', ''),
    nullif(btrim(coalesce(p_phone, '')), '')
  )
  returning id into v_clinic;

  insert into public.memberships (clinic_id, user_id, role, is_active)
  values (v_clinic, auth.uid(), 'owner', true);

  return v_clinic;
end;
$$;

revoke all on function public.create_clinic_for_current_user(text, text) from public;
grant execute on function public.create_clinic_for_current_user(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Every clinic, for whoever runs the service
-- ---------------------------------------------------------------------------
-- Counts only, no clinical data: this answers "who is using it and how much",
-- not "what is in their files". Empty for anyone not on the list.
create or replace function public.platform_clinics()
returns table (
  id uuid,
  name text,
  created_at timestamptz,
  is_synthetic boolean,
  owner_email text,
  members integer,
  patients integer,
  appointments_30d integer,
  last_booking_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id,
    c.name,
    c.created_at,
    c.is_synthetic,
    (select u.email::text
       from public.memberships m
       join auth.users u on u.id = m.user_id
      where m.clinic_id = c.id and m.role = 'owner'
      order by m.created_at
      limit 1),
    (select count(*)::int from public.memberships m where m.clinic_id = c.id and m.is_active),
    (select count(*)::int from public.patients p where p.clinic_id = c.id),
    (select count(*)::int from public.appointments a
      where a.clinic_id = c.id and a.start_at > now() - interval '30 days'),
    (select max(a.created_at) from public.appointments a where a.clinic_id = c.id)
  from public.clinics c
  where public.is_platform_admin()
  order by c.created_at desc;
$$;

revoke all on function public.platform_clinics() from public;
grant execute on function public.platform_clinics() to authenticated;

comment on table public.platform_admins is
  'Who runs the service. Written only in the SQL editor: insert into public.platform_admins (user_id) select id from auth.users where email = ''<your address>'';';
