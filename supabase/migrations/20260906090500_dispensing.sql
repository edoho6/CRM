-- ============================================================================
-- 07 · Dispensing — herbs handed to a patient during a visit
-- ============================================================================
-- This is where inventory meets the clinical record. Allocation happens inside a
-- single database function so that "check stock" and "remove stock" cannot be
-- separated by a race, and so a failure part-way through leaves no partial
-- deduction behind.
--
-- The cost columns are populated now but unused by the Milestone 1 UI. They exist
-- so Milestone 2 billing can invoice dispensed herbs at the price actually paid
-- for them, without a migration or a guess at historical cost.
-- ============================================================================

create table if not exists public.dispensing_records (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null default public.current_clinic_id() references public.clinics(id) on delete cascade,
  encounter_id uuid not null references public.encounters(id) on delete cascade,
  -- Denormalised from the encounter: patient history queries are far more common
  -- than encounter lookups, and this saves a join on every one of them.
  patient_id uuid not null references public.patients(id) on delete cascade,
  formula_id uuid references public.herb_formulas(id) on delete set null,
  multiplier numeric(8, 2) not null default 1 check (multiplier > 0),
  dispensed_by uuid references auth.users(id) on delete set null,
  dispensed_at timestamptz not null default now(),
  status text not null default 'dispensed'
    check (status in ('dispensed', 'partially_returned', 'returned')),
  notes text,
  total_cost numeric(12, 2),
  created_at timestamptz not null default now()
);

create index if not exists dispensing_records_encounter_idx
  on public.dispensing_records (encounter_id, dispensed_at desc);

create index if not exists dispensing_records_patient_idx
  on public.dispensing_records (clinic_id, patient_id, dispensed_at desc);

create table if not exists public.dispensing_items (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null default public.current_clinic_id() references public.clinics(id) on delete cascade,
  dispensing_record_id uuid not null references public.dispensing_records(id) on delete cascade,
  herb_id uuid not null references public.herbs(id) on delete restrict,
  -- One requested herb can span several batches when the first one runs out,
  -- so a single herb may produce more than one row here.
  batch_id uuid references public.herb_batches(id) on delete set null,
  quantity numeric(12, 3) not null check (quantity > 0),
  unit text not null default 'gram',
  unit_cost_snapshot numeric(12, 4),
  line_total numeric(12, 2)
);

create index if not exists dispensing_items_record_idx
  on public.dispensing_items (dispensing_record_id);

create index if not exists dispensing_items_herb_idx
  on public.dispensing_items (clinic_id, herb_id);

-- ---------------------------------------------------------------------------
-- receive_herb_batch — the only supported way to add stock
-- ---------------------------------------------------------------------------
-- Creating the batch and its opening ledger entry together means the balance is
-- always explainable by the ledger, with no "where did this stock come from" gaps.

