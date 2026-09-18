-- ============================================================================
-- Security audit fixes (18.9 audit, wave 1)
-- ============================================================================
-- The whole-project audit of 18.9 found that the roles of migration 78 were
-- enforced only in part, and a handful of doors around them stood open. This
-- file closes what the database can close:
--
--   1 · a person in two clinics carried the role of the clinic they were
--       working in into the other one — every patient policy now reads the row
--       of the clinic in force, not of any clinic the person belongs to
--   2 · the link table is readable by the person it names and the owner, and
--       an owner's hand-made link must name a patient and a member of their own
--   3 · the audit log carries whole rows of clinical tables: owner only
--   4 · stored files follow their `patient_documents` row, so a file is
--       reachable exactly when its row is
--   5 · signatures, consent decisions, reopened-signature history, the message
--       log, WhatsApp threads and the herb/formula/point catalogue now ask for a
--       role, not only a membership
--   6 · patient portal access is granted by the owner only, for a patient of
--       the clinic, and never to the person granting it
--   7 · memberships are written only through the invitation and team functions;
--       two owners demoting each other at once can no longer leave none
--   8 · rows a patient writes from the portal take their clinic from the patient
--       (the questionnaire and consent in the portal failed on a null clinic)
--   9 · the booking page: the SMS code's wrong guesses are counted for real,
--       codes come from a strong random source, sends are limited per phone,
--       per clinic and across the service, and every outcome is a typed result
--  10 · the booking page offers only practitioners, reads only this clinic's
--       hours, and never makes an existing patient someone's by itself
--  11 · Grow settlement checks the amount and the currency, and a paid payment
--       never goes back; invoice status follows what was actually paid
--  12 · moving an appointment clears its reminder so a new one goes out, and
--       withdraws a queued reminder that has not been picked up
--  13 · the message queue is claimed atomically (queued → sending), a claim that
--       never finished stops for a person to look at instead of being resent,
--       and a push goes only to someone of the clinic that queued it
--  14 · direct writes to the message log are limited to a test message to
--       oneself and to marking a message skipped
--  15 · dispensing with its details in one transaction, with an idempotency key
--  16 · the access log refuses a record the caller cannot read
--  17 · "send now" is for the clinic's roles and its links must be well formed
--  18 · the portal password check matches the address as well (missing from the
--       hand-run copy of migration 68)
--  19 · patient status counts are counted by the database
--
-- Every new or rewritten SECURITY DEFINER function here has `search_path = ''`
-- and names every object with its schema, revokes EXECUTE from public, anon and
-- authenticated, and grants it only to the role that needs it.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1 · Patient policies read the clinic in force
-- ---------------------------------------------------------------------------
-- `is_clinic_member(clinic_id)` is true for every clinic a person belongs to,
-- while `sees_patient` / `sees_clinical` look the role up in the clinic they are
-- working in. Paired, a secretary of clinic A who owns clinic B read A's
-- records while B was active. The row's clinic must be the clinic in force.
-- `current_clinic_id()` is null for a session that still owes its second
-- factor, so that check is kept.

drop policy if exists patients_staff_read on public.patients;
create policy patients_staff_read on public.patients
  for select using (clinic_id = (select public.current_clinic_id()) and public.sees_patient(id));

drop policy if exists patients_staff_write on public.patients;
create policy patients_staff_write on public.patients
  for update using (clinic_id = (select public.current_clinic_id()) and public.sees_patient(id))
  with check (clinic_id = (select public.current_clinic_id()) and public.sees_patient(id));

drop policy if exists patients_owner_deletes on public.patients;
create policy patients_owner_deletes on public.patients
  for delete using (
    clinic_id = (select public.current_clinic_id())
    and public.has_clinic_role(clinic_id, array['owner'])
  );

drop policy if exists patients_staff_insert on public.patients;
create policy patients_staff_insert on public.patients
  for insert
  with check (
    clinic_id = (select public.current_clinic_id())
    and public.has_clinic_role(clinic_id, array['owner', 'practitioner', 'staff'])
  );

drop policy if exists appointments_staff_all on public.appointments;
create policy appointments_staff_all on public.appointments
  for all using (clinic_id = (select public.current_clinic_id()) and public.sees_patient(patient_id))
  with check (clinic_id = (select public.current_clinic_id()) and public.sees_patient(patient_id));

drop policy if exists invoices_staff_all on public.invoices;
create policy invoices_staff_all on public.invoices
  for all using (clinic_id = (select public.current_clinic_id()) and public.sees_patient(patient_id))
  with check (clinic_id = (select public.current_clinic_id()) and public.sees_patient(patient_id));

drop policy if exists patient_packages_staff_all on public.patient_packages;
create policy patient_packages_staff_all on public.patient_packages
  for all using (clinic_id = (select public.current_clinic_id()) and public.sees_patient(patient_id))
  with check (clinic_id = (select public.current_clinic_id()) and public.sees_patient(patient_id));

drop policy if exists treatment_confirmations_staff_all on public.treatment_confirmations;
create policy treatment_confirmations_staff_all on public.treatment_confirmations
  for all using (clinic_id = (select public.current_clinic_id()) and public.sees_patient(patient_id))
  with check (clinic_id = (select public.current_clinic_id()) and public.sees_patient(patient_id));

drop policy if exists clinic_tasks_staff_all on public.clinic_tasks;
create policy clinic_tasks_staff_all on public.clinic_tasks
  for all
  using (clinic_id = (select public.current_clinic_id()) and (patient_id is null or public.sees_patient(patient_id)))
  with check (clinic_id = (select public.current_clinic_id()) and (patient_id is null or public.sees_patient(patient_id)));

drop policy if exists encounters_staff_all on public.encounters;
create policy encounters_staff_all on public.encounters
  for all
  using (clinic_id = (select public.current_clinic_id()) and (select public.sees_clinical()) and public.sees_patient(patient_id))
  with check (clinic_id = (select public.current_clinic_id()) and (select public.sees_clinical()) and public.sees_patient(patient_id));

drop policy if exists patient_medical_history_staff_all on public.patient_medical_history;
create policy patient_medical_history_staff_all on public.patient_medical_history
  for all
  using (clinic_id = (select public.current_clinic_id()) and (select public.sees_clinical()) and public.sees_patient(patient_id))
  with check (clinic_id = (select public.current_clinic_id()) and (select public.sees_clinical()) and public.sees_patient(patient_id));

drop policy if exists patient_documents_staff_all on public.patient_documents;
create policy patient_documents_staff_all on public.patient_documents
  for all
  using (clinic_id = (select public.current_clinic_id()) and (select public.sees_clinical()) and public.sees_patient(patient_id))
  with check (clinic_id = (select public.current_clinic_id()) and (select public.sees_clinical()) and public.sees_patient(patient_id));

drop policy if exists dispensing_records_staff_all on public.dispensing_records;
create policy dispensing_records_staff_all on public.dispensing_records
  for all
  using (clinic_id = (select public.current_clinic_id()) and (select public.sees_clinical()) and public.sees_patient(patient_id))
  with check (clinic_id = (select public.current_clinic_id()) and (select public.sees_clinical()) and public.sees_patient(patient_id));

drop policy if exists form_submissions_staff_all on public.form_submissions;
create policy form_submissions_staff_all on public.form_submissions
  for all
  using (clinic_id = (select public.current_clinic_id()) and (select public.sees_clinical()) and public.sees_patient(patient_id))
  with check (clinic_id = (select public.current_clinic_id()) and (select public.sees_clinical()) and public.sees_patient(patient_id));

drop policy if exists patient_tag_links_staff_all on public.patient_tag_links;
create policy patient_tag_links_staff_all on public.patient_tag_links
  for all
  using (clinic_id = (select public.current_clinic_id()) and (select public.sees_clinical()) and public.sees_patient(patient_id))
  with check (clinic_id = (select public.current_clinic_id()) and (select public.sees_clinical()) and public.sees_patient(patient_id));

drop policy if exists tcm_notes_staff_all on public.tcm_notes;
create policy tcm_notes_staff_all on public.tcm_notes
  for all
  using (
    clinic_id = (select public.current_clinic_id())
    and exists (select 1 from public.encounters e where e.id = tcm_notes.encounter_id)
  )
  with check (
    clinic_id = (select public.current_clinic_id())
    and exists (select 1 from public.encounters e where e.id = tcm_notes.encounter_id)
  );

drop policy if exists dispensing_items_staff_all on public.dispensing_items;
create policy dispensing_items_staff_all on public.dispensing_items
  for all
  using (
    clinic_id = (select public.current_clinic_id())
    and exists (select 1 from public.dispensing_records d where d.id = dispensing_items.dispensing_record_id)
  )
  with check (
    clinic_id = (select public.current_clinic_id())
    and exists (select 1 from public.dispensing_records d where d.id = dispensing_items.dispensing_record_id)
  );

drop policy if exists invoice_items_staff_all on public.invoice_items;
create policy invoice_items_staff_all on public.invoice_items
  for all
  using (
    clinic_id = (select public.current_clinic_id())
    and exists (select 1 from public.invoices i where i.id = invoice_items.invoice_id)
  )
  with check (
    clinic_id = (select public.current_clinic_id())
    and exists (select 1 from public.invoices i where i.id = invoice_items.invoice_id)
  );

drop policy if exists payments_staff_all on public.payments;
create policy payments_staff_all on public.payments
  for all
  using (
    clinic_id = (select public.current_clinic_id())
    and exists (select 1 from public.invoices i where i.id = payments.invoice_id)
  )
  with check (
    clinic_id = (select public.current_clinic_id())
    and exists (select 1 from public.invoices i where i.id = payments.invoice_id)
  );

