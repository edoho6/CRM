-- ============================================================================
-- 13 · Separating the reference library from the stock room, and the point atlas
-- ============================================================================
-- Two ideas landed together here because they touch the same screens.
--
-- 1. A practitioner's materia medica and a practitioner's shelf are different
--    things. Until now they were the same table read two ways, which meant a
--    clinic that dispenses nothing still had to look at stock columns, and a
--    clinic that does had no way to see only what it actually holds. The split
--    is `clinics.tracks_inventory` plus the derived notion of a herb being
--    *stocked* — it has been received at least once, or someone set a reorder
--    threshold for it. Everything else follows from that one distinction.
--
-- 2. Acupuncture points get a real catalogue, so a treatment note can reference
--    LU7 rather than spell it. The clinical text is deliberately left empty for
--    now; the columns exist so filling them later is data entry, not a
--    migration.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Does this clinic keep stock at all?
-- ---------------------------------------------------------------------------

alter table public.clinics
  add column if not exists tracks_inventory boolean not null default true;

comment on column public.clinics.tracks_inventory is
  'False for a clinic that prescribes without holding stock. Hides every stock-related surface and switches dispensing to prescription-only recording.';

-- ---------------------------------------------------------------------------
-- A formula can run low too, measured in whole doses
-- ---------------------------------------------------------------------------

alter table public.herb_formulas
  add column if not exists reorder_threshold_doses numeric(12, 3)
    check (reorder_threshold_doses is null or reorder_threshold_doses >= 0);

comment on column public.herb_formulas.reorder_threshold_doses is
  'Low-stock threshold expressed in whole doses of the formula, since a formula has no batches of its own.';

-- ---------------------------------------------------------------------------
-- herb_stock_levels — now also answers "do we stock this at all?"
-- ---------------------------------------------------------------------------
-- The join no longer filters to batches with stock left, because an emptied
-- herb still belongs in the stock room: it is out of stock, not absent. The
-- filters moved into the aggregates instead.

drop view if exists public.formula_stock_levels;
drop view if exists public.herb_stock_levels;

create view public.herb_stock_levels
with (security_invoker = on)
as
select
  h.id as herb_id,
  h.clinic_id,
  h.pinyin_name,
  h.chinese_name,
  h.english_name,
  h.hebrew_name,
  h.botanical_name,
  h.tcm_category,
  h.image_url,
  h.needs_review,
  h.category,
  h.default_unit,
  h.reorder_threshold,
  h.reorder_quantity,
  h.is_active,
  coalesce(sum(b.quantity_remaining) filter (where b.quantity_remaining > 0), 0)::numeric(12, 3)
    as total_remaining,
  count(b.id) filter (where b.quantity_remaining > 0) as batch_count,
  count(b.id) as batch_count_total,
  min(b.expiry_date) filter (where b.quantity_remaining > 0) as nearest_expiry,
  (
    h.reorder_threshold is not null
    and coalesce(sum(b.quantity_remaining) filter (where b.quantity_remaining > 0), 0)
        <= h.reorder_threshold
  ) as is_below_threshold,
  -- Stocked = it has been through the stock room, or someone declared an
  -- intention to keep it. Derived rather than a flag, so it can never drift
  -- out of step with what actually happened.
  (count(b.id) > 0 or h.reorder_threshold is not null) as is_stocked
from public.herbs h
left join public.herb_batches b
  on b.herb_id = h.id
group by h.id;

-- ---------------------------------------------------------------------------
-- formula_stock_levels — how many whole doses the shelf can still make
-- ---------------------------------------------------------------------------
-- A formula holds no stock of its own; what it has is a ceiling imposed by its
-- scarcest ingredient. That number — "I can still make four days of this" — is
-- the only stock figure a formula can honestly report.

