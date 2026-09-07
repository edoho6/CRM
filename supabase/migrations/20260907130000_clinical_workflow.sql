-- ============================================================================
-- 19 · Clinical workflow — preparations, outcomes, and prescribing off-catalogue
-- ============================================================================
-- Everything here comes from using the system rather than from designing it:
--
--   · the same herb is kept in more than one preparation, and a shelf holding
--     40g of dried root and 100ml of tincture is not holding "140 of Huang Qi"
--   · a patient file needs an outcome, not just an active flag — "stopped
--     halfway" and "finished, partial improvement" are different facts
--   · a prescription regularly contains something the catalogue has never heard
--     of, and refusing to record it means it gets written on paper instead
--   · a treatment record wants the time of day, not only the date
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Preparations
-- ---------------------------------------------------------------------------
-- Three, because these are what a clinic actually stocks and dispenses. The
-- unit follows from the preparation rather than being chosen separately: a
-- tincture is measured in millilitres and a powder is not, and letting the two
-- be picked independently only ever produces "100g of tincture".

create or replace function public.preparation_unit(p_preparation text)
returns text
language sql
immutable
as $$
  select case p_preparation
           when 'tincture' then 'milliliter'
           else 'gram'
         end;
$$;

comment on function public.preparation_unit(text) is
  'The unit a preparation is measured in. Grams for anything solid, millilitres for a tincture.';

-- --- stock is held per preparation ------------------------------------------

alter table public.herb_batches
  add column if not exists preparation text not null default 'dried_herb';

alter table public.herb_batches
  drop constraint if exists herb_batches_preparation_check;

alter table public.herb_batches
  add constraint herb_batches_preparation_check
  check (preparation in ('dried_herb', 'powder', 'tincture'));

create index if not exists herb_batches_preparation_idx
  on public.herb_batches (clinic_id, herb_id, preparation)
  where quantity_remaining > 0;

alter table public.stock_movements
  add column if not exists preparation text not null default 'dried_herb';

-- --- the order list can hold the same herb in two preparations --------------
-- Ordering dried root and powder of the same herb is an ordinary week, and the
-- old unique index treated the second one as a duplicate of the first.

alter table public.order_list
  add column if not exists preparation text;

alter table public.order_list
  drop constraint if exists order_list_preparation_check;

alter table public.order_list
  add constraint order_list_preparation_check
  check (preparation is null or preparation in ('dried_herb', 'powder', 'tincture'));

drop index if exists public.order_list_pending_herb_idx;
drop index if exists public.order_list_pending_formula_idx;

-- The preparation is part of the identity of a line. coalesce keeps a null
-- (unspecified) from being treated as distinct from another null, which would
-- let the same unspecified herb be added twice.
create unique index if not exists order_list_pending_herb_idx
  on public.order_list (clinic_id, herb_id, coalesce(preparation, ''))
  where herb_id is not null and status <> 'received';

create unique index if not exists order_list_pending_formula_idx
  on public.order_list (clinic_id, formula_id, coalesce(preparation, ''))
  where formula_id is not null and status <> 'received';

-- ---------------------------------------------------------------------------
-- herb_stock_by_preparation — the shelf as it actually looks
-- ---------------------------------------------------------------------------
-- One row per herb and preparation that has ever been received. The existing
-- herb_stock_levels stays as it is and keeps answering "is this herb stocked at
-- all", which is the question the catalogue and the low-stock list ask.

create or replace view public.herb_stock_by_preparation
with (security_invoker = on)
as
select
  b.clinic_id,
  b.herb_id,
  b.preparation,
  public.preparation_unit(b.preparation) as unit,
  sum(b.quantity_remaining) filter (where b.quantity_remaining > 0)::numeric(12, 3) as total_remaining,
  count(b.id) filter (where b.quantity_remaining > 0) as batch_count,
  min(b.expiry_date) filter (where b.quantity_remaining > 0) as nearest_expiry
from public.herb_batches b
group by b.clinic_id, b.herb_id, b.preparation;

comment on view public.herb_stock_by_preparation is
  'Stock split by preparation, because 40g of dried root and 100ml of tincture are not 140 of anything.';

-- ---------------------------------------------------------------------------
-- Treatment outcome on the patient file
-- ---------------------------------------------------------------------------
-- `is_active` answers "should this file appear in the working list". It cannot
-- answer how a course of treatment ended, and conflating the two loses the
-- difference between someone who stopped coming and someone who got better.

alter table public.patients
  add column if not exists treatment_status text not null default 'active';

