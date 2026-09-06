-- ============================================================================
-- 06 · Herb inventory
-- ============================================================================
-- Stock is modelled as an immutable ledger (`stock_movements`) with a cached
-- balance per batch (`herb_batches.quantity_remaining`). The cache exists because
-- every screen needs "how much is left" instantly; the ledger exists because
-- costing, shrinkage and — later — billing all need the full history, and a
-- balance you can only overwrite loses that permanently.
--
-- Batches are tracked individually so expiry and supplier cost stay attached to
-- the physical jar on the shelf, which is what makes first-expiry-first-out
-- dispensing possible.
-- ============================================================================

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null default public.current_clinic_id() references public.clinics(id) on delete cascade,
  name text not null,
  contact_name text,
  phone text,
  email text,
  address text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger suppliers_set_updated_at
  before update on public.suppliers
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- herbs — the master catalogue
-- ---------------------------------------------------------------------------
-- Four name columns because a practitioner searches by whichever one is in their
-- head at that moment: pinyin during study, Chinese on the supplier's label,
-- English or Hebrew when explaining it to the patient.

create table if not exists public.herbs (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null default public.current_clinic_id() references public.clinics(id) on delete cascade,
  pinyin_name text,
  chinese_name text,
  english_name text,
  hebrew_name text,
  category text not null default 'granule' check (category in (
    'raw_herb', 'granule', 'powder', 'pill', 'tincture',
    'patent_formula_product', 'external_application'
  )),
  default_unit text not null default 'gram' check (default_unit in (
    'gram', 'capsule', 'bottle', 'box', 'milliliter', 'packet'
  )),
  properties text,
  functions text,
  cautions text,
  reorder_threshold numeric(12, 3) check (reorder_threshold is null or reorder_threshold >= 0),
  reorder_quantity numeric(12, 3) check (reorder_quantity is null or reorder_quantity > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint herbs_needs_a_name check (
    coalesce(pinyin_name, chinese_name, english_name, hebrew_name) is not null
  )
);

create index if not exists herbs_clinic_idx on public.herbs (clinic_id, is_active);

-- One trigram index per name column: the catalogue search runs a separate `ilike`
-- against each, so a single combined index could not serve any of them.
create index if not exists herbs_pinyin_trgm_idx
  on public.herbs using gin (pinyin_name gin_trgm_ops);

create index if not exists herbs_chinese_trgm_idx
  on public.herbs using gin (chinese_name gin_trgm_ops);

create index if not exists herbs_english_trgm_idx
  on public.herbs using gin (english_name gin_trgm_ops);

create index if not exists herbs_hebrew_trgm_idx
  on public.herbs using gin (hebrew_name gin_trgm_ops);

create trigger herbs_set_updated_at
  before update on public.herbs
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Formulas — reusable prescriptions
-- ---------------------------------------------------------------------------

create table if not exists public.herb_formulas (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null default public.current_clinic_id() references public.clinics(id) on delete cascade,
  name_pinyin text,
  name_chinese text,
  name_english text,
  name_hebrew text,
  category text not null default 'custom' check (category in ('classical', 'modified', 'custom')),
  description text,
  indications text,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint herb_formulas_needs_a_name check (
    coalesce(name_pinyin, name_chinese, name_english, name_hebrew) is not null
  )
);

create trigger herb_formulas_set_updated_at
  before update on public.herb_formulas
  for each row execute function public.set_updated_at();

create table if not exists public.herb_formula_items (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null default public.current_clinic_id() references public.clinics(id) on delete cascade,
  formula_id uuid not null references public.herb_formulas(id) on delete cascade,
  herb_id uuid not null references public.herbs(id) on delete restrict,
  dosage numeric(12, 3) not null check (dosage > 0),
  unit text not null default 'gram' check (unit in (
    'gram', 'capsule', 'bottle', 'box', 'milliliter', 'packet'
  )),
  sequence integer not null default 0,
  notes text,
  unique (formula_id, herb_id)
);

create index if not exists herb_formula_items_formula_idx
  on public.herb_formula_items (formula_id, sequence);

-- ---------------------------------------------------------------------------
-- Purchasing (minimal — the path by which batches arrive)
-- ---------------------------------------------------------------------------

create table if not exists public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null default public.current_clinic_id() references public.clinics(id) on delete cascade,
  supplier_id uuid references public.suppliers(id) on delete set null,
  order_date date not null default current_date,
  status text not null default 'draft'
    check (status in ('draft', 'ordered', 'received', 'cancelled')),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger purchase_orders_set_updated_at
  before update on public.purchase_orders
  for each row execute function public.set_updated_at();

create table if not exists public.purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null default public.current_clinic_id() references public.clinics(id) on delete cascade,
  purchase_order_id uuid not null references public.purchase_orders(id) on delete cascade,
  herb_id uuid not null references public.herbs(id) on delete restrict,
  quantity numeric(12, 3) not null check (quantity > 0),
  unit text not null default 'gram',
  unit_cost numeric(12, 4)
);

