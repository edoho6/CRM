-- ============================================================================
-- 29 · Six preparations, and units a patient can actually measure
-- ============================================================================
-- Two changes, both widening what is allowed rather than moving anything.
--
-- 1 · Preparations. There were three; a practice stocks six. Dry extract and
--     ground herb are new, and so are capsules. `powder` keeps its name in the
--     database and gains the label "granules 5:1" in the interface — renaming
--     the value would mean migrating every existing row to say the same thing.
--
-- 2 · Dose units. A prescription written in grams is one the patient cannot
--     follow without kitchen scales. A teaspoon, a capful, a dropper — these are
--     how the instruction is actually given, and until now none of them could be
--     recorded, so the unit on the label was whatever the stock was weighed in.
--
-- Nothing is removed and no row changes. Every existing value stays valid, so
-- this is safe to run against live data and safe to re-run.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Preparations
-- ---------------------------------------------------------------------------
-- The same list in four places, because four tables record what form a herb is
-- in: the batch on the shelf, the line dispensed from it, the formula's own
-- default, and the item inside a formula.

do $$
declare
  v_table text;
  v_column text;
  v_nullable boolean;
  v_target record;
begin
  for v_target in
    select *
    from (values
      ('herb_batches',        'preparation', false),
      ('order_list',          'preparation', true),
      ('dispensing_records',  'preparation', true),
      ('dispensing_items',    'preparation', true),
      ('treatment_protocols', 'preparation', true)
    ) as t(table_name, column_name, nullable)
  loop
    v_table := v_target.table_name;
    v_column := v_target.column_name;
    v_nullable := v_target.nullable;

    -- Only tables that actually carry the column. The set has grown over
    -- several migrations and not every install has every one.
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = v_table and column_name = v_column
    ) then
      continue;
    end if;

    execute format(
      'alter table public.%I drop constraint if exists %I',
      v_table, v_table || '_' || v_column || '_check'
    );

    execute format(
      'alter table public.%I add constraint %I check (%s %I in (%L, %L, %L, %L, %L, %L))',
      v_table,
      v_table || '_' || v_column || '_check',
      case when v_nullable then format('%I is null or', v_column) else '' end,
      v_column,
      'dried_herb', 'powder', 'tincture', 'dry_extract', 'ground_herb', 'capsule'
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Dose units
-- ---------------------------------------------------------------------------

alter table public.dispensing_records
  drop constraint if exists dispensing_records_dose_unit_check;

alter table public.dispensing_records
  add constraint dispensing_records_dose_unit_check
  check (dose_unit is null or dose_unit in (
    'gram', 'capsule', 'bottle', 'box', 'milliliter', 'packet',
    'teaspoon', 'tablespoon', 'cup', 'dose', 'cap', 'dropper'
  ));

alter table public.treatment_protocols
  drop constraint if exists treatment_protocols_dose_unit_check;

alter table public.treatment_protocols
  add constraint treatment_protocols_dose_unit_check
  check (dose_unit is null or dose_unit in (
    'gram', 'capsule', 'bottle', 'box', 'milliliter', 'packet',
    'teaspoon', 'tablespoon', 'cup', 'dose', 'cap', 'dropper'
  ));

comment on column public.dispensing_records.dose_unit is
  'The unit the patient measures a dose in — grams, a teaspoon, a dropper. Not the unit the stock was weighed in, which stays on the batch.';

-- ---------------------------------------------------------------------------
-- The practitioner's own contact details
-- ---------------------------------------------------------------------------
-- Their address and email, not the clinic's. A practitioner who rents a room
-- two days a week is not at the clinic's address, and the documents printed for
-- a patient carry the person rather than the premises.
--
-- The email is stored here rather than read from `auth.users`: the address you
-- sign in with and the address you put on a document are not always the same
-- one, and the sign-in address is not ours to publish.

alter table public.profiles
  add column if not exists email text;

alter table public.profiles
  add column if not exists address text;

-- ---------------------------------------------------------------------------
-- One treatment type to start with
-- ---------------------------------------------------------------------------
-- A new clinic had none at all, which meant the first booking could not name
-- what it was for until somebody went to the personal area and invented a list.
-- One sixty-minute treatment is what almost every practice starts from, and it
-- is renamed rather than added to.
--
-- The English name is left null: it is optional now, and the calendar falls back
-- to the Hebrew, so seeding a translation nobody asked for would be inventing
-- one.

alter table public.appointment_types
  alter column name_en drop not null;

create or replace function public.seed_default_appointment_type()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.appointment_types (clinic_id, name_he, default_duration_minutes, sort_order)
  values (new.id, 'טיפול', 60, 0);
  return new;
end;
$$;

drop trigger if exists clinics_seed_appointment_type on public.clinics;
create trigger clinics_seed_appointment_type
  after insert on public.clinics
  for each row execute function public.seed_default_appointment_type();

-- And for clinics that already exist with an empty list. Only where there is
-- nothing at all, so a practice that has built its own set is untouched.
insert into public.appointment_types (clinic_id, name_he, default_duration_minutes, sort_order)
select c.id, 'טיפול', 60, 0
from public.clinics c
where not exists (
  select 1 from public.appointment_types t where t.clinic_id = c.id
);
