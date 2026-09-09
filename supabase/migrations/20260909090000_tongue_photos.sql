-- ============================================================================
--  Tongue photographs
-- ============================================================================
--  A photograph of the tongue is a patient document like any other — the same
--  private bucket, the same row-level rules, the same access log — with two
--  things the other documents do not need: a category of its own, so the file
--  can be told apart from a lab result, and the treatment it was taken at, so
--  the record shows it beside that visit's tongue findings and the comparison
--  can line it up against the visit before.
--
--  `on delete set null` rather than cascade: deleting a treatment record must
--  not take a photograph off the patient's file. It becomes unattached and is
--  still theirs.
-- ============================================================================

alter table public.patient_documents
  add column if not exists encounter_id uuid references public.encounters(id) on delete set null;

-- The inline check on `category` was named by Postgres; recreate it with the
-- new value. `drop ... if exists` keeps this safe to run twice.
alter table public.patient_documents
  drop constraint if exists patient_documents_category_check;

alter table public.patient_documents
  add constraint patient_documents_category_check
  check (category in ('intake_form', 'lab_result', 'id_scan', 'tongue', 'other'));

-- Two lookups: the photographs of one treatment, and every photograph of one
-- kind on a patient's file, newest first.
create index if not exists patient_documents_encounter_idx
  on public.patient_documents (clinic_id, encounter_id)
  where encounter_id is not null;

create index if not exists patient_documents_category_idx
  on public.patient_documents (clinic_id, patient_id, category, created_at desc);

comment on column public.patient_documents.encounter_id is
  'The treatment this document belongs to, where it belongs to one — a tongue photograph taken at a visit. Null for a file that is simply on the patient''s record.';