create or replace function public.receive_herb_batch(
  p_herb_id uuid,
  p_quantity numeric,
  p_unit text default 'gram',
  p_supplier_id uuid default null,
  p_batch_number text default null,
  p_unit_cost numeric default null,
  p_expiry_date date default null,
  p_storage_location text default null,
  p_received_date date default null,
  p_notes text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_clinic uuid;
  v_batch_id uuid;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'invalid_quantity';
  end if;

  select h.clinic_id into v_clinic from public.herbs h where h.id = p_herb_id;
  if v_clinic is null then
    raise exception 'herb_not_found';
  end if;

  insert into public.herb_batches (
    clinic_id, herb_id, supplier_id, batch_number, quantity_received, quantity_remaining,
    unit, unit_cost, expiry_date, storage_location, received_date, notes, created_by
  )
  values (
    v_clinic, p_herb_id, p_supplier_id, p_batch_number, p_quantity, 0,
    coalesce(p_unit, 'gram'), p_unit_cost, p_expiry_date, p_storage_location,
    coalesce(p_received_date, current_date), p_notes, auth.uid()
  )
  returning id into v_batch_id;

  -- The trigger on stock_movements raises quantity_remaining from 0 to p_quantity.
  insert into public.stock_movements (
    clinic_id, herb_id, batch_id, movement_type, quantity, unit,
    reference_table, reference_id, notes, created_by
  )
  values (
    v_clinic, p_herb_id, v_batch_id, 'receive', p_quantity, coalesce(p_unit, 'gram'),
    'herb_batches', v_batch_id, p_notes, auth.uid()
  );

  return v_batch_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- adjust_stock — corrections, waste and returns
-- ---------------------------------------------------------------------------

create or replace function public.adjust_stock(
  p_batch_id uuid,
  p_quantity numeric,
  p_movement_type text default 'adjustment',
  p_notes text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_batch public.herb_batches;
  v_movement_id uuid;
begin
  if p_quantity is null or p_quantity = 0 then
    raise exception 'quantity_cannot_be_zero';
  end if;

  select * into v_batch from public.herb_batches where id = p_batch_id for update;
  if v_batch.id is null then
    raise exception 'batch_not_found';
  end if;

  if v_batch.quantity_remaining + p_quantity < 0 then
    raise exception 'insufficient_stock'
      using detail = json_build_object(
        'required', abs(p_quantity),
        'available', v_batch.quantity_remaining
      )::text;
  end if;

  insert into public.stock_movements (
    clinic_id, herb_id, batch_id, movement_type, quantity, unit, notes, created_by
  )
  values (
    v_batch.clinic_id, v_batch.herb_id, v_batch.id, p_movement_type, p_quantity,
    v_batch.unit, p_notes, auth.uid()
  )
  returning id into v_movement_id;

  return v_movement_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- dispense_formula — the transactional core of the inventory module
-- ---------------------------------------------------------------------------
-- Accepts either a saved formula (optionally scaled — `multiplier` 7 gives a week
-- of doses) or an ad-hoc list, or both. Allocation is first-expiry-first-out so the
-- shelf rotates correctly on its own.
--
-- Errors are raised as bare codes with a JSON `detail`, so the UI can render a
-- translated message rather than surfacing English database text to the user.

create or replace function public.dispense_formula(
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
  v_status text;
  v_record_id uuid;
  v_line record;
  v_batch record;
  v_needed numeric;
  v_take numeric;
  v_available numeric;
  v_herb_label text;
  v_total_cost numeric := 0;
  v_line_count integer := 0;
begin
  if p_multiplier is null or p_multiplier <= 0 then
    raise exception 'invalid_multiplier';
  end if;

  select e.clinic_id, e.patient_id, e.status
    into v_clinic, v_patient, v_status
  from public.encounters e
  where e.id = p_encounter_id;

  if v_clinic is null then
    raise exception 'encounter_not_found';
  end if;

  if v_status = 'signed' then
    raise exception 'encounter_locked'
      using hint = 'Herbs cannot be dispensed against a signed record.';
  end if;

  insert into public.dispensing_records (
    clinic_id, encounter_id, patient_id, formula_id, multiplier, dispensed_by, notes
  )
  values (v_clinic, p_encounter_id, v_patient, p_formula_id, p_multiplier, auth.uid(), p_notes)
  returning id into v_record_id;

  for v_line in
    with requested as (
      select fi.herb_id,
             fi.dosage * p_multiplier as quantity,
             fi.unit
      from public.herb_formula_items fi
      where p_formula_id is not null
        and fi.formula_id = p_formula_id
      union all
      select (item ->> 'herb_id')::uuid,
             (item ->> 'quantity')::numeric * p_multiplier,
             coalesce(item ->> 'unit', 'gram')
      from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) as item
    )
    select r.herb_id,
           sum(r.quantity) as quantity,
           min(r.unit) as unit
    from requested r
    group by r.herb_id
  loop
    v_line_count := v_line_count + 1;

    select coalesce(h.hebrew_name, h.pinyin_name, h.english_name, h.chinese_name, '?')
      into v_herb_label
    from public.herbs h
    where h.id = v_line.herb_id;

    if v_herb_label is null then
      raise exception 'herb_not_found';
    end if;

    -- Fail before writing anything for this herb, so the error message can report
    -- the true shortfall rather than whatever was left after a partial allocation.
    select coalesce(sum(b.quantity_remaining), 0)
      into v_available
    from public.herb_batches b
    where b.herb_id = v_line.herb_id
      and b.quantity_remaining > 0;

    if v_available < v_line.quantity then
      raise exception 'insufficient_stock'
        using detail = json_build_object(
          'herb', v_herb_label,
          'herb_id', v_line.herb_id,
          'required', v_line.quantity,
          'available', v_available
        )::text;
    end if;

    v_needed := v_line.quantity;

    for v_batch in
      select b.id, b.quantity_remaining, b.unit_cost
      from public.herb_batches b
      where b.herb_id = v_line.herb_id
        and b.quantity_remaining > 0
      order by b.expiry_date asc nulls last, b.received_date asc, b.id
      for update
    loop
      exit when v_needed <= 0;

      v_take := least(v_needed, v_batch.quantity_remaining);

      insert into public.dispensing_items (
        clinic_id, dispensing_record_id, herb_id, batch_id, quantity, unit,
        unit_cost_snapshot, line_total
      )
      values (
        v_clinic, v_record_id, v_line.herb_id, v_batch.id, v_take, v_line.unit,
        v_batch.unit_cost,
        case when v_batch.unit_cost is null then null else round(v_batch.unit_cost * v_take, 2) end
      );

      insert into public.stock_movements (
        clinic_id, herb_id, batch_id, movement_type, quantity, unit,
        reference_table, reference_id, created_by
      )
      values (
        v_clinic, v_line.herb_id, v_batch.id, 'dispense', -v_take, v_line.unit,
        'dispensing_records', v_record_id, auth.uid()
      );

      v_total_cost := v_total_cost + coalesce(v_batch.unit_cost, 0) * v_take;
      v_needed := v_needed - v_take;
    end loop;

    -- Reachable only if stock moved between the check above and the allocation.
    if v_needed > 0 then
      raise exception 'insufficient_stock'
        using detail = json_build_object(
          'herb', v_herb_label,
          'herb_id', v_line.herb_id,
          'required', v_line.quantity,
          'available', v_line.quantity - v_needed
        )::text;
    end if;
  end loop;

  if v_line_count = 0 then
    raise exception 'nothing_to_dispense';
  end if;

  update public.dispensing_records
     set total_cost = case when v_total_cost > 0 then round(v_total_cost, 2) else null end
   where id = v_record_id;

  return v_record_id;
end;
$$;

comment on function public.dispense_formula(uuid, uuid, jsonb, numeric, text) is
  'Allocates herb stock first-expiry-first-out and records the dispensing against an encounter. Raises insufficient_stock (with JSON detail) and rolls back entirely rather than deducting partially.';

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.dispensing_records enable row level security;
alter table public.dispensing_items enable row level security;

drop policy if exists dispensing_records_staff_all on public.dispensing_records;
create policy dispensing_records_staff_all on public.dispensing_records
  for all using (public.is_clinic_member(clinic_id))
  with check (public.is_clinic_member(clinic_id));

drop policy if exists dispensing_items_staff_all on public.dispensing_items;
create policy dispensing_items_staff_all on public.dispensing_items
  for all using (public.is_clinic_member(clinic_id))
  with check (public.is_clinic_member(clinic_id));