drop policy if exists package_redemptions_staff_all on public.package_redemptions;
create policy package_redemptions_staff_all on public.package_redemptions
  for all
  using (
    clinic_id = (select public.current_clinic_id())
    and exists (select 1 from public.patient_packages p where p.id = package_redemptions.package_id)
  )
  with check (
    clinic_id = (select public.current_clinic_id())
    and exists (select 1 from public.patient_packages p where p.id = package_redemptions.package_id)
  );

-- ---------------------------------------------------------------------------
-- 2 · Who treats whom: readable by the person named and the owner
-- ---------------------------------------------------------------------------
-- Any member could list every patient id and who treats them. An owner's link
-- by hand must name a patient and a member of the owner's own clinic, and only
-- a hand-made link may be taken away (the diary's and the record's are history).

drop policy if exists patient_practitioners_read on public.patient_practitioners;
create policy patient_practitioners_read on public.patient_practitioners
  for select using (
    clinic_id = (select public.current_clinic_id())
    and (user_id = (select auth.uid()) or public.has_clinic_role(clinic_id, array['owner']))
  );

drop policy if exists patient_practitioners_owner_writes on public.patient_practitioners;
drop policy if exists patient_practitioners_owner_inserts on public.patient_practitioners;
create policy patient_practitioners_owner_inserts on public.patient_practitioners
  for insert with check (
    clinic_id = (select public.current_clinic_id())
    and public.has_clinic_role(clinic_id, array['owner'])
    and source = 'manual'
    and exists (select 1 from public.patients p where p.id = patient_practitioners.patient_id and p.clinic_id = patient_practitioners.clinic_id)
    and exists (
      select 1 from public.memberships m
       where m.user_id = patient_practitioners.user_id
         and m.clinic_id = patient_practitioners.clinic_id
         and m.is_active
    )
  );

drop policy if exists patient_practitioners_owner_deletes on public.patient_practitioners;
create policy patient_practitioners_owner_deletes on public.patient_practitioners
  for delete using (
    clinic_id = (select public.current_clinic_id())
    and public.has_clinic_role(clinic_id, array['owner'])
    and source = 'manual'
  );

-- ---------------------------------------------------------------------------
-- 3 · The audit log is the owner's
-- ---------------------------------------------------------------------------
-- `write_audit_log` stores whole rows of the treatment record, notes, history,
-- questionnaires and dispensing; a member-wide read policy handed all of it to
-- the secretary. The access screen and the export's history are the owner's.

drop policy if exists audit_log_select on public.audit_log;
create policy audit_log_select on public.audit_log
  for select using (
    clinic_id = (select public.current_clinic_id())
    and (select public.has_clinic_role(public.current_clinic_id(), array['owner']))
  );

-- ---------------------------------------------------------------------------
-- 4 · A stored file is reachable exactly when its row is
-- ---------------------------------------------------------------------------
-- The subquery runs under the caller's own policies on `patient_documents`, so
-- the clinic in force, `sees_clinical` and `sees_patient` all apply to the
-- file as they do to the row. This fixes the order of operations the app must
-- follow: on upload the row comes first, and on deletion the file goes before
-- the row (features/documents/actions.ts).

-- The row is written before the file, marked pending, and cleared once the
-- file is stored. A row still pending is an upload that did not complete: the
-- panel says so and offers to remove it, and the portal never shows it.
alter table public.patient_documents
  add column if not exists upload_pending boolean not null default false;

comment on column public.patient_documents.upload_pending is
  'True from the moment the row is written until its file is stored. Still true afterwards means the upload failed half-way.';

drop policy if exists patient_documents_portal_self on public.patient_documents;
create policy patient_documents_portal_self on public.patient_documents
  for select using (
    patient_id = public.current_patient_id()
    and shared_with_patient
    and not upload_pending
  );

drop policy if exists patient_documents_storage_staff on storage.objects;
create policy patient_documents_storage_staff on storage.objects
  for all
  using (
    bucket_id = 'patient-documents'
    and split_part(name, '/', 1) = (select public.current_clinic_id())::text
    and exists (select 1 from public.patient_documents d where d.file_path = storage.objects.name)
  )
  with check (
    bucket_id = 'patient-documents'
    and split_part(name, '/', 1) = (select public.current_clinic_id())::text
    and exists (select 1 from public.patient_documents d where d.file_path = storage.objects.name)
  );

-- Herb pictures are catalogue content: read by the clinic, written by those who
-- may edit the catalogue.
drop policy if exists herb_images_staff_write on storage.objects;
create policy herb_images_staff_write on storage.objects
  for all
  using (
    bucket_id = 'herb-images'
    and split_part(name, '/', 1) = (select public.current_clinic_id())::text
    and (select public.has_clinic_role(public.current_clinic_id(), array['owner', 'practitioner']))
  )
  with check (
    bucket_id = 'herb-images'
    and split_part(name, '/', 1) = (select public.current_clinic_id())::text
    and (select public.has_clinic_role(public.current_clinic_id(), array['owner', 'practitioner']))
  );

-- ---------------------------------------------------------------------------
-- 5 · Tables that asked for a membership and not a role
-- ---------------------------------------------------------------------------

-- Consent decisions are part of the file (the desk records them), judged by
-- the patient.
drop policy if exists patient_consents_staff_read on public.patient_consents;
create policy patient_consents_staff_read on public.patient_consents
  for select using (clinic_id = (select public.current_clinic_id()) and public.sees_patient(patient_id));

drop policy if exists patient_consents_staff_insert on public.patient_consents;
create policy patient_consents_staff_insert on public.patient_consents
  for insert with check (clinic_id = (select public.current_clinic_id()) and public.sees_patient(patient_id));

-- A signature under a consent follows the patient; one under a questionnaire
-- is clinical, like the questionnaire.
drop policy if exists signatures_staff_read on public.signatures;
create policy signatures_staff_read on public.signatures
  for select using (
    clinic_id = (select public.current_clinic_id())
    and public.sees_patient(patient_id)
    and (form_submission_id is null or (select public.sees_clinical()))
  );

drop policy if exists signatures_staff_insert on public.signatures;
create policy signatures_staff_insert on public.signatures
  for insert with check (
    clinic_id = (select public.current_clinic_id())
    and public.sees_patient(patient_id)
    and (form_submission_id is null or (select public.sees_clinical()))
  );

-- A reopened signature carries the reason the record was reopened — clinical.
drop policy if exists encounter_signatures_select on public.encounter_signatures;
create policy encounter_signatures_select on public.encounter_signatures
  for select using (
    clinic_id = (select public.current_clinic_id())
    and exists (select 1 from public.encounters e where e.id = encounter_signatures.encounter_id)
  );

-- The message log and the WhatsApp threads: the clinic's three working roles
-- (decision of 18.9: the secretary handles reminders and messages).
drop policy if exists message_log_staff_select on public.message_log;
create policy message_log_staff_select on public.message_log
  for select using (
    clinic_id = (select public.current_clinic_id())
    and (select public.has_clinic_role(public.current_clinic_id(), array['owner', 'practitioner', 'staff']))
  );

drop policy if exists whatsapp_conversations_member_select on public.whatsapp_conversations;
create policy whatsapp_conversations_member_select on public.whatsapp_conversations
  for select using (
    clinic_id = (select public.current_clinic_id())
    and (select public.has_clinic_role(public.current_clinic_id(), array['owner', 'practitioner', 'staff']))
  );
drop policy if exists whatsapp_conversations_member_insert on public.whatsapp_conversations;
create policy whatsapp_conversations_member_insert on public.whatsapp_conversations
  for insert with check (
    clinic_id = (select public.current_clinic_id())
    and (select public.has_clinic_role(public.current_clinic_id(), array['owner', 'practitioner', 'staff']))
  );
drop policy if exists whatsapp_conversations_member_update on public.whatsapp_conversations;
create policy whatsapp_conversations_member_update on public.whatsapp_conversations
  for update
  using (
    clinic_id = (select public.current_clinic_id())
    and (select public.has_clinic_role(public.current_clinic_id(), array['owner', 'practitioner', 'staff']))
  )
  with check (
    clinic_id = (select public.current_clinic_id())
    and (select public.has_clinic_role(public.current_clinic_id(), array['owner', 'practitioner', 'staff']))
  );

drop policy if exists whatsapp_messages_member_select on public.whatsapp_messages;
create policy whatsapp_messages_member_select on public.whatsapp_messages
  for select using (
    clinic_id = (select public.current_clinic_id())
    and (select public.has_clinic_role(public.current_clinic_id(), array['owner', 'practitioner', 'staff']))
  );
drop policy if exists whatsapp_messages_member_insert on public.whatsapp_messages;
create policy whatsapp_messages_member_insert on public.whatsapp_messages
  for insert with check (
    clinic_id = (select public.current_clinic_id())
    and (select public.has_clinic_role(public.current_clinic_id(), array['owner', 'practitioner', 'staff']))
    and direction = 'out'
  );
drop policy if exists whatsapp_messages_member_update on public.whatsapp_messages;
create policy whatsapp_messages_member_update on public.whatsapp_messages
  for update
  using (
    clinic_id = (select public.current_clinic_id())
    and (select public.has_clinic_role(public.current_clinic_id(), array['owner', 'practitioner', 'staff']))
  )
  with check (
    clinic_id = (select public.current_clinic_id())
    and (select public.has_clinic_role(public.current_clinic_id(), array['owner', 'practitioner', 'staff']))
    and direction = 'out'
  );