alter table public.patients
  drop constraint if exists patients_treatment_status_check;

alter table public.patients
  add constraint patients_treatment_status_check
  check (treatment_status in (
    'active',            -- מטופל פעיל
    'completed',         -- סיים טיפולים
    'dropped_out',       -- פרש באמצע
    'full_success',      -- סיים בהצלחה מלאה
    'partial_success',   -- סיים בהצלחה חלקית
    'unsuccessful'       -- טיפול לא צלח
  ));

create index if not exists patients_treatment_status_idx
  on public.patients (clinic_id, treatment_status);

comment on column public.patients.treatment_status is
  'How the course of treatment stands or ended. Separate from is_active, which only decides whether the file shows in the working list.';

-- ---------------------------------------------------------------------------
-- The time a treatment started
-- ---------------------------------------------------------------------------
-- encounter_date is a date, which is right for filing and wrong for a day with
-- six patients in it. Defaulting to now() means opening a record stamps it
-- without anyone having to remember.

alter table public.encounters
  add column if not exists started_at timestamptz not null default now();

comment on column public.encounters.started_at is
  'When the record was opened. encounter_date remains the filing date; this is the time of day, stamped automatically.';

-- ---------------------------------------------------------------------------
-- Prescriptions: preparation, duration, and things not in the catalogue
-- ---------------------------------------------------------------------------

alter table public.dispensing_records
  add column if not exists preparation text;

alter table public.dispensing_records
  drop constraint if exists dispensing_records_preparation_check;

alter table public.dispensing_records
  add constraint dispensing_records_preparation_check
  check (preparation is null or preparation in ('dried_herb', 'powder', 'tincture'));

-- Free text rather than a number of days: practitioners write "10 days", "עד
-- סוף החודש" and "שבועיים, ואז נראה". Forcing that into an integer loses the
-- part that carries the instruction.
alter table public.dispensing_records
  add column if not exists days_supply text;

-- A prescription may name something the catalogue has never heard of. Refusing
-- to record it does not stop it being prescribed — it just moves the record
-- onto a piece of paper, where nothing can ever find it again.
alter table public.dispensing_items
  alter column herb_id drop not null;

alter table public.dispensing_items
  add column if not exists custom_name text;

alter table public.dispensing_items
  drop constraint if exists dispensing_items_needs_a_subject;

alter table public.dispensing_items
  add constraint dispensing_items_needs_a_subject
  check (herb_id is not null or nullif(btrim(coalesce(custom_name, '')), '') is not null);

alter table public.dispensing_items
  add column if not exists preparation text;

alter table public.dispensing_items
  drop constraint if exists dispensing_items_preparation_check;

alter table public.dispensing_items
  add constraint dispensing_items_preparation_check
  check (preparation is null or preparation in ('dried_herb', 'powder', 'tincture'));

-- ---------------------------------------------------------------------------
-- receive_herb_batch — now says which preparation arrived
-- ---------------------------------------------------------------------------
-- The unit is derived rather than passed, so a batch of tincture cannot be
-- booked in in grams. The old parameter is kept in the signature so existing
-- callers still compile, and ignored.
--
-- The old signature has to be dropped rather than replaced: `create or replace`
-- with a different parameter count adds an overload, and a call that matches
-- both through defaults then fails as ambiguous.

drop function if exists public.receive_herb_batch(
  uuid, numeric, text, uuid, text, numeric, date, text, date, text
);

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
  p_notes text default null,
  p_preparation text default 'dried_herb'
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_clinic uuid;
  v_batch uuid;
  v_preparation text := coalesce(nullif(p_preparation, ''), 'dried_herb');
  v_unit text := public.preparation_unit(coalesce(nullif(p_preparation, ''), 'dried_herb'));
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'invalid_quantity';
  end if;

  select clinic_id into v_clinic from public.herbs where id = p_herb_id;
  if v_clinic is null then
    raise exception 'herb_not_found';
  end if;

  insert into public.herb_batches (
    clinic_id, herb_id, supplier_id, batch_number, quantity_received,
    unit, preparation, unit_cost, expiry_date, storage_location, received_date, notes, created_by
  )
  values (
    v_clinic, p_herb_id, p_supplier_id, nullif(btrim(coalesce(p_batch_number, '')), ''), p_quantity,
    v_unit, v_preparation, p_unit_cost, p_expiry_date,
    nullif(btrim(coalesce(p_storage_location, '')), ''),
    coalesce(p_received_date, current_date),
    nullif(btrim(coalesce(p_notes, '')), ''), auth.uid()
  )
  returning id into v_batch;

  -- The opening ledger entry. The trigger on stock_movements is what moves
  -- quantity_remaining, so the balance is always explainable by the ledger.
  insert into public.stock_movements (
    clinic_id, herb_id, batch_id, movement_type, quantity, unit, preparation,
    reference_table, reference_id, created_by
  )
  values (
    v_clinic, p_herb_id, v_batch, 'receive', p_quantity, v_unit, v_preparation,
    'herb_batches', v_batch, auth.uid()
  );

  return v_batch;
