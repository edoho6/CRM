-- ============================================================================
-- 08 · Modular dashboard persistence
-- ============================================================================
-- One row per user per named dashboard. The arrangement is personal: two people in
-- the same clinic see the workspace each of them built, which is the point of the
-- customisable dashboard requirement.
--
-- `layout` is jsonb rather than a table of widget rows because the grid library
-- already produces exactly this shape, and because adding a new widget type must
-- never require a schema change.
-- ============================================================================

create table if not exists public.dashboard_layouts (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null default public.current_clinic_id() references public.clinics(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'default',
  -- Array of {id, type, x, y, w, h, config}
  layout jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, user_id, name),
  constraint dashboard_layouts_is_array check (jsonb_typeof(layout) = 'array')
);

create trigger dashboard_layouts_set_updated_at
  before update on public.dashboard_layouts
  for each row execute function public.set_updated_at();

alter table public.dashboard_layouts enable row level security;

-- Strictly personal: scoped to the clinic *and* to the individual user.
drop policy if exists dashboard_layouts_own on public.dashboard_layouts;
create policy dashboard_layouts_own on public.dashboard_layouts
  for all
  using (user_id = auth.uid() and public.is_clinic_member(clinic_id))
  with check (user_id = auth.uid() and public.is_clinic_member(clinic_id));