create view public.formula_stock_levels
with (security_invoker = on)
as
with capacity as (
  select
    i.formula_id,
    i.herb_id,
    i.dosage,
    coalesce(sl.total_remaining, 0) as remaining,
    coalesce(sl.is_stocked, false) as herb_is_stocked,
    case
      when i.dosage > 0 then floor(coalesce(sl.total_remaining, 0) / i.dosage)
      else null
    end as doses
  from public.herb_formula_items i
  left join public.herb_stock_levels sl on sl.herb_id = i.herb_id
),
rolled as (
  select
    f.id as formula_id,
    f.clinic_id,
    f.name_pinyin,
    f.name_chinese,
    f.name_english,
    f.name_hebrew,
    f.tcm_category,
    f.category,
    f.needs_review,
    f.is_active,
    f.reorder_threshold_doses,
    count(c.herb_id) as item_count,
    count(c.herb_id) filter (where c.remaining <= 0) as missing_count,
    coalesce(min(c.doses), 0)::numeric(12, 3) as doses_available,
    coalesce(bool_or(c.herb_is_stocked), false) as any_ingredient_stocked
  from public.herb_formulas f
  left join capacity c on c.formula_id = f.id
  group by f.id
)
select
  rolled.*,
  (
    rolled.reorder_threshold_doses is not null
    and rolled.doses_available <= rolled.reorder_threshold_doses
  ) as is_below_threshold,
  (rolled.any_ingredient_stocked or rolled.reorder_threshold_doses is not null) as is_stocked
from rolled;

comment on view public.formula_stock_levels is
  'Doses of each formula the current stock can still produce, capped by the scarcest ingredient.';

-- ---------------------------------------------------------------------------
-- order_list — the shopping cart
-- ---------------------------------------------------------------------------
-- Deliberately not a purchase order: this is the running "we are out of that"
-- list a practitioner adds to across the week, before any supplier is chosen.
-- One row points at either a herb or a formula, never both.

create table if not exists public.order_list (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null default public.current_clinic_id() references public.clinics(id) on delete cascade,
  herb_id uuid references public.herbs(id) on delete cascade,
  formula_id uuid references public.herb_formulas(id) on delete cascade,
  quantity numeric(12, 3) check (quantity is null or quantity > 0),
  -- For a formula the quantity counts doses; for a herb it counts `unit`.
  unit text not null default 'gram' check (unit in (
    'gram', 'capsule', 'bottle', 'box', 'milliliter', 'packet', 'dose'
  )),
  supplier_id uuid references public.suppliers(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'ordered', 'received')),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint order_list_one_target check (num_nonnulls(herb_id, formula_id) = 1)
);

-- Adding the same herb twice should update the line, not grow the list.
create unique index if not exists order_list_pending_herb_idx
  on public.order_list (clinic_id, herb_id)
  where herb_id is not null and status <> 'received';

create unique index if not exists order_list_pending_formula_idx
  on public.order_list (clinic_id, formula_id)
  where formula_id is not null and status <> 'received';

create index if not exists order_list_status_idx
  on public.order_list (clinic_id, status, created_at desc);

drop trigger if exists order_list_set_updated_at on public.order_list;
create trigger order_list_set_updated_at
  before update on public.order_list
  for each row execute function public.set_updated_at();

alter table public.order_list enable row level security;

drop policy if exists order_list_staff_all on public.order_list;
create policy order_list_staff_all on public.order_list
  for all using (public.is_clinic_member(clinic_id))
  with check (public.is_clinic_member(clinic_id));

-- ---------------------------------------------------------------------------
-- acupuncture_points — the atlas
-- ---------------------------------------------------------------------------
-- Clinic-scoped like the herbs, for the same reason: a practitioner will want
-- to correct a location note or add a point of their own without that leaking
-- into anyone else's copy.
--
-- The coordinates are schematic. They place a point on a stylised body drawing
-- so a treatment can be seen at a glance; they are not an anatomical locator
-- and must never be used as one.

