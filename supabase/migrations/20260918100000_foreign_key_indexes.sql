-- ============================================================================
-- 70 · Indexes on the keys the application actually looks things up by
-- ============================================================================
-- Postgres indexes the *referenced* side of a foreign key — it has to, that side
-- is a key — and never the referencing side. So `where encounter_id = $1` on
-- tcm_notes, which runs on every single open of a treatment, has nothing to use.
--
-- Ninety-nine foreign-key columns in this database have no index. Twenty-seven
-- of them are filtered on somewhere in the application; the rest are there for
-- referential integrity and are never searched by. This file indexes the subset
-- that is both: filtered on, and on a table that grows with the practice. An
-- index on `rooms.location_id` would be write cost for a table with four rows
-- in it, and is not here.
--
-- Why the existing composite indexes do not already cover this. They lead with
-- `clinic_id`:
--
--     encounters   (clinic_id, patient_id, encounter_date desc)
--     appointments (clinic_id, patient_id, start_at desc)
--
-- which is the right shape for a query that names the clinic. The application's
-- queries do not name it: isolation comes from the policy, which is
-- `is_clinic_member(clinic_id)` — a function call, not a constant the planner
-- can turn into a range on the leading column. So a lookup by patient alone
-- cannot use those indexes and falls back to a scan.
--
-- **What this does and does not buy.** With one clinic and a few hundred rows a
-- table, Postgres would scan them about as fast either way; nobody will feel
-- this today, and this file is not pretending otherwise. It is the difference
-- between a system that stays fast as the practice fills up — and as a second
-- clinic arrives — and one that quietly gets slower for reasons nobody connects
-- to a missing index two years later.
--
-- Not `concurrently`: that cannot run inside a transaction, and the tables here
-- are small enough that the brief write lock is measured in milliseconds. On a
-- database with real volume this file would be run statement by statement with
-- `concurrently` instead.
--
-- The `_only_idx` suffix means "this column on its own, no clinic_id in front",
-- and it exists because eight of these would otherwise have collided with the
-- composite of the same obvious name — `patient_documents_patient_idx` is
-- already `(clinic_id, patient_id, created_at desc)`. `create index if not
-- exists` does not compare definitions: it sees the name, finds it taken, and
-- does nothing at all. Eight indexes would have been silently not created.
-- ============================================================================

-- --- The treatment, and everything hanging off one ---------------------------

-- Read on every open of a treatment page: the note is one-to-one with the visit.
create index if not exists tcm_notes_encounter_only_idx on public.tcm_notes (encounter_id);

-- The patient file lists a person's visits; the diary opens the visit for a slot.
create index if not exists encounters_patient_only_idx on public.encounters (patient_id);
create index if not exists encounters_appointment_idx on public.encounters (appointment_id)
  where appointment_id is not null;

create index if not exists appointments_patient_only_idx on public.appointments (patient_id);

-- --- The file's own tabs -----------------------------------------------------

create index if not exists patient_documents_patient_only_idx on public.patient_documents (patient_id);
create index if not exists patient_documents_encounter_only_idx on public.patient_documents (encounter_id)
  where encounter_id is not null;

create index if not exists form_submissions_patient_only_idx on public.form_submissions (patient_id);
create index if not exists form_submissions_encounter_only_idx on public.form_submissions (encounter_id)
  where encounter_id is not null;

create index if not exists dispensing_records_patient_only_idx on public.dispensing_records (patient_id);

create index if not exists patient_consents_patient_only_idx on public.patient_consents (patient_id);
create index if not exists patient_medical_history_patient_only_idx
  on public.patient_medical_history (patient_id);
create index if not exists patient_tag_links_tag_only_idx on public.patient_tag_links (tag_id);

create index if not exists treatment_confirmations_patient_only_idx
  on public.treatment_confirmations (patient_id);

create index if not exists clinic_tasks_patient_only_idx on public.clinic_tasks (patient_id)
  where patient_id is not null;

-- --- Money -------------------------------------------------------------------

-- "Is there already an invoice for this visit?" — asked before every new one,
-- so that re-opening the screen cannot bill the same treatment twice.
create index if not exists invoices_encounter_only_idx on public.invoices (encounter_id)
  where encounter_id is not null;

-- --- The shelf ---------------------------------------------------------------

-- A herb's stock history, its batches, and the formulas it appears in: all three
-- are "everything for this herb", and all three scanned.
create index if not exists stock_movements_herb_only_idx on public.stock_movements (herb_id);
create index if not exists herb_batches_herb_only_idx on public.herb_batches (herb_id);
create index if not exists herb_formula_items_herb_only_idx on public.herb_formula_items (herb_id);

insert into public.schema_migrations (name, note)
values ('62_foreign_key_indexes_to_run.sql', null)
on conflict (name) do nothing;
