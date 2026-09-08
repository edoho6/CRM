-- ============================================================================
-- 26 · Treatment protocols — the combinations a practitioner repeats
-- ============================================================================
-- Every practitioner has a handful of point combinations and prescriptions they
-- come back to: the one for a tension headache, the one for damp-heat in the
-- lower burner, the one they were taught for insomnia. Today each of those is
-- retyped from memory at every treatment, which is slow and — more to the point
-- — inconsistent, because what gets retyped is what was remembered that day.
--
-- A protocol is a *starting point*, never a prescription. Applying one fills the
-- fields in and leaves every one of them editable, and nothing links the
-- resulting treatment back to it. That is deliberate: a patient is treated, not
-- a protocol, and a record that said "protocol #4 was administered" would be a
-- record of the wrong thing. The clinical record stays the authoritative account
-- of what was actually done.
--
-- Not modelled: versioning. Editing a protocol does not reach back into
-- treatments that were started from it, because those treatments recorded what
-- happened rather than a reference. There is nothing to keep in sync.
-- ============================================================================

create table if not exists public.treatment_protocols (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null default public.current_clinic_id() references public.clinics(id) on delete cascade,

  name text not null,
  description text,

  -- What it is for, in the practitioner's own words. Searched, so a protocol can
  -- be found by the pattern it treats rather than only by the name given to it.
  indications text,
  treatment_principle text,

  /**
   * The same shape as `tcm_notes.points_used`:
   * [{ point, side, technique, retention_minutes, notes }].
   *
   * Copied on apply rather than referenced, for the reason in the header: the
   * treatment record has to stand on its own.
   */
  points_used jsonb not null default '[]'::jsonb,

  -- A classical formula, when the protocol is built on one.
  formula_id uuid references public.herb_formulas(id) on delete set null,

  /**
   * Loose herbs, as [{ herb_id, name, quantity, preparation }] — the same shape
   * `record_prescription` takes, so applying a protocol is a copy and not a
   * translation.
   */
  herbs jsonb not null default '[]'::jsonb,

  preparation text,
  days_supply text,
  dose_amount numeric(10, 2) check (dose_amount is null or dose_amount > 0),
  dose_unit text check (dose_unit is null or dose_unit in (
    'gram', 'capsule', 'bottle', 'box', 'milliliter', 'packet'
  )),
  dose_timing text check (dose_timing is null or dose_timing in (
    'before_meal', 'after_meal', 'with_meal', 'empty_stomach'
  )),
  doses_per_day integer
    check (doses_per_day is null or (doses_per_day >= 1 and doses_per_day <= 12)),

  -- Retired rather than deleted, so a protocol that is no longer offered stops
  -- appearing in the picker without disturbing anything.
  is_active boolean not null default true,
  sort_order integer not null default 0,

  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint treatment_protocols_points_is_array check (jsonb_typeof(points_used) = 'array'),
  constraint treatment_protocols_herbs_is_array check (jsonb_typeof(herbs) = 'array'),
  constraint treatment_protocols_name_not_blank check (length(btrim(name)) > 0)
);

create index if not exists treatment_protocols_clinic_idx
  on public.treatment_protocols (clinic_id, sort_order, name)
  where is_active;

drop trigger if exists treatment_protocols_set_updated_at on public.treatment_protocols;
create trigger treatment_protocols_set_updated_at
  before update on public.treatment_protocols
  for each row execute function public.set_updated_at();

-- A protocol is not patient data, but it is clinical content, and "who changed
-- the insomnia protocol and when" is a question worth being able to answer.
drop trigger if exists treatment_protocols_audit on public.treatment_protocols;
create trigger treatment_protocols_audit
  after insert or update or delete on public.treatment_protocols
  for each row execute function public.write_audit_log();

alter table public.treatment_protocols enable row level security;

-- Clinic-scoped like everything else. No patient-portal policy: a protocol is
-- the practitioner's working material and has no reason to leave the clinic.
drop policy if exists treatment_protocols_staff_all on public.treatment_protocols;
create policy treatment_protocols_staff_all on public.treatment_protocols
  for all using (public.is_clinic_member(clinic_id))
  with check (public.is_clinic_member(clinic_id));

comment on table public.treatment_protocols is
  'Reusable point combinations and prescriptions. Applying one fills a treatment in and leaves it editable; nothing links the treatment back to the protocol.';
