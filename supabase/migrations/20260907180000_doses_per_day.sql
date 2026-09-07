-- ============================================================================
-- 24 · How often, as well as how much
-- ============================================================================
-- "One gram after food" is not an instruction until you know whether that is
-- once a day or three times. The amount and the timing were recorded and the
-- frequency between them was not, which left the most operative part of a
-- prescription to the free-text note.
--
-- The preparation is not repeated on the instruction: it is chosen once for the
-- whole prescription and stored on the same row, so saying it twice could only
-- ever produce two answers to one question.
-- ============================================================================

alter table public.dispensing_records
  add column if not exists doses_per_day integer
    check (doses_per_day is null or (doses_per_day >= 1 and doses_per_day <= 12));

comment on column public.dispensing_records.doses_per_day is
  'How many times a day the dose is taken. Bounded at twelve — above that it is a drip, not a prescription, and the number is a typo.';

drop function if exists public.record_prescription(
  uuid, uuid, jsonb, numeric, text, text, text, text, numeric, text, text
);

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
  p_dose_timing text default null,
  p_doses_per_day integer default null
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
    notes, preparation, days_supply, dose_amount, dose_unit, dose_timing, doses_per_day
  )
  values (
    v_clinic, p_encounter_id, v_patient, p_formula_id, coalesce(p_multiplier, 1), auth.uid(),
    nullif(btrim(coalesce(p_notes, '')), ''),
    nullif(p_preparation, ''),
    nullif(btrim(coalesce(p_days_supply, '')), ''),
    p_dose_amount,
    nullif(p_dose_unit, ''),
    nullif(p_dose_timing, ''),
    p_doses_per_day
  )
  returning id into v_record;

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
  'Records a prescription without touching stock: the lines, the preparation, and the full dosing instruction — how much, how often, and when relative to food.';