end;
$$;

comment on function public.receive_herb_batch is
  'Books a batch in and writes its opening ledger entry. The unit is derived from the preparation, so tincture cannot be received in grams.';

-- ---------------------------------------------------------------------------
-- record_prescription — preparation, duration, and off-catalogue lines
-- ---------------------------------------------------------------------------
-- Dropped rather than replaced, for the same overload reason as above.

drop function if exists public.record_prescription(uuid, uuid, jsonb, numeric, text);

create or replace function public.record_prescription(
  p_encounter_id uuid,
  p_formula_id uuid default null,
  p_items jsonb default '[]'::jsonb,
  p_multiplier numeric default 1,
  p_notes text default null,
  p_preparation text default null,
  p_days_supply text default null,
  p_custom_formula text default null
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
  v_name text;
  v_quantity numeric;
  v_prep text;
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
    clinic_id, encounter_id, patient_id, formula_id, multiplier, dispensed_by,
    notes, preparation, days_supply
  )
  values (
    v_clinic, p_encounter_id, v_patient, p_formula_id, coalesce(p_multiplier, 1), auth.uid(),
    nullif(btrim(coalesce(p_notes, '')), ''),
    nullif(p_preparation, ''),
    nullif(btrim(coalesce(p_days_supply, '')), '')
  )
  returning id into v_record;

  -- A saved formula expands to its lines, scaled.
  if p_formula_id is not null then
    for v_herb, v_quantity in
      select i.herb_id, i.dosage * coalesce(p_multiplier, 1)
      from public.herb_formula_items i
      where i.formula_id = p_formula_id
      order by i.sequence
    loop
      insert into public.dispensing_items (
        clinic_id, dispensing_record_id, herb_id, quantity, unit, preparation
      )
      values (
        v_clinic, v_record, v_herb, v_quantity,
        public.preparation_unit(coalesce(p_preparation, 'dried_herb')),
        nullif(p_preparation, '')
      );
      v_count := v_count + 1;
    end loop;
  end if;

  -- A formula that is not in the catalogue is recorded as a single named line,
  -- so the prescription is still findable later.
  if p_formula_id is null and nullif(btrim(coalesce(p_custom_formula, '')), '') is not null then
    insert into public.dispensing_items (
      clinic_id, dispensing_record_id, custom_name, quantity, unit, preparation
    )
    values (
      v_clinic, v_record, btrim(p_custom_formula), 1,
      public.preparation_unit(coalesce(p_preparation, 'dried_herb')),
      nullif(p_preparation, '')
    );
    v_count := v_count + 1;
  end if;

  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    v_herb := nullif(v_item ->> 'herb_id', '')::uuid;
    v_name := nullif(btrim(coalesce(v_item ->> 'name', '')), '');
    v_quantity := nullif(v_item ->> 'quantity', '')::numeric * coalesce(p_multiplier, 1);
    v_prep := coalesce(nullif(v_item ->> 'preparation', ''), nullif(p_preparation, ''), 'dried_herb');

    -- A line needs a subject and an amount. Anything else is a half-filled row
    -- the practitioner abandoned, and writing it would be worse than skipping it.
    if (v_herb is null and v_name is null) or v_quantity is null or v_quantity <= 0 then
      continue;
    end if;

    insert into public.dispensing_items (
      clinic_id, dispensing_record_id, herb_id, custom_name, quantity, unit, preparation
    )
    values (
      v_clinic, v_record, v_herb, case when v_herb is null then v_name else null end,
      v_quantity, public.preparation_unit(v_prep), v_prep
    );
    v_count := v_count + 1;
  end loop;

  if v_count = 0 then
    raise exception 'nothing_to_dispense';
  end if;

  return v_record;
end;
$$;

comment on function public.record_prescription is
  'Records a prescription without touching stock, including preparations, a duration in the practitioner''s own words, and lines the catalogue has never heard of.';