-- The catalogue: doses and cautions are clinical content. Everyone in the
-- clinic reads it; the owner and the practitioners write it.
do $$
declare
  t text;
begin
  foreach t in array array['herbs', 'herb_formulas', 'herb_formula_items', 'acupuncture_points'] loop
    execute format('drop policy if exists %I on public.%I', t || '_staff_all', t);
    execute format('drop policy if exists %I on public.%I', t || '_member_read', t);
    execute format('drop policy if exists %I on public.%I', t || '_clinical_write', t);
    execute format(
      'create policy %I on public.%I for select using (clinic_id = (select public.current_clinic_id()))',
      t || '_member_read', t);
    execute format(
      'create policy %I on public.%I for all '
      'using (clinic_id = (select public.current_clinic_id()) '
      '  and (select public.has_clinic_role(public.current_clinic_id(), array[''owner'', ''practitioner'']))) '
      'with check (clinic_id = (select public.current_clinic_id()) '
      '  and (select public.has_clinic_role(public.current_clinic_id(), array[''owner'', ''practitioner''])))',
      t || '_clinical_write', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6 · Portal access is the owner's to grant
-- ---------------------------------------------------------------------------
-- Any member could insert (their clinic, any patient id, their own user id) and
-- read that patient's file through the portal policies — another clinic's
-- patient included. Now: the owner, a patient of the clinic in force, and never
-- a user id. `user_id` is written only by `claim_portal_access`, when the
-- invited address signs in.

drop policy if exists patient_portal_access_staff on public.patient_portal_access;
drop policy if exists patient_portal_access_staff_read on public.patient_portal_access;
drop policy if exists patient_portal_access_owner_writes on public.patient_portal_access;

create policy patient_portal_access_staff_read on public.patient_portal_access
  for select using (clinic_id = (select public.current_clinic_id()) and public.sees_patient(patient_id));

create policy patient_portal_access_owner_writes on public.patient_portal_access
  for all
  using (
    clinic_id = (select public.current_clinic_id())
    and public.has_clinic_role(clinic_id, array['owner'])
  )
  with check (
    clinic_id = (select public.current_clinic_id())
    and public.has_clinic_role(clinic_id, array['owner'])
    and exists (
      select 1 from public.patients p
       where p.id = patient_portal_access.patient_id
         and p.clinic_id = patient_portal_access.clinic_id
    )
  );

-- A signed-in client may never set or move `user_id`; the definer functions
-- (claim, account deletion) run as the table's owner and are not stopped.
create or replace function public.portal_access_guard_user()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' and new.user_id is not null then
      raise exception 'portal_user_is_claimed_not_granted' using errcode = '42501';
    end if;
    if tg_op = 'UPDATE' and new.user_id is distinct from old.user_id then
      raise exception 'portal_user_is_claimed_not_granted' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.portal_access_guard_user() from public, anon, authenticated;

drop trigger if exists patient_portal_access_guard_user on public.patient_portal_access;
create trigger patient_portal_access_guard_user
  before insert or update on public.patient_portal_access
  for each row execute function public.portal_access_guard_user();

-- ---------------------------------------------------------------------------
-- 7 · Memberships: only through the functions
-- ---------------------------------------------------------------------------
-- The owner-wide `for all` policy let an owner insert a membership for any
-- user id, as owner, backdated — which hijacked the victim's default clinic,
-- bypassed the one-clinic rule of `accept_invitation` and every check in
-- `set_membership_*`. Nothing in the app writes the table directly.

drop policy if exists memberships_manage on public.memberships;

-- Two owners demoting each other at the same moment each saw the other still
-- an owner, and the clinic was left with none. Locking the clinic row first
-- serialises owner changes per clinic; the check that follows runs after the
-- other transaction has committed.
create or replace function public.memberships_keep_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if pg_catalog.current_setting('herbalist.deleting_account', true) = 'on' then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  if old.role = 'owner' and old.is_active
     and (tg_op = 'DELETE' or new.role <> 'owner' or not new.is_active) then
    perform 1 from public.clinics c where c.id = old.clinic_id for update;
    if not exists (
      select 1 from public.memberships m
       where m.clinic_id = old.clinic_id and m.role = 'owner' and m.is_active and m.id <> old.id
    ) then
      raise exception 'last_owner' using errcode = '23514';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function public.memberships_keep_owner() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 8 · A portal row takes its clinic from its patient
-- ---------------------------------------------------------------------------
-- `clinic_id` defaults to `current_clinic_id()`, which is null for a patient.
-- The portal's questionnaire, consent and signature inserts failed on the
-- not-null constraint. A row whose clinic disagrees with its patient's is
-- refused outright, from anyone.

create or replace function public.fill_clinic_from_patient()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_clinic uuid;
begin
  select p.clinic_id into v_clinic from public.patients p where p.id = new.patient_id;
  if v_clinic is null then
    return new; -- the foreign key reports the missing patient
  end if;
  if new.clinic_id is null then
    new.clinic_id := v_clinic;
  elsif new.clinic_id <> v_clinic then
    raise exception 'clinic_mismatch' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function public.fill_clinic_from_patient() from public, anon, authenticated;

drop trigger if exists a_fill_clinic_from_patient on public.form_submissions;
create trigger a_fill_clinic_from_patient
  before insert on public.form_submissions
  for each row execute function public.fill_clinic_from_patient();

drop trigger if exists a_fill_clinic_from_patient on public.patient_consents;
create trigger a_fill_clinic_from_patient
  before insert on public.patient_consents
  for each row execute function public.fill_clinic_from_patient();

drop trigger if exists a_fill_clinic_from_patient on public.signatures;
create trigger a_fill_clinic_from_patient
  before insert on public.signatures
  for each row execute function public.fill_clinic_from_patient();

-- ---------------------------------------------------------------------------
-- 9 and 10 · The booking page
-- ---------------------------------------------------------------------------

-- A booking made on the public page does not by itself make an existing
-- patient a practitioner's: a practitioner who knew a phone number and a first
-- name could book someone under their own name and keep their record. The page
-- marks its own transaction, the diary trigger skips it, and `booking_request`
-- links only a file it opened itself.
create or replace function public.link_patient_practitioner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if pg_catalog.current_setting('herbalist.online_booking', true) = 'on' then
    return new;
  end if;
  if new.practitioner_id is not null then
    insert into public.patient_practitioners (clinic_id, patient_id, user_id, source)
    values (new.clinic_id, new.patient_id, new.practitioner_id, tg_argv[0])
    on conflict (patient_id, user_id) do nothing;
  end if;
  return new;
end;
$$;

revoke all on function public.link_patient_practitioner() from public, anon, authenticated;

create or replace function public.booking_slots(
  p_slug text,
  p_type_id uuid,
  p_practitioner_id uuid,
  p_day date
)
returns setof timestamptz
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  c public.clinics%rowtype;
  v_minutes integer;
  v_dur interval;
  v_earliest timestamptz;
  v_exception public.schedule_exceptions%rowtype;
  v_open record;
  v_ts timestamptz;
  v_end timestamptz;
begin
  select * into c from public.clinics
   where booking_slug = pg_catalog.lower(pg_catalog.btrim(p_slug)) and booking_enabled;
  if not found then return; end if;

  select default_duration_minutes into v_minutes
    from public.appointment_types
   where id = p_type_id and clinic_id = c.id and is_active and online_bookable;
  if not found then return; end if;
  v_dur := pg_catalog.make_interval(mins => v_minutes);
  v_earliest := pg_catalog.now() + pg_catalog.make_interval(hours => c.booking_lead_hours);

  if p_day < (pg_catalog.now() at time zone c.timezone)::date
     or p_day > (pg_catalog.now() at time zone c.timezone)::date + c.booking_horizon_days then
    return;
  end if;

  -- Only someone the page itself lists: an active owner or practitioner of this
  -- clinic. The secretary's id is not a way in.
  if not exists (
    select 1 from public.memberships m
     where m.clinic_id = c.id and m.user_id = p_practitioner_id and m.is_active
       and m.role in ('owner', 'practitioner')
  ) then return; end if;

  -- The practitioner's hours in *this* clinic; a person working in two
  -- clinics keeps two timetables.
  select * into v_exception from public.schedule_exceptions e
   where e.practitioner_id = p_practitioner_id and e.clinic_id = c.id and e.date = p_day;

  for v_open in
    select start_time, end_time
      from (
        select e.start_time, e.end_time
          from public.schedule_exceptions e
         where e.practitioner_id = p_practitioner_id and e.clinic_id = c.id and e.date = p_day
           and not e.is_closed and e.start_time is not null and e.end_time is not null
        union all
        select s.start_time, s.end_time
          from public.practitioner_schedules s
         where s.practitioner_id = p_practitioner_id and s.clinic_id = c.id and s.is_active
           and s.weekday = extract(dow from p_day)::int
           and v_exception.id is null
      ) open
     order by start_time
  loop
    v_ts := (p_day + v_open.start_time) at time zone c.timezone;
    v_end := (p_day + v_open.end_time) at time zone c.timezone;
    while v_ts + v_dur <= v_end loop
      -- Blocks and appointments anywhere: one person cannot be in two places.
      if v_ts >= v_earliest
         and not exists (
           select 1 from public.schedule_blocks b
            where b.practitioner_id = p_practitioner_id
              and b.start_at < v_ts + v_dur and b.end_at > v_ts
         )
         and not exists (
           select 1 from public.appointments a
            where a.practitioner_id = p_practitioner_id
              and a.status <> 'cancelled'
              and a.start_at < v_ts + v_dur and a.end_at > v_ts
         )
      then
        return next v_ts;
      end if;
      v_ts := v_ts + interval '15 minutes';
    end loop;
  end loop;
  return;
end;
$$;

revoke all on function public.booking_slots(text, uuid, uuid, date) from public, anon, authenticated;
grant execute on function public.booking_slots(text, uuid, uuid, date) to anon, authenticated;

-- The code. Every outcome is a typed result, not an exception: an exception
-- would roll back the counters that make the limits work, and a caller cannot
-- tell a limit from a fault. Limits, layered:
--   · one number: a minute between codes, three an hour
--   · one clinic: forty an hour
--   · the whole service: three hundred an hour — the SMS bill is shared
-- A per-caller (IP) limit lives in the page's server action: this function is
-- open to anonymous callers, so an address passed in would be the caller's
-- word and nothing more.
drop function if exists public.booking_send_code(text, text);

create or replace function public.booking_send_code(p_slug text, p_phone text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.clinics%rowtype;
  v_phone text := public.phone_digits(p_phone);
  v_code text;
  v_last timestamptz;
begin
  select * into c from public.clinics
   where booking_slug = pg_catalog.lower(pg_catalog.btrim(p_slug)) and booking_enabled;
  if not found then
    return pg_catalog.jsonb_build_object('ok', false, 'reason', 'not_available');
  end if;
  if not c.booking_verify_sms then
    return pg_catalog.jsonb_build_object('ok', false, 'reason', 'not_required');
  end if;
  if pg_catalog.length(v_phone) < 8 then
    return pg_catalog.jsonb_build_object('ok', false, 'reason', 'bad_phone');
  end if;

  select max(k.created_at) into v_last
    from public.booking_codes k where k.clinic_id = c.id and k.phone = v_phone;
  if v_last is not null and v_last > pg_catalog.now() - interval '60 seconds' then
    return pg_catalog.jsonb_build_object('ok', false, 'reason', 'cooldown');
  end if;

  if (select count(*) from public.booking_codes k
       where k.clinic_id = c.id and k.phone = v_phone
         and k.created_at > pg_catalog.now() - interval '1 hour') >= 3 then
    return pg_catalog.jsonb_build_object('ok', false, 'reason', 'too_many');
  end if;

  if (select count(*) from public.booking_codes k
       where k.clinic_id = c.id and k.created_at > pg_catalog.now() - interval '1 hour') >= 40
     or (select count(*) from public.booking_codes k
          where k.created_at > pg_catalog.now() - interval '1 hour') >= 300 then
    return pg_catalog.jsonb_build_object('ok', false, 'reason', 'busy');
  end if;

  -- Six digits from the operating system's random source, not `random()`.
  v_code := pg_catalog.lpad(
    ((('x' || pg_catalog.encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::bigint & 2147483647) % 1000000)::text,
    6, '0');

  insert into public.booking_codes (clinic_id, phone, code_hash, expires_at)
  values (c.id, v_phone, extensions.crypt(v_code, extensions.gen_salt('bf')), pg_catalog.now() + interval '10 minutes');

  insert into public.message_log (clinic_id, channel, template_key, recipient, body, status)
  values (c.id, 'sms', 'booking_code', p_phone,
          case when c.default_locale = 'en'
            then c.name || ': your verification code is ' || v_code
            else c.name || ': קוד האימות שלך הוא ' || v_code
          end,
          'queued');
  return pg_catalog.jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.booking_send_code(text, text) from public, anon, authenticated;
grant execute on function public.booking_send_code(text, text) to anon, authenticated;

-- The booking. Typed results throughout, and a wrong code is counted: the old
-- version raised straight after counting, and the raise rolled the count back,
-- so the five-attempt limit never came.
create or replace function public.booking_request(
  p_slug text,
  p_type_id uuid,
  p_practitioner_id uuid,
  p_location_id uuid,
  p_start_at timestamptz,
  p_first_name text,
  p_last_name text,
  p_phone text,
  p_email text,
  p_note text,
  p_code text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.clinics%rowtype;
  v_type public.appointment_types%rowtype;
  v_phone text := public.phone_digits(p_phone);
  v_patient uuid;
  v_certain boolean;
  v_other uuid;
  v_new_file boolean := false;
  v_appointment public.appointments%rowtype;
  v_code public.booking_codes%rowtype;
  v_name text;
  v_practitioner text;
begin
  select * into c from public.clinics
   where booking_slug = pg_catalog.lower(pg_catalog.btrim(p_slug)) and booking_enabled;
  if not found then
    return pg_catalog.jsonb_build_object('ok', false, 'reason', 'not_available');
  end if;

  select * into v_type from public.appointment_types t
   where t.id = p_type_id and t.clinic_id = c.id and t.is_active and t.online_bookable;
  if not found then
    return pg_catalog.jsonb_build_object('ok', false, 'reason', 'bad_type');
  end if;

  if pg_catalog.length(pg_catalog.btrim(coalesce(p_first_name, ''))) = 0 or pg_catalog.length(v_phone) < 8 then
    return pg_catalog.jsonb_build_object('ok', false, 'reason', 'missing');
  end if;

  if p_location_id is not null and not exists (
    select 1 from public.locations l where l.id = p_location_id and l.clinic_id = c.id and l.is_active
  ) then
    return pg_catalog.jsonb_build_object('ok', false, 'reason', 'bad_location');
  end if;

  -- A page left open is not a flood: thirty online bookings an hour per clinic.
  if (select count(*) from public.appointments a
       where a.clinic_id = c.id and a.booked_online
         and a.created_at > pg_catalog.now() - interval '1 hour') >= 30 then
    return pg_catalog.jsonb_build_object('ok', false, 'reason', 'busy');
  end if;

  -- The hour must be one the page would have offered (which also checks the
  -- practitioner is one the page lists).
  if not exists (
    select 1 from public.booking_slots(p_slug, p_type_id, p_practitioner_id,
                                       (p_start_at at time zone c.timezone)::date) s
     where s = p_start_at
  ) then
    return pg_catalog.jsonb_build_object('ok', false, 'reason', 'slot_taken');
  end if;

  if c.booking_verify_sms then
    select * into v_code from public.booking_codes k
     where k.clinic_id = c.id and k.phone = v_phone and k.used_at is null
       and k.expires_at > pg_catalog.now()
     order by k.created_at desc limit 1
     for update;
    if not found or v_code.attempts >= 5 then
      return pg_catalog.jsonb_build_object('ok', false, 'reason', 'code_expired');
    end if;
    if v_code.code_hash <> extensions.crypt(coalesce(p_code, ''), v_code.code_hash) then
      update public.booking_codes set attempts = attempts + 1 where id = v_code.id;
      return pg_catalog.jsonb_build_object('ok', false, 'reason', 'bad_code',
        'attempts_left', greatest(0, 4 - v_code.attempts));
    end if;
    update public.booking_codes set used_at = pg_catalog.now() where id = v_code.id;
  end if;

  select m.patient_id, m.certain into v_patient, v_certain
    from public.booking_match_patient(c.id, p_phone, p_first_name) m;

  if v_patient is not null and not v_certain then
    v_other := v_patient;
    v_patient := null;
  end if;

  -- The diary trigger links the practitioner on insert; this transaction is
  -- the page's, and links only the file it opens itself (below).
  perform pg_catalog.set_config('herbalist.online_booking', 'on', true);

  begin
    if v_patient is null then
      insert into public.patients (clinic_id, first_name, last_name, phone, email, preferred_locale, created_via)
      values (c.id, pg_catalog.btrim(p_first_name), pg_catalog.btrim(coalesce(p_last_name, '')), pg_catalog.btrim(p_phone),
              nullif(pg_catalog.btrim(coalesce(p_email, '')), ''), c.default_locale, 'online')
      returning id into v_patient;
      v_new_file := true;
    end if;

    insert into public.appointments
      (clinic_id, patient_id, practitioner_id, appointment_type_id, location_id, start_at, end_at,
       status, notes, booked_online)
    values
      (c.id, v_patient, p_practitioner_id, v_type.id, p_location_id, p_start_at,
       p_start_at + pg_catalog.make_interval(mins => v_type.default_duration_minutes),
       'scheduled', nullif(pg_catalog.btrim(coalesce(p_note, '')), ''), true)
    returning * into v_appointment;
  exception
    when exclusion_violation then
      perform pg_catalog.set_config('herbalist.online_booking', '', true);
      return pg_catalog.jsonb_build_object('ok', false, 'reason', 'slot_taken');
  end;

  perform pg_catalog.set_config('herbalist.online_booking', '', true);

  if v_new_file then
    -- A file this booking opened holds nothing yet; it is the practitioner's.
    insert into public.patient_practitioners (clinic_id, patient_id, user_id, source)
    values (c.id, v_patient, p_practitioner_id, 'appointment')
    on conflict (patient_id, user_id) do nothing;
  elsif not exists (
    select 1 from public.patient_practitioners pp
     where pp.patient_id = v_patient and pp.user_id = p_practitioner_id
  ) then
    -- An existing patient booked with someone who does not yet treat them: a
    -- person at the desk confirms it. Saving the appointment in the diary makes
    -- the link, as any booking from the desk does.
    select coalesce(p.full_name, p.first_name) into v_name from public.patients p where p.id = v_patient;
    select coalesce(pr.full_name, '') into v_practitioner from public.profiles pr where pr.id = p_practitioner_id;
    insert into public.clinic_tasks (clinic_id, title, notes, due_on, patient_id)
    values (
      c.id,
      case when c.default_locale = 'en'
           then 'Online booking: confirm the practitioner'
           else 'זימון אונליין: לאשר את המטפל' end,
      case when c.default_locale = 'en'
           then v_name || ' booked online with ' || v_practitioner || ', who does not treat them yet. If the booking is genuine, open the appointment in the diary and save it; until then the practitioner does not see the file.'
           else v_name || ' קבע/ה תור אונליין אצל ' || v_practitioner || ', שעדיין לא מטפל/ת בו/ה. אם הזימון אמיתי, פותחים את התור ביומן ושומרים; עד אז המטפל/ת לא רואה את התיק.' end,
      (pg_catalog.now() at time zone c.timezone)::date,
      v_patient
    );
  end if;

  -- Same number, another first name: a new file, and a task so a person
  -- decides whether it is one.
  if v_other is not null then
    insert into public.clinic_tasks (clinic_id, title, notes, due_on, patient_id)
    select c.id,
           case when c.default_locale = 'en'
                then 'Online booking: possibly an existing patient'
                else 'זימון אונליין: ייתכן שזה מטופל קיים' end,
           case when c.default_locale = 'en'
                then 'The phone number matches the file of ' || coalesce(o.full_name, o.first_name) || '. If it is the same person, move the appointment to that file and deactivate the new one.'
                else 'מספר הטלפון זהה לתיק של ' || coalesce(o.full_name, o.first_name) || '. אם זה אותו אדם, מעבירים את התור לתיק הקיים ומבטלים את התיק החדש.' end,
           (pg_catalog.now() at time zone c.timezone)::date,
           v_patient
      from public.patients o
     where o.id = v_other;
  end if;

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'token', v_appointment.confirmation_token,
    'start_at', v_appointment.start_at
  );
end;
$$;

revoke all on function public.booking_request(text, uuid, uuid, uuid, timestamptz, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.booking_request(text, uuid, uuid, uuid, timestamptz, text, text, text, text, text, text) to anon, authenticated;

comment on function public.booking_request is
  'The public booking page''s one write. Returns {ok, reason} — never raises for an expected outcome, so a wrong code is counted. Joins a file on phone and first name, opens one otherwise; links the practitioner only to a file it opened, and asks the desk to confirm otherwise.';

-- ---------------------------------------------------------------------------
-- 11 · Payments: the amount, the currency, and no going back
-- ---------------------------------------------------------------------------

-- What the invoice says it is, from what was actually paid. Shared by both
-- triggers, so a line added to a paid invoice, or a payment reversed, moves the
-- status as well as the numbers.
create or replace function public.invoice_status_for(
  p_status text,
  p_issued timestamptz,
  p_total numeric,
  p_paid numeric
)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_status = 'cancelled' then 'cancelled'
    when p_paid > 0 and p_paid >= p_total then 'paid'
    when p_paid > 0 then 'partially_paid'
    when p_status in ('paid', 'partially_paid') then
      case when p_issued is not null then 'sent' else 'draft' end
    else p_status
  end;
$$;

create or replace function public.recalculate_invoice_totals()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_invoice uuid;
  v_subtotal numeric(12, 2);
begin
  v_invoice := coalesce(new.invoice_id, old.invoice_id);

  select coalesce(sum(line_total), 0) into v_subtotal
    from public.invoice_items
   where invoice_id = v_invoice;

  update public.invoices
     set subtotal = v_subtotal,
         total = v_subtotal,
         status = public.invoice_status_for(status, issued_at, v_subtotal, amount_paid)
   where id = v_invoice;

  return coalesce(new, old);
end;
$$;

create or replace function public.apply_payment_to_invoice()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_invoice uuid;
  v_paid numeric(12, 2);
begin
  v_invoice := coalesce(new.invoice_id, old.invoice_id);

  select coalesce(sum(p.amount), 0) into v_paid
    from public.payments p
   where p.invoice_id = v_invoice
     and p.status = 'paid';

  update public.invoices
     set amount_paid = v_paid,
         status = public.invoice_status_for(status, issued_at, total, v_paid)
   where id = v_invoice;

  return coalesce(new, old);
end;
$$;

drop trigger if exists payments_apply_to_invoice on public.payments;
create trigger payments_apply_to_invoice
  after insert or update of status, amount or delete on public.payments
  for each row execute function public.apply_payment_to_invoice();

-- The settlement. The signature gains the amount and the currency, checked
-- against the payment we created; the webhook passes what Grow's own server
-- confirmed (supabase/functions/grow-webhook). A paid payment stays paid: a
-- late "failed", a replayed callback, or an older one arriving after a newer
-- one changes nothing and says so.
drop function if exists public.settle_grow_payment(text, text, text, text, jsonb);

create or replace function public.settle_grow_payment(
  p_process_id text,
  p_process_token text,
  p_transaction_id text default null,
  p_status text default 'paid',
  p_raw jsonb default null,
  p_amount numeric default null,
  p_currency text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payments%rowtype;
  v_currency text;
begin
  if p_process_id is null or pg_catalog.length(pg_catalog.btrim(p_process_id)) = 0 then
    return pg_catalog.jsonb_build_object('ok', false, 'reason', 'process_id_required');
  end if;
  if p_status not in ('paid', 'failed') then
    return pg_catalog.jsonb_build_object('ok', false, 'reason', 'bad_status');
  end if;

  select * into v_payment
    from public.payments
   where provider_process_id = p_process_id
   for update;

  if v_payment.id is null then
    return pg_catalog.jsonb_build_object('ok', false, 'reason', 'payment_not_found');
  end if;

  -- The token Grow issued when the payment was created, which we stored and
  -- never published. It is a shared secret, not a signature — Grow offers
  -- none — which is why the webhook also asks Grow's server before calling.
  if v_payment.provider_process_token is null
     or p_process_token is null
     or p_process_token <> v_payment.provider_process_token then
    return pg_catalog.jsonb_build_object('ok', false, 'reason', 'payment_token_mismatch');
  end if;

  if v_payment.status = 'paid' then
    -- Replay, or anything arriving after the payment settled.
    return pg_catalog.jsonb_build_object('ok', true, 'payment_id', v_payment.id, 'changed', false,
      'reason', case when p_status = 'paid' then 'already_paid' else 'ignored_after_paid' end);
  end if;

  if p_status = 'paid' then
    select i.currency into v_currency from public.invoices i where i.id = v_payment.invoice_id;
    if p_amount is null or p_amount <> v_payment.amount then
      return pg_catalog.jsonb_build_object('ok', false, 'reason', 'amount_mismatch');
    end if;
    if coalesce(p_currency, 'ILS') <> 'ILS' or coalesce(v_currency, 'ILS') <> 'ILS' then
      return pg_catalog.jsonb_build_object('ok', false, 'reason', 'currency_mismatch');
    end if;
    if p_transaction_id is not null and exists (
      select 1 from public.payments o
       where o.provider = 'grow' and o.provider_transaction_id = p_transaction_id and o.id <> v_payment.id
    ) then
      return pg_catalog.jsonb_build_object('ok', false, 'reason', 'transaction_already_used');
    end if;

    update public.payments
       set status = 'paid',
           provider_transaction_id = coalesce(p_transaction_id, provider_transaction_id),
           paid_at = pg_catalog.now(),
           raw_response = coalesce(p_raw, raw_response)
     where id = v_payment.id;
    return pg_catalog.jsonb_build_object('ok', true, 'payment_id', v_payment.id, 'changed', true);
  end if;

  -- A failure on a payment that has not been paid.
  if v_payment.status <> 'failed' then
    update public.payments
       set status = 'failed',
           raw_response = coalesce(p_raw, raw_response)
     where id = v_payment.id;
  end if;
  return pg_catalog.jsonb_build_object('ok', true, 'payment_id', v_payment.id, 'changed', v_payment.status <> 'failed');
end;
$$;

comment on function public.settle_grow_payment(text, text, text, text, jsonb, numeric, text) is
  'Settles a Grow payment from the webhook. Requires the stored process token, the amount we asked for and ILS; returns {ok, reason}. Idempotent, and a paid payment never regresses. Service role only.';

revoke all on function public.settle_grow_payment(text, text, text, text, jsonb, numeric, text) from public, anon, authenticated;
grant execute on function public.settle_grow_payment(text, text, text, text, jsonb, numeric, text) to service_role;

-- ---------------------------------------------------------------------------
-- 12 · Moving an appointment re-arms its reminder
-- ---------------------------------------------------------------------------
-- The reminder queue skips an appointment that has `reminder_sent_at` or a
-- reminder row already, so a moved appointment never heard about its new time.
-- On a move: the mark is cleared, the move time is recorded (the queue ignores
-- reminders from before it), and a reminder still waiting in the queue is
-- withdrawn — only one no worker has picked up; a row being sent is left alone.

alter table public.appointments
  add column if not exists rescheduled_at timestamptz;

comment on column public.appointments.rescheduled_at is
  'When the appointment last moved. Reminders queued or sent before it are for the old time.';

create or replace function public.appointment_rescheduled()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.start_at is distinct from old.start_at then
    new.reminder_sent_at := null;
    new.rescheduled_at := pg_catalog.now();
    update public.message_log
       set status = 'skipped', error_code = 'rescheduled'
     where appointment_id = new.id
       and template_key = 'appointment_reminder'
       and status = 'queued';
  end if;
  return new;
end;
$$;

revoke all on function public.appointment_rescheduled() from public, anon, authenticated;

drop trigger if exists appointments_rescheduled on public.appointments;
create trigger appointments_rescheduled
  before update of start_at on public.appointments
  for each row execute function public.appointment_rescheduled();

-- ---------------------------------------------------------------------------
-- 13 · The message queue: claimed atomically, sent at most once
-- ---------------------------------------------------------------------------

alter table public.message_log drop constraint if exists message_log_status_check;
alter table public.message_log
  add constraint message_log_status_check
  check (status in ('queued', 'sending', 'sent', 'failed', 'skipped', 'stalled'));

alter table public.message_log
  add column if not exists claimed_at timestamptz,
  add column if not exists claimed_by text;

comment on column public.message_log.claimed_at is
  'When a sender took this row (queued → sending). A row still sending long after is marked stalled for a person to check — never resent by itself, since it may have gone out.';

create index if not exists message_log_sending_idx
  on public.message_log (claimed_at) where status = 'sending';

-- Is this user someone of this clinic: an active member, or a portal patient of
-- one of its files? A push row names a user id, and nothing else checked it.
create or replace function public.push_recipient_in_clinic(p_clinic uuid, p_recipient text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_recipient is null
      or p_recipient !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then false
    else exists (
      select 1 from public.memberships m
       where m.clinic_id = p_clinic and m.user_id = p_recipient::uuid and m.is_active
    ) or exists (
      select 1 from public.patient_portal_access a
        join public.patients p on p.id = a.patient_id
       where a.user_id = p_recipient::uuid and a.is_active and p.clinic_id = p_clinic
    )
  end;
$$;

revoke all on function public.push_recipient_in_clinic(uuid, text) from public, anon, authenticated;
grant execute on function public.push_recipient_in_clinic(uuid, text) to service_role;

create or replace function public.claim_queued_messages(
  p_channels text[],
  p_worker text,
  p_limit integer default 100
)
returns setof public.message_log
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- A claim that never finished: the sender died between taking the row and
  -- recording the result. It may or may not have gone out, so a person decides.
  update public.message_log
     set status = 'stalled', error_code = 'claim_abandoned'
   where status = 'sending'
     and claimed_at < pg_catalog.now() - interval '15 minutes';

  -- A push to someone outside the clinic that queued it is dropped, not sent.
  update public.message_log m
     set status = 'skipped', error_code = 'bad_recipient'
   where m.status = 'queued'
     and m.channel = 'push'
     and m.channel = any(p_channels)
     and not public.push_recipient_in_clinic(m.clinic_id, m.recipient);

  -- One statement: the rows are locked, moved to `sending` and returned. A
  -- second sender running at the same moment skips the locked rows and cannot
  -- return any of them.
  return query
  update public.message_log m
     set status = 'sending', claimed_at = pg_catalog.now(), claimed_by = p_worker
   where m.id in (
     select q.id
       from public.message_log q
      where q.status = 'queued'
        and q.channel = any(p_channels)
      order by q.created_at
      limit greatest(1, least(coalesce(p_limit, 100), 500))
      for update skip locked
   )
  returning m.*;
end;
$$;

revoke all on function public.claim_queued_messages(text[], text, integer) from public, anon, authenticated;
grant execute on function public.claim_queued_messages(text[], text, integer) to service_role;

-- Marking a message sent. Only a row that is waiting, being sent, failed or
-- stalled; only by the service, or by a person of the clinic in force.
create or replace function public.mark_message_sent(p_id uuid, p_provider text default 'manual')
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.message_log%rowtype;
begin
  select * into v_row from public.message_log m
   where m.id = p_id
     and m.status in ('queued', 'sending', 'failed', 'stalled')
     and (
       auth.role() = 'service_role'
       or (m.clinic_id = public.current_clinic_id()
           and public.has_clinic_role(m.clinic_id, array['owner', 'practitioner', 'staff']))
     )
   for update;
  if not found then return false; end if;

  update public.message_log
     set status = 'sent', provider = p_provider, sent_at = pg_catalog.now(), error_code = null
   where id = p_id;

  if v_row.appointment_id is not null and v_row.template_key = 'appointment_reminder' then
    update public.appointments
       set reminder_sent_at = coalesce(reminder_sent_at, pg_catalog.now())
     where id = v_row.appointment_id;
  end if;
  return true;
end;
$$;

revoke all on function public.mark_message_sent(uuid, text) from public, anon, authenticated;
grant execute on function public.mark_message_sent(uuid, text) to authenticated, service_role;

-- The reminder queue, with the dedupe that knows about claims, stalls and moves.
-- Body as in migration 68 otherwise.
create or replace function public.enqueue_due_reminders(p_base_url text, p_clinic uuid default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer := 0;
  r record;
  v_recipient text;
  v_locale text;
  v_body text;
  v_link text;
  v_date text;
  v_time text;
  v_push_user uuid;
begin
  for r in
    select
      a.id as appointment_id,
      a.clinic_id,
      a.patient_id,
      a.start_at,
      a.confirmation_token,
      c.name as clinic_name,
      c.timezone,
      c.reminder_template,
      c.reminder_channel,
      c.reminder_push_enabled,
      p.first_name,
      p.phone,
      p.email,
      p.preferred_locale
    from public.appointments a
    join public.clinics c on c.id = a.clinic_id
    join public.patients p on p.id = a.patient_id
    where c.reminders_enabled
      and (p_clinic is null or a.clinic_id = p_clinic)
      and a.status in ('scheduled', 'confirmed')
      and a.reminder_sent_at is null
      and a.start_at > pg_catalog.now()
      and a.start_at <= pg_catalog.now() + pg_catalog.make_interval(hours => c.reminder_hours_before)
      and not exists (
        select 1 from public.message_log m
         where m.appointment_id = a.id
           and m.template_key = 'appointment_reminder'
           and m.status in ('queued', 'sending', 'sent', 'stalled')
           and m.created_at > coalesce(a.rescheduled_at, '-infinity'::timestamptz)
      )
  loop
    v_locale := coalesce(r.preferred_locale, 'he');
    v_link := pg_catalog.rtrim(p_base_url, '/') || '/' || v_locale || '/confirm/' || r.confirmation_token::text;
    v_date := pg_catalog.to_char(r.start_at at time zone r.timezone, 'DD/MM/YYYY');
    v_time := pg_catalog.to_char(r.start_at at time zone r.timezone, 'HH24:MI');

    v_push_user := null;
    if r.reminder_push_enabled then
      select ppa.user_id into v_push_user
        from public.patient_portal_access ppa
       where ppa.patient_id = r.patient_id
         and ppa.is_active
         and ppa.user_id is not null
         and exists (select 1 from public.device_push_tokens d
                      where d.user_id = ppa.user_id and d.app = 'portal')
       limit 1;
    end if;

    if v_push_user is not null then
      insert into public.message_log
        (clinic_id, channel, template_key, recipient, body, subject, link_url, patient_id, appointment_id, status)
      values
        (r.clinic_id, 'push', 'appointment_reminder', v_push_user::text,
         public.render_push_reminder(v_locale, v_date, v_time, r.clinic_name),
         r.clinic_name, v_link, r.patient_id, r.appointment_id, 'queued');
      v_count := v_count + 1;
      continue;
    end if;

    v_recipient := case when r.reminder_channel = 'email' then r.email else r.phone end;
    v_body := public.render_reminder(
      r.reminder_template, v_locale, r.first_name, v_date, v_time, r.clinic_name, v_link
    );

    insert into public.message_log
      (clinic_id, channel, template_key, recipient, body, subject, patient_id, appointment_id, params, status, error_code)
    values
      (r.clinic_id, r.reminder_channel, 'appointment_reminder', v_recipient, v_body,
       case when r.reminder_channel = 'email' then r.clinic_name else null end,
       r.patient_id, r.appointment_id,
       pg_catalog.jsonb_build_array(coalesce(r.first_name, ''), r.clinic_name, v_date, v_time, v_link),
       case when v_recipient is null then 'skipped' else 'queued' end,
       case when v_recipient is null then 'no_recipient' else null end);
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.enqueue_due_reminders(text, uuid) from public, anon, authenticated;

-- The automations: the same dedupe change (a row being sent, or stalled for a
-- person, counts as sent). Body as in migration 68 otherwise.
create or replace function public.enqueue_due_automations_at(p_base_url text, p_now timestamptz, p_clinic uuid default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer := 0;
  v_now timestamptz := p_now;
  v_base text := pg_catalog.rtrim(p_base_url, '/');
  r record;
  v_locale text;
  v_recipient text;
  v_subject text;
  v_body text;
  v_token uuid;
  v_unsubscribe text;
  v_booking text;
begin
  for r in
    select a.id as appointment_id, a.clinic_id, a.patient_id,
           c.name as clinic_name, c.reminder_channel,
           p.first_name, p.phone, p.email, p.preferred_locale,
           ca.template
      from public.clinic_automations ca
      join public.clinics c on c.id = ca.clinic_id
      join public.appointments a on a.clinic_id = c.id
      join public.patients p on p.id = a.patient_id
     where ca.kind = 'treatment_followup' and ca.enabled
       and (p_clinic is null or ca.clinic_id = p_clinic)
       and a.status not in ('cancelled', 'no_show')
       and (a.status in ('checked_in', 'completed')
            or exists (select 1 from public.encounters e where e.appointment_id = a.id))
       and a.end_at <= v_now - pg_catalog.make_interval(hours => ca.delay_hours)
       and a.end_at >  v_now - pg_catalog.make_interval(hours => ca.delay_hours) - interval '48 hours'
       and extract(hour from (v_now at time zone c.timezone)) between 8 and 20
       and not exists (
         select 1 from public.message_log m
          where m.appointment_id = a.id
            and m.template_key = 'treatment_followup'
            and m.status in ('queued', 'sending', 'sent', 'stalled'))
  loop
    v_locale := coalesce(r.preferred_locale, 'he');
    v_recipient := case when r.reminder_channel = 'email' then r.email else r.phone end;
    v_subject := case when r.reminder_channel = 'email' then r.clinic_name else null end;
    v_body := public.render_automation('treatment_followup', r.template, v_locale,
                r.first_name, r.clinic_name, null, null, null);
    perform public.automation_enqueue(r.clinic_id, 'treatment_followup', r.reminder_channel,
      v_recipient, v_body, v_subject, r.patient_id, r.appointment_id,
      pg_catalog.jsonb_build_array(coalesce(r.first_name, ''), r.clinic_name));
    v_count := v_count + 1;
  end loop;

  for r in
    select p.id as patient_id, p.clinic_id,
           c.name as clinic_name, c.reminder_channel, c.timezone,
           p.first_name, p.phone, p.email, p.preferred_locale,
           ca.template, ca.send_hour
      from public.clinic_automations ca
      join public.clinics c on c.id = ca.clinic_id
      join public.patients p on p.clinic_id = c.id
     where ca.kind = 'birthday' and ca.enabled
       and (p_clinic is null or ca.clinic_id = p_clinic)
       and p.is_active and p.date_of_birth is not null
       and extract(hour from (v_now at time zone c.timezone)) between ca.send_hour and 20
       and (
         pg_catalog.to_char(p.date_of_birth, 'MM-DD') = pg_catalog.to_char((v_now at time zone c.timezone)::date, 'MM-DD')
         or (pg_catalog.to_char(p.date_of_birth, 'MM-DD') = '02-29'
             and pg_catalog.to_char((v_now at time zone c.timezone)::date, 'MM-DD') = '03-01'
             and pg_catalog.to_char((v_now at time zone c.timezone)::date - 1, 'MM-DD') = '02-28')
       )
       and public.has_marketing_consent(p.id)
       and not exists (
         select 1 from public.message_log m
          where m.patient_id = p.id
            and m.template_key = 'birthday'
            and m.status in ('queued', 'sending', 'sent', 'stalled')
            and m.created_at > v_now - interval '300 days')
  loop
    v_locale := coalesce(r.preferred_locale, 'he');
    v_recipient := case when r.reminder_channel = 'email' then r.email else r.phone end;
    v_subject := case when r.reminder_channel = 'email' then r.clinic_name else null end;
    insert into public.patient_unsubscribe_tokens (patient_id, clinic_id)
      values (r.patient_id, r.clinic_id) on conflict (patient_id) do nothing;
    select t.token into v_token from public.patient_unsubscribe_tokens t where t.patient_id = r.patient_id;
    v_unsubscribe := v_base || '/' || v_locale || '/unsubscribe/' || v_token::text;
    v_body := public.render_automation('birthday', r.template, v_locale,
                r.first_name, r.clinic_name, null, null, v_unsubscribe);
    perform public.automation_enqueue(r.clinic_id, 'birthday', r.reminder_channel,
      v_recipient, v_body, v_subject, r.patient_id, null,
      pg_catalog.jsonb_build_array(coalesce(r.first_name, ''), r.clinic_name, v_unsubscribe));
    v_count := v_count + 1;
  end loop;

  for r in
    select p.id as patient_id, p.clinic_id,
           c.name as clinic_name, c.reminder_channel, c.booking_enabled, c.booking_slug,
           p.first_name, p.phone, p.email, p.preferred_locale,
           ca.template
      from public.clinic_automations ca
      join public.clinics c on c.id = ca.clinic_id
      join public.patients p on p.clinic_id = c.id
     where ca.kind = 'inactive_reengage' and ca.enabled
       and (p_clinic is null or ca.clinic_id = p_clinic)
       and p.is_active and coalesce(p.treatment_status, 'active') = 'active'
       and extract(hour from (v_now at time zone c.timezone)) between ca.send_hour and 20
       and not exists (
         select 1 from public.appointments f
          where f.patient_id = p.id
            and f.status not in ('cancelled', 'no_show')
            and f.start_at > v_now)
       and greatest(
             (select max(a.start_at) from public.appointments a
               where a.patient_id = p.id and a.status not in ('cancelled', 'no_show') and a.start_at <= v_now),
             (select max(e.encounter_date)::timestamptz from public.encounters e where e.patient_id = p.id)
           ) < v_now - pg_catalog.make_interval(days => ca.inactive_days)
       and public.has_marketing_consent(p.id)
       and not exists (
         select 1 from public.message_log m
          where m.patient_id = p.id
            and m.template_key = 'inactive_reengage'
            and m.status in ('queued', 'sending', 'sent', 'stalled')
            and m.created_at > v_now - interval '180 days')
  loop
    v_locale := coalesce(r.preferred_locale, 'he');
    v_recipient := case when r.reminder_channel = 'email' then r.email else r.phone end;
    v_subject := case when r.reminder_channel = 'email' then r.clinic_name else null end;
    v_booking := case when r.booking_enabled and r.booking_slug is not null
                   then v_base || '/' || v_locale || '/book/' || r.booking_slug
                   else '' end;
    insert into public.patient_unsubscribe_tokens (patient_id, clinic_id)
      values (r.patient_id, r.clinic_id) on conflict (patient_id) do nothing;
    select t.token into v_token from public.patient_unsubscribe_tokens t where t.patient_id = r.patient_id;
    v_unsubscribe := v_base || '/' || v_locale || '/unsubscribe/' || v_token::text;
    v_body := public.render_automation('inactive_reengage', r.template, v_locale,
                r.first_name, r.clinic_name, null, v_booking, v_unsubscribe);
    perform public.automation_enqueue(r.clinic_id, 'inactive_reengage', r.reminder_channel,
      v_recipient, v_body, v_subject, r.patient_id, null,
      pg_catalog.jsonb_build_array(coalesce(r.first_name, ''), r.clinic_name, v_booking, v_unsubscribe));
    v_count := v_count + 1;
  end loop;

  for r in
    select distinct on (p.id)
           a.id as appointment_id, a.clinic_id, p.id as patient_id,
           c.name as clinic_name, c.reminder_channel, c.google_review_url,
           p.first_name, p.phone, p.email, p.preferred_locale,
           ca.template
      from public.clinic_automations ca
      join public.clinics c on c.id = ca.clinic_id
      join public.appointments a on a.clinic_id = c.id
      join public.patients p on p.id = a.patient_id
     where ca.kind = 'review_request' and ca.enabled
       and (p_clinic is null or ca.clinic_id = p_clinic)
       and c.google_review_url is not null
       and a.status not in ('cancelled', 'no_show')
       and (a.status in ('checked_in', 'completed')
            or exists (select 1 from public.encounters e where e.appointment_id = a.id))
       and a.end_at <= v_now - pg_catalog.make_interval(hours => ca.delay_hours)
       and a.end_at >  v_now - pg_catalog.make_interval(hours => ca.delay_hours) - interval '48 hours'
       and extract(hour from (v_now at time zone c.timezone)) between 8 and 20
       and public.has_marketing_consent(p.id)
       and not exists (
         select 1 from public.message_log m
          where m.patient_id = p.id
            and m.template_key = 'review_request'
            and m.status in ('queued', 'sending', 'sent', 'stalled')
            and m.created_at > v_now - interval '180 days')
     order by p.id, a.end_at desc
  loop
    v_locale := coalesce(r.preferred_locale, 'he');
    v_recipient := case when r.reminder_channel = 'email' then r.email else r.phone end;
    v_subject := case when r.reminder_channel = 'email' then r.clinic_name else null end;
    insert into public.patient_unsubscribe_tokens (patient_id, clinic_id)
      values (r.patient_id, r.clinic_id) on conflict (patient_id) do nothing;
    select t.token into v_token from public.patient_unsubscribe_tokens t where t.patient_id = r.patient_id;
    v_unsubscribe := v_base || '/' || v_locale || '/unsubscribe/' || v_token::text;
    v_body := public.render_automation('review_request', r.template, v_locale,
                r.first_name, r.clinic_name, r.google_review_url, null, v_unsubscribe);
    perform public.automation_enqueue(r.clinic_id, 'review_request', r.reminder_channel,
      v_recipient, v_body, v_subject, r.patient_id, r.appointment_id,
      pg_catalog.jsonb_build_array(coalesce(r.first_name, ''), r.clinic_name, r.google_review_url, v_unsubscribe));
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.enqueue_due_automations_at(text, timestamptz, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 14 · Direct writes to the message log
-- ---------------------------------------------------------------------------
-- Rows are written by the queueing functions and the sender. From a signed-in
-- client: a test message to one's own phone or address, and nothing else; an
-- update may only drop a waiting, failed or stalled row as skipped.

create or replace function public.is_own_contact(p_recipient text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_recipient is not null and (
    exists (select 1 from public.profiles pr
             where pr.id = auth.uid() and pg_catalog.btrim(pr.phone) = pg_catalog.btrim(p_recipient))
    or exists (select 1 from auth.users u
                where u.id = auth.uid() and pg_catalog.lower(u.email) = pg_catalog.lower(pg_catalog.btrim(p_recipient)))
  );
$$;

revoke all on function public.is_own_contact(text) from public, anon, authenticated;
grant execute on function public.is_own_contact(text) to authenticated;

drop policy if exists message_log_staff_insert on public.message_log;
create policy message_log_staff_insert on public.message_log
  for insert with check (
    clinic_id = (select public.current_clinic_id())
    and (select public.has_clinic_role(public.current_clinic_id(), array['owner', 'practitioner', 'staff']))
    and template_key = 'test_message'
    and channel in ('sms', 'whatsapp', 'email')
    and status = 'queued'
    and public.is_own_contact(recipient)
  );

drop policy if exists message_log_staff_update on public.message_log;
create policy message_log_staff_update on public.message_log
  for update
  using (
    clinic_id = (select public.current_clinic_id())
    and (select public.has_clinic_role(public.current_clinic_id(), array['owner', 'practitioner', 'staff']))
  )
  with check (
    clinic_id = (select public.current_clinic_id())
    and (select public.has_clinic_role(public.current_clinic_id(), array['owner', 'practitioner', 'staff']))
  );

create or replace function public.message_log_guard_client_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if new.status <> 'skipped'
       or old.status not in ('queued', 'failed', 'stalled')
       or (pg_catalog.to_jsonb(new) - 'status' - 'error_code') <> (pg_catalog.to_jsonb(old) - 'status' - 'error_code') then
      raise exception 'message_log_client_may_only_skip' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.message_log_guard_client_update() from public, anon, authenticated;

drop trigger if exists message_log_guard_client_update on public.message_log;
create trigger message_log_guard_client_update
  before update on public.message_log
  for each row execute function public.message_log_guard_client_update();

-- ---------------------------------------------------------------------------
-- 15 · Dispensing with its details, once
-- ---------------------------------------------------------------------------
-- The stock was taken by `dispense_formula` and the preparation and dose were
-- written by a second call; a failure in between reported an error for herbs
-- that had left the jar, and a retry took them twice. Now one call does both
-- in one transaction, and a key the form generated makes a retry return the
-- first result instead of dispensing again.

alter table public.dispensing_records
  add column if not exists idempotency_key uuid;

create unique index if not exists dispensing_records_idempotency_idx
  on public.dispensing_records (clinic_id, idempotency_key)
  where idempotency_key is not null;

create or replace function public.dispense_with_details(
  p_encounter_id uuid,
  p_formula_id uuid,
  p_items jsonb,
  p_multiplier numeric,
  p_notes text,
  p_preparation text,
  p_dose_amount numeric,
  p_dose_unit text,
  p_dose_timing text,
  p_doses_per_day numeric,
  p_idempotency_key uuid
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_idempotency_key is not null then
    select d.id into v_id
      from public.dispensing_records d
     where d.idempotency_key = p_idempotency_key
       and d.encounter_id = p_encounter_id;
    if v_id is not null then
      return v_id;
    end if;
  end if;

  v_id := public.dispense_formula(p_encounter_id, p_formula_id, coalesce(p_items, '[]'::jsonb), p_multiplier, p_notes);

  -- A second call racing with the same key fails here on the unique index and
  -- its whole transaction — the stock it took included — rolls back.
  update public.dispensing_records
     set preparation = p_preparation,
         dose_amount = p_dose_amount,
         dose_unit = p_dose_unit,
         dose_timing = p_dose_timing,
         doses_per_day = p_doses_per_day,
         idempotency_key = p_idempotency_key
   where id = v_id;

  return v_id;
end;
$$;

revoke all on function public.dispense_with_details(uuid, uuid, jsonb, numeric, text, text, numeric, text, text, numeric, uuid) from public, anon, authenticated;
grant execute on function public.dispense_with_details(uuid, uuid, jsonb, numeric, text, text, numeric, text, text, numeric, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 16 · The access log records only what the caller could read
-- ---------------------------------------------------------------------------
-- Definer rights see past the policies, so the check is written out: the
-- patient the record belongs to must be one the caller reaches, and a clinical
-- record needs a clinical role. Body as in migration 68 otherwise.

create or replace function public.log_record_access(
  p_table text,
  p_record uuid,
  p_action text default 'view'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_clinic uuid;
  v_patient uuid;
  v_user uuid := auth.uid();
  v_belongs boolean;
begin
  if v_user is null or p_record is null then
    return;
  end if;

  if p_action not in ('view', 'export') then
    raise exception 'log_record_access only records view or export';
  end if;

  if p_table not in (
    'patients', 'encounters', 'tcm_notes', 'patient_documents', 'invoices',
    'appointments', 'form_submissions', 'dispensing_records', 'treatment_confirmations'
  ) then
    raise exception 'log_record_access does not record %', p_table;
  end if;

  v_clinic := public.current_clinic_id();

  if v_clinic is null then
    v_patient := public.current_patient_id();
    if v_patient is null then
      return;
    end if;
    if p_table not in ('patients', 'patient_documents', 'invoices', 'appointments', 'form_submissions') then
      raise exception 'log_record_access does not record % from the portal', p_table;
    end if;
    execute pg_catalog.format(
      'select exists (select 1 from public.%I where id = $1 and %I = $2)',
      p_table,
      case when p_table = 'patients' then 'id' else 'patient_id' end
    ) into v_belongs using p_record, v_patient;
    if not v_belongs then
      raise exception 'log_record_access: that record is not this patient''s';
    end if;
    select p.clinic_id into v_clinic from public.patients p where p.id = v_patient;
    if v_clinic is null then
      return;
    end if;
  else
    if p_table = 'patients' then
      select p.id into v_patient from public.patients p where p.id = p_record and p.clinic_id = v_clinic;
    elsif p_table = 'tcm_notes' then
      select e.patient_id into v_patient
        from public.tcm_notes n
        join public.encounters e on e.id = n.encounter_id
       where n.id = p_record and n.clinic_id = v_clinic;
    else
      execute pg_catalog.format('select patient_id from public.%I where id = $1 and clinic_id = $2', p_table)
        into v_patient using p_record, v_clinic;
    end if;
    if v_patient is null then
      raise exception 'log_record_access: that record is not in this clinic';
    end if;
    if not public.sees_patient(v_patient)
       or (p_table in ('encounters', 'tcm_notes', 'patient_documents', 'form_submissions', 'dispensing_records')
           and not public.sees_clinical()) then
      raise exception 'log_record_access: that record is not one this person reads';
    end if;
  end if;

  if p_action = 'view' and exists (
    select 1 from public.audit_log
    where clinic_id = v_clinic
      and table_name = p_table
      and record_id = p_record
      and changed_by = v_user
      and action = 'view'
      and changed_at > pg_catalog.now() - interval '15 minutes'
  ) then
    return;
  end if;

  insert into public.audit_log (clinic_id, table_name, record_id, action, changed_by, diff)
  values (v_clinic, p_table, p_record, p_action, v_user, null);
end;
$$;

revoke all on function public.log_record_access(text, uuid, text) from public, anon, authenticated;
grant execute on function public.log_record_access(text, uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 17 · "Send now": the clinic's roles, and a link base that is only a base
-- ---------------------------------------------------------------------------
-- The link base becomes part of a message a patient receives. It must be an
-- https origin (or localhost for development) — no path, no query, no user
-- info — and, once the platform lists its addresses in `platform_link_bases`
-- (SQL editor only; no policy reaches it), one of them.

create table if not exists public.platform_link_bases (
  url text primary key check (url ~ '^(https://[a-z0-9.-]+|http://localhost(:[0-9]+)?)$')
);

alter table public.platform_link_bases enable row level security;

comment on table public.platform_link_bases is
  'The addresses reminder and unsubscribe links may point at. Filled in the SQL editor after deploying (e.g. insert into public.platform_link_bases values (''https://app.example.co.il'')). While empty, any well-formed https origin is accepted.';

create or replace function public.enqueue_now_for_my_clinic(p_base_url text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_clinic uuid := public.current_clinic_id();
  v_base text := pg_catalog.lower(pg_catalog.rtrim(pg_catalog.btrim(coalesce(p_base_url, '')), '/'));
begin
  if v_clinic is null
     or not public.has_clinic_role(v_clinic, array['owner', 'practitioner', 'staff']) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if v_base !~ '^(https://[a-z0-9.-]+|http://localhost(:[0-9]+)?)$'
     or (exists (select 1 from public.platform_link_bases)
         and not exists (select 1 from public.platform_link_bases b where b.url = v_base)) then
    raise exception 'bad_base_url' using errcode = '22023';
  end if;

  return public.enqueue_due_reminders(v_base, v_clinic)
       + public.enqueue_due_task_alerts(v_clinic)
       + public.enqueue_due_automations(v_base, v_clinic);
end;
$$;

revoke all on function public.enqueue_now_for_my_clinic(text) from public, anon, authenticated;
grant execute on function public.enqueue_now_for_my_clinic(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 18 · The portal password check (section 5 of migration 68)
-- ---------------------------------------------------------------------------
-- The hand-run copy of migration 68 (root SQL 60) stopped before this section,
-- so the live database may still hold the version that matched on user id only.

create or replace function public.portal_password_login_allowed()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.patient_portal_access a
      join public.clinics c on c.id = a.clinic_id
     where a.is_active
       and c.is_synthetic
       and (
         a.user_id = auth.uid()
         or pg_catalog.lower(a.email) = (select pg_catalog.lower(u.email) from auth.users u where u.id = auth.uid())
       )
  );
$$;

revoke all on function public.portal_password_login_allowed() from public, anon, authenticated;
grant execute on function public.portal_password_login_allowed() to authenticated;

-- ---------------------------------------------------------------------------
-- 19 · Patient status counts, counted where the rows are
-- ---------------------------------------------------------------------------
-- The list fetched every patient's status to count them in the app, which
-- stopped silently at the service's 1,000-row cap. Invoker rights: the caller's
-- own policies decide which patients are counted.

create or replace function public.patient_status_counts()
returns table (treatment_status text, patients bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(p.treatment_status, 'active') as treatment_status, count(*) as patients
    from public.patients p
   where p.clinic_id = public.current_clinic_id()
   group by 1;
$$;

revoke all on function public.patient_status_counts() from public, anon, authenticated;
grant execute on function public.patient_status_counts() to authenticated;
