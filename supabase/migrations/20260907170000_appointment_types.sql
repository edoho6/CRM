-- ============================================================================
-- 23 · Treatment types a practitioner defines for themself
-- ============================================================================
-- The table existed with a name, a duration and a colour. What it could not
-- carry is the price, which is the field that makes a type worth defining at
-- all: "initial consultation, 90 minutes, ₪350" is one thing you set up once,
-- and every booking and every invoice then knows what it costs.
--
-- Deliberately not modelled here: per-patient pricing, packages, discounts,
-- VAT-inclusive versus exclusive. Each is a real thing some practice needs and
-- none is a thing this one has asked for; a price on the type is the smallest
-- shape that answers the question, and the invoice line stays editable for the
-- times it is wrong.
-- ============================================================================

alter table public.appointment_types
  add column if not exists price numeric(10, 2)
    check (price is null or price >= 0);

comment on column public.appointment_types.price is
  'What this treatment normally costs. Null means it is not priced — the invoice line is still editable, so an unpriced type is usable rather than blocked.';

alter table public.appointment_types
  add column if not exists notes text;

-- Who it belongs to. Null means the whole clinic, which is what every existing
-- row is; a practitioner can define their own without it appearing in a
-- colleague's calendar once there is more than one of them.
alter table public.appointment_types
  add column if not exists practitioner_id uuid references public.profiles(id) on delete cascade;

comment on column public.appointment_types.practitioner_id is
  'Null for a type the whole clinic shares. Set when a practitioner defines one only they use.';

alter table public.appointment_types
  add column if not exists updated_at timestamptz not null default now();

drop trigger if exists appointment_types_set_updated_at on public.appointment_types;
create trigger appointment_types_set_updated_at
  before update on public.appointment_types
  for each row execute function public.set_updated_at();

create index if not exists appointment_types_practitioner_idx
  on public.appointment_types (clinic_id, practitioner_id, sort_order)
  where is_active;
