-- ============================================================================
-- 21 · How the patient takes it
-- ============================================================================
-- What was dispensed is recorded; how to take it was not. It lived in the free
-- text note, where it cannot be read back, cannot be printed onto a label, and
-- cannot be carried forward to the next prescription.
--
-- Three fields, because three separate things are being said: how much per
-- dose, in what unit, and when relative to eating. "One gram of granule twice
-- daily after food" is a different instruction from "one gram before food", and
-- the difference is clinical rather than cosmetic.
-- ============================================================================

alter table public.dispensing_records
  add column if not exists dose_amount numeric(10, 2)
    check (dose_amount is null or dose_amount > 0);

alter table public.dispensing_records
  add column if not exists dose_unit text;

alter table public.dispensing_records
  drop constraint if exists dispensing_records_dose_unit_check;

alter table public.dispensing_records
  add constraint dispensing_records_dose_unit_check
  check (dose_unit is null or dose_unit in (
    'gram', 'capsule', 'bottle', 'box', 'milliliter', 'packet'
  ));

alter table public.dispensing_records
  add column if not exists dose_timing text;

alter table public.dispensing_records
  drop constraint if exists dispensing_records_dose_timing_check;

alter table public.dispensing_records
  add constraint dispensing_records_dose_timing_check
  check (dose_timing is null or dose_timing in (
    'before_meal',    -- לפני ארוחה
    'after_meal',     -- אחרי ארוחה
    'with_meal',      -- עם הארוחה
    'empty_stomach'   -- על בטן ריקה
  ));

comment on column public.dispensing_records.dose_amount is
  'How much the patient takes at a time — not how much was dispensed, which is quantity on the lines.';

-- ---------------------------------------------------------------------------
-- record_prescription carries the instruction
-- ---------------------------------------------------------------------------
-- Dropped and recreated rather than replaced: `create or replace` with a
-- different parameter count adds an overload, and a call that matches both
-- through defaults then fails as ambiguous.

drop function if exists public.record_prescription(uuid, uuid, jsonb, numeric, text, text, text, text);

create or replace function public.record_prescription(
  p_encounter_id uuid,
  p_formula_id uuid default null,
  p_items jsonb default '[]'::jsonb,
  p_multiplier numeric default 1,
  p_notes text default null,
  p_preparation text default null,
  p_days_supply text default null,
  p_custom_formula text default null,
  p_dose_amount numeric default null,
  p_dose_unit text default null,
  p_dose_timing text default null
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
    notes, preparation, days_supply, dose_amount, dose_unit, dose_timing
  )
  values (
    v_clinic, p_encounter_id, v_patient, p_formula_id, coalesce(p_multiplier, 1), auth.uid(),
    nullif(btrim(coalesce(p_notes, '')), ''),
    nullif(p_preparation, ''),
    nullif(btrim(coalesce(p_days_supply, '')), ''),
    p_dose_amount,
    nullif(p_dose_unit, ''),
    nullif(p_dose_timing, '')
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
  'Records a prescription without touching stock, including the preparation, the dosing instruction, and lines the catalogue has never heard of.';
