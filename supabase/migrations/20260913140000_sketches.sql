-- Migration 46 — a page written by hand on the treatment record.
--
-- A practitioner with a pen on a tablet draws or writes on a page that is
-- saved to the patient's document file as a PNG, category 'sketch', tied to
-- the treatment — the same bucket, the same row-level rules, the same access
-- log as every other document. Only the category list changes.
alter table public.patient_documents drop constraint if exists patient_documents_category_check;
alter table public.patient_documents add constraint patient_documents_category_check
  check (category in ('intake_form', 'lab_result', 'id_scan', 'tongue', 'sketch', 'other'));