-- ---------------------------------------------------------------------------
-- herb_batches — physical stock
-- ---------------------------------------------------------------------------

create table if not exists public.herb_batches (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null default public.current_clinic_id() references public.clinics(id) on delete cascade,
  herb_id uuid not null references public.herbs(id) on delete restrict,
  supplier_id uuid references public.suppliers(id) on delete set null,
  batch_number text,
  quantity_received numeric(12, 3) not null check (quantity_received > 0),
  -- The cached balance. Maintained exclusively by the stock_movements trigger.
  -- The >= 0 check is the hard stop that makes over-dispensing impossible, no
  -- matter which client is talking to the database.
  quantity_remaining numeric(12, 3) not null default 0
    check (quantity_remaining >= 0),
  unit text not null default 'gram' check (unit in (
    'gram', 'capsule', 'bottle', 'box', 'milliliter', 'packet'
  )),
  unit_cost numeric(12, 4) check (unit_cost is null or unit_cost >= 0),
  expiry_date date,
  storage_location text,
  received_date date not null default current_date,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Ordering for first-expiry-first-out allocation.
create index if not exists herb_batches_fefo_idx
  on public.herb_batches (clinic_id, herb_id, expiry_date nulls last, received_date)
  where quantity_remaining > 0;

-- ---------------------------------------------------------------------------
-- stock_movements — the immutable ledger
-- ---------------------------------------------------------------------------
-- Quantity is signed: positive adds stock, negative removes it. Rows are never
-- updated or deleted; a mistake is corrected with a compensating `adjustment`.

create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null default public.current_clinic_id() references public.clinics(id) on delete cascade,
  herb_id uuid not null references public.herbs(id) on delete restrict,
  batch_id uuid references public.herb_batches(id) on delete restrict,
  movement_type text not null check (movement_type in (
    'receive', 'dispense', 'adjustment', 'waste', 'return'
  )),
  quantity numeric(12, 3) not null check (quantity <> 0),
  unit text not null default 'gram',
  -- Soft link back to whatever caused the movement (a dispensing record, a PO).
  reference_table text,
  reference_id uuid,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists stock_movements_herb_idx
  on public.stock_movements (clinic_id, herb_id, created_at desc);

create index if not exists stock_movements_batch_idx
  on public.stock_movements (batch_id, created_at desc);

create index if not exists stock_movements_reference_idx
  on public.stock_movements (reference_table, reference_id);

-- Apply each ledger entry to its batch balance.
create or replace function public.apply_stock_movement()
returns trigger
language plpgsql
as $$
begin
  if new.batch_id is not null then
    update public.herb_batches
       set quantity_remaining = quantity_remaining + new.quantity
     where id = new.batch_id;
  end if;
  return new;
end;
$$;

create trigger stock_movements_apply
  after insert on public.stock_movements
  for each row execute function public.apply_stock_movement();

-- The ledger is append-only.
create or replace function public.reject_ledger_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'stock_ledger_is_append_only'
    using hint = 'Correct a mistake with a compensating adjustment movement instead.';
end;
$$;

create trigger stock_movements_no_update
  before update or delete on public.stock_movements
  for each row execute function public.reject_ledger_mutation();

-- ---------------------------------------------------------------------------
-- herb_stock_levels — live stock position per herb
-- ---------------------------------------------------------------------------
-- security_invoker keeps the caller's RLS in force; without it the view would run
-- with the owner's rights and quietly expose every clinic's stock.

create or replace view public.herb_stock_levels
with (security_invoker = on)
as
select
  h.id as herb_id,
  h.clinic_id,
  h.pinyin_name,
  h.chinese_name,
  h.english_name,
  h.hebrew_name,
  h.category,
  h.default_unit,
  h.reorder_threshold,
  h.reorder_quantity,
  h.is_active,
  coalesce(sum(b.quantity_remaining), 0)::numeric(12, 3) as total_remaining,
  count(b.id) filter (where b.quantity_remaining > 0) as batch_count,
  min(b.expiry_date) filter (where b.quantity_remaining > 0) as nearest_expiry,
  (
    h.reorder_threshold is not null
    and coalesce(sum(b.quantity_remaining), 0) <= h.reorder_threshold
  ) as is_below_threshold
from public.herbs h
left join public.herb_batches b
  on b.herb_id = h.id
 and b.quantity_remaining > 0
group by h.id;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.suppliers enable row level security;
alter table public.herbs enable row level security;
alter table public.herb_formulas enable row level security;
alter table public.herb_formula_items enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.purchase_order_items enable row level security;
alter table public.herb_batches enable row level security;
alter table public.stock_movements enable row level security;

drop policy if exists suppliers_staff_all on public.suppliers;
create policy suppliers_staff_all on public.suppliers
  for all using (public.is_clinic_member(clinic_id))
  with check (public.is_clinic_member(clinic_id));

drop policy if exists herbs_staff_all on public.herbs;
create policy herbs_staff_all on public.herbs
  for all using (public.is_clinic_member(clinic_id))
  with check (public.is_clinic_member(clinic_id));

drop policy if exists herb_formulas_staff_all on public.herb_formulas;
create policy herb_formulas_staff_all on public.herb_formulas
  for all using (public.is_clinic_member(clinic_id))
  with check (public.is_clinic_member(clinic_id));

drop policy if exists herb_formula_items_staff_all on public.herb_formula_items;
create policy herb_formula_items_staff_all on public.herb_formula_items
  for all using (public.is_clinic_member(clinic_id))
  with check (public.is_clinic_member(clinic_id));

drop policy if exists purchase_orders_staff_all on public.purchase_orders;
create policy purchase_orders_staff_all on public.purchase_orders
  for all using (public.is_clinic_member(clinic_id))
  with check (public.is_clinic_member(clinic_id));

drop policy if exists purchase_order_items_staff_all on public.purchase_order_items;
create policy purchase_order_items_staff_all on public.purchase_order_items
  for all using (public.is_clinic_member(clinic_id))
  with check (public.is_clinic_member(clinic_id));

drop policy if exists herb_batches_staff_all on public.herb_batches;
create policy herb_batches_staff_all on public.herb_batches
  for all using (public.is_clinic_member(clinic_id))
  with check (public.is_clinic_member(clinic_id));

-- Insert-only from the app's point of view; the append-only trigger blocks the rest.
drop policy if exists stock_movements_staff_read on public.stock_movements;
create policy stock_movements_staff_read on public.stock_movements
  for select using (public.is_clinic_member(clinic_id));

drop policy if exists stock_movements_staff_insert on public.stock_movements;
create policy stock_movements_staff_insert on public.stock_movements
  for insert with check (public.is_clinic_member(clinic_id));