create table if not exists public.acupuncture_points (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null default public.current_clinic_id() references public.clinics(id) on delete cascade,

  code text not null,
  channel text not null,
  point_number integer,

  pinyin_name text,
  chinese_name text,
  english_name text,
  hebrew_name text,

  -- Where it sits on the drawing, and which drawing.
  body_view text not null default 'front' check (body_view in ('front', 'back')),
  x numeric(6, 2),
  y numeric(6, 2),
  bilateral boolean not null default true,
  -- Suggested bucket in the treatment note; the practitioner can override it.
  default_region text not null default 'upper'
    check (default_region in ('upper', 'lower', 'left', 'right', 'center')),

  -- Clinical reference. Empty for now, on purpose.
  location text,
  actions text,
  indications text,
  needling text,
  cautions text,
  point_categories text[] not null default '{}',

  needs_review boolean not null default false,
  data_source text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists acupuncture_points_code_idx
  on public.acupuncture_points (clinic_id, upper(code));

create index if not exists acupuncture_points_channel_idx
  on public.acupuncture_points (clinic_id, channel, point_number);

create index if not exists acupuncture_points_search_idx
  on public.acupuncture_points using gin (code gin_trgm_ops);

create index if not exists acupuncture_points_pinyin_trgm_idx
  on public.acupuncture_points using gin (pinyin_name gin_trgm_ops);

create index if not exists acupuncture_points_english_trgm_idx
  on public.acupuncture_points using gin (english_name gin_trgm_ops);

drop trigger if exists acupuncture_points_set_updated_at on public.acupuncture_points;
create trigger acupuncture_points_set_updated_at
  before update on public.acupuncture_points
  for each row execute function public.set_updated_at();

alter table public.acupuncture_points enable row level security;

drop policy if exists acupuncture_points_staff_all on public.acupuncture_points;
create policy acupuncture_points_staff_all on public.acupuncture_points
  for all using (public.is_clinic_member(clinic_id))
  with check (public.is_clinic_member(clinic_id));

-- Editing a point's clinical text is the practitioner confirming it, exactly as
-- with a herb.
create or replace function public.clear_point_review_flag()
returns trigger
language plpgsql
as $$
begin
  if new.needs_review
     and (
       new.location is distinct from old.location
       or new.actions is distinct from old.actions
       or new.indications is distinct from old.indications
       or new.needling is distinct from old.needling
       or new.cautions is distinct from old.cautions
     ) then
    new.needs_review := false;
  end if;
  return new;
end;
$$;

drop trigger if exists acupuncture_points_clear_review_flag on public.acupuncture_points;
create trigger acupuncture_points_clear_review_flag
  before update on public.acupuncture_points
  for each row execute function public.clear_point_review_flag();

-- Catalogue importer, same contract as upsert_herb: fill the gaps, never
-- overwrite a correction.
create or replace function public.upsert_acupuncture_point(
  p_code text,
  p_channel text,
  p_number integer,
  p_pinyin text,
  p_chinese text,
  p_english text,
  p_view text,
  p_x numeric,
  p_y numeric,
  p_bilateral boolean,
  p_region text,
  p_categories text[] default '{}',
  p_source text default 'bundled-catalogue',
  p_clinic uuid default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_clinic uuid;
  v_id uuid;
begin
  v_clinic := coalesce(p_clinic, (select id from public.clinics order by created_at limit 1));
  if v_clinic is null then
    raise exception 'no_clinic';
  end if;

  select id into v_id
  from public.acupuncture_points
  where clinic_id = v_clinic and upper(code) = upper(p_code)
  limit 1;

  if v_id is null then
    insert into public.acupuncture_points (
      clinic_id, code, channel, point_number, pinyin_name, chinese_name, english_name,
      body_view, x, y, bilateral, default_region, point_categories, needs_review, data_source
    )
    values (
      v_clinic, p_code, p_channel, p_number, p_pinyin, p_chinese, p_english,
      coalesce(p_view, 'front'), p_x, p_y, coalesce(p_bilateral, true),
      coalesce(p_region, 'upper'), coalesce(p_categories, '{}'), true, p_source
    )
    returning id into v_id;
  else
    update public.acupuncture_points
       set channel      = coalesce(channel, p_channel),
           point_number = coalesce(point_number, p_number),
           pinyin_name  = coalesce(pinyin_name, p_pinyin),
           chinese_name = coalesce(chinese_name, p_chinese),
           english_name = coalesce(english_name, p_english),
           -- Coordinates are catalogue data, not clinical judgement: a newer
           -- drawing should be allowed to move a dot.
           body_view    = coalesce(p_view, body_view),
           x            = coalesce(p_x, x),
           y            = coalesce(p_y, y),
           default_region = coalesce(p_region, default_region),
           point_categories = case
             when cardinality(point_categories) = 0 then coalesce(p_categories, '{}')
             else point_categories
           end,
           data_source  = coalesce(data_source, p_source)
     where id = v_id;
  end if;

  return v_id;
end;
$$;

comment on function public.upsert_acupuncture_point is
  'Catalogue importer for acupuncture points. Coordinates may be refreshed; clinical text never is.';

-- ---------------------------------------------------------------------------
-- record_prescription — dispensing for a clinic that holds no stock
-- ---------------------------------------------------------------------------
-- `dispense_formula` allocates from batches and refuses when the shelf is
-- short. A clinic that keeps no shelf would be refused every single time, and
-- would lose the ability to record what it prescribed at all. This writes the
-- same record with no batch allocation and no ledger entry, which is the
-- truthful account of what happened: herbs were prescribed, none left a jar.

create or replace function public.record_prescription(
  p_encounter_id uuid,
  p_formula_id uuid default null,
  p_items jsonb default '[]'::jsonb,
  p_multiplier numeric default 1,
  p_notes text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_clinic uuid;
  v_patient uuid;
  v_record uuid;
  v_item jsonb;
  v_herb uuid;
  v_quantity numeric;
  v_unit text;
  v_count integer := 0;
begin
  select clinic_id, patient_id into v_clinic, v_patient
  from public.encounters
  where id = p_encounter_id;

  if v_clinic is null then
    raise exception 'encounter_not_found';
  end if;

  if exists (select 1 from public.encounters where id = p_encounter_id and status = 'signed') then
    raise exception 'encounter_signed';
  end if;

  insert into public.dispensing_records (
    clinic_id, encounter_id, patient_id, formula_id, multiplier, dispensed_by, notes
  )
  values (v_clinic, p_encounter_id, v_patient, p_formula_id, coalesce(p_multiplier, 1), auth.uid(), p_notes)
  returning id into v_record;

  -- A saved formula expands to its lines, scaled; ad-hoc items are taken as given.
  if p_formula_id is not null then
    for v_herb, v_quantity, v_unit in
      select i.herb_id, i.dosage * coalesce(p_multiplier, 1), i.unit
      from public.herb_formula_items i
      where i.formula_id = p_formula_id
      order by i.sequence
    loop
      insert into public.dispensing_items (clinic_id, dispensing_record_id, herb_id, quantity, unit)
      values (v_clinic, v_record, v_herb, v_quantity, v_unit);
      v_count := v_count + 1;
    end loop;
  end if;

  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    v_herb := (v_item ->> 'herb_id')::uuid;
    v_quantity := (v_item ->> 'quantity')::numeric * coalesce(p_multiplier, 1);
    v_unit := coalesce(v_item ->> 'unit', 'gram');
    if v_herb is null or v_quantity is null or v_quantity <= 0 then
      continue;
    end if;
    insert into public.dispensing_items (clinic_id, dispensing_record_id, herb_id, quantity, unit)
    values (v_clinic, v_record, v_herb, v_quantity, v_unit);
    v_count := v_count + 1;
  end loop;

  if v_count = 0 then
    raise exception 'nothing_to_dispense';
  end if;

  return v_record;
end;
$$;

comment on function public.record_prescription is
  'Records a prescription without touching stock. For clinics with tracks_inventory = false.';
