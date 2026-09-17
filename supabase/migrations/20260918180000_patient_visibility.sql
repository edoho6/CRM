-- ============================================================================
--  Who sees which patient (decisions of 18.9)
-- ============================================================================
--  Until now every member of a clinic saw everything. Four roles existed in the
--  table and only `owner` was ever checked, which meant a secretary invited to
--  help with the diary could read every medical record in the clinic.
--
--  What the clinic's owner decided:
--    · a practitioner sees their own patients — "own" is the default, because
--      most clinics work that way, but a clinic where a patient is seen by
--      whoever is free can switch to "clinic" and share them all
--    · a secretary (`staff`) sees every patient's contact details, diary and
--      invoices — the whole invoice, lines included — and no clinical record
--    · the owner sees everything, always
--    · `assistant` stays defined and unused; it reaches nothing
--
--  The shape: rather than rewriting a hundred policies to walk appointments and
--  encounters per row, one small table records who treats whom. It fills itself
--  from the diary and the treatment record, so nobody has to maintain it, and a
--  policy becomes a single indexed lookup instead of a scan.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. How this clinic works
-- ---------------------------------------------------------------------------
alter table public.clinics
  add column if not exists patient_visibility text not null default 'own';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'clinics_patient_visibility_check') then
    alter table public.clinics
      add constraint clinics_patient_visibility_check
      check (patient_visibility in ('own', 'clinic'));
  end if;
end;
$$;

comment on column public.clinics.patient_visibility is
  '"own": a practitioner reaches the patients they treat. "clinic": every practitioner reaches every patient. The owner and the secretary are unaffected either way.';

-- ---------------------------------------------------------------------------
-- 2. Who treats whom
-- ---------------------------------------------------------------------------
create table if not exists public.patient_practitioners (
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  -- 'appointment' and 'encounter' are written by the triggers below; 'manual'
  -- is a person saying so, and is the only kind a person may remove.
  source text not null default 'manual' check (source in ('appointment', 'encounter', 'manual')),
  created_at timestamptz not null default now(),
  primary key (patient_id, user_id)
);

comment on table public.patient_practitioners is
  'Which practitioner treats which patient. Filled by the diary and the treatment record; a row may also be added by hand for a case they do not cover.';

-- The policy asks "is this patient mine", so the patient is the leading column.
create index if not exists patient_practitioners_user_idx
  on public.patient_practitioners (user_id, patient_id);
create index if not exists patient_practitioners_clinic_idx
  on public.patient_practitioners (clinic_id, patient_id);

-- ---------------------------------------------------------------------------
-- 3. The two questions every policy asks
-- ---------------------------------------------------------------------------

/**
 * May the caller see clinical content at all — a treatment record, a note, a
 * prescription? The owner and a practitioner may; a secretary may not, and
 * neither may an assistant. It says nothing about *which* patient.
 */
create or replace function public.sees_clinical()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.memberships m
     where m.user_id = auth.uid()
       and m.clinic_id = public.current_clinic_id()
       and m.is_active
       and m.role in ('owner', 'practitioner')
  );
$$;

/**
 * May the caller reach this patient at all?
 *
 * The owner and the secretary reach every patient in the clinic. A practitioner
 * reaches the ones they treat, unless the clinic shares them. An assistant
 * reaches none — the role is defined and unused.
 *
 * Marked `leakproof` is deliberately NOT done here: it reads tables, and the
 * planner is free to call it after cheaper filters.
 */
create or replace function public.sees_patient(p_patient uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when v.role is null then false
    when v.role in ('owner', 'staff') then true
    when v.role = 'practitioner' then
      v.visibility = 'clinic'
      or exists (
        select 1
          from public.patient_practitioners pp
         where pp.patient_id = p_patient
           and pp.user_id = auth.uid()
      )
    else false
  end
  from (
    select m.role, c.patient_visibility as visibility
      from public.memberships m
      join public.clinics c on c.id = m.clinic_id
     where m.user_id = auth.uid()
       and m.clinic_id = public.current_clinic_id()
       and m.is_active
     limit 1
  ) v;
$$;

revoke all on function public.sees_clinical() from public;
revoke execute on function public.sees_clinical() from anon;
grant execute on function public.sees_clinical() to authenticated;

revoke all on function public.sees_patient(uuid) from public;
revoke execute on function public.sees_patient(uuid) from anon;
grant execute on function public.sees_patient(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. The table fills itself
-- ---------------------------------------------------------------------------

/**
 * A booked appointment or a written treatment makes that patient this
 * practitioner's. It stays that way: the record they wrote is theirs to read
 * afterwards, which is also what a medical record is for.
 */
create or replace function public.link_patient_practitioner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.practitioner_id is not null then
    insert into public.patient_practitioners (clinic_id, patient_id, user_id, source)
    values (new.clinic_id, new.patient_id, new.practitioner_id, tg_argv[0])
    on conflict (patient_id, user_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists appointments_link_practitioner on public.appointments;
create trigger appointments_link_practitioner
  after insert or update of practitioner_id, patient_id on public.appointments
  for each row execute function public.link_patient_practitioner('appointment');

drop trigger if exists encounters_link_practitioner on public.encounters;
create trigger encounters_link_practitioner
  after insert or update of practitioner_id, patient_id on public.encounters
  for each row execute function public.link_patient_practitioner('encounter');

-- Everything already in the diary and the record, so nobody loses a patient
-- the moment this runs.
insert into public.patient_practitioners (clinic_id, patient_id, user_id, source)
select distinct a.clinic_id, a.patient_id, a.practitioner_id, 'appointment'
  from public.appointments a
 where a.practitioner_id is not null
on conflict (patient_id, user_id) do nothing;

insert into public.patient_practitioners (clinic_id, patient_id, user_id, source)
select distinct e.clinic_id, e.patient_id, e.practitioner_id, 'encounter'
  from public.encounters e
 where e.practitioner_id is not null
on conflict (patient_id, user_id) do nothing;

-- ---------------------------------------------------------------------------
-- 5. Policies on the link table itself
-- ---------------------------------------------------------------------------
alter table public.patient_practitioners enable row level security;

drop policy if exists patient_practitioners_read on public.patient_practitioners;
create policy patient_practitioners_read on public.patient_practitioners
  for select using (public.is_clinic_member(clinic_id));

-- Only the owner assigns a patient by hand; the triggers run as the table's
-- owner and are not subject to this.
drop policy if exists patient_practitioners_owner_writes on public.patient_practitioners;
create policy patient_practitioners_owner_writes on public.patient_practitioners
  for all
  using (public.has_clinic_role(clinic_id, array['owner']))
  with check (public.has_clinic_role(clinic_id, array['owner']));

-- ---------------------------------------------------------------------------
-- 6. The policies, in two groups
-- ---------------------------------------------------------------------------
--  Administrative — the file, the diary and the money. The secretary works
--  here: she books, she charges, she chases payment, and she was given the
--  whole invoice including its lines, so she can answer what a charge was for.
--
--  Clinical — the record, the notes, what was dispensed, what a questionnaire
--  said, and the tags that can state a condition. The secretary reaches none of
--  it; a practitioner reaches it for their own patients.
--
--  Child rows (a note under a treatment, a line under an invoice) are judged by
--  their parent: they carry no patient of their own, and a policy that forgot
--  them would leave the contents readable while the row above was not.
-- ---------------------------------------------------------------------------

-- Administrative -------------------------------------------------------------
-- Opening a file is its own policy, and it has to be: at the moment of the
-- insert the patient is nobody's yet, so a rule written as "the patient must be
-- mine" would have stopped a practitioner from taking on anyone new. The
-- trigger below makes them theirs as the row lands.
drop policy if exists patients_staff_all on public.patients;
create policy patients_staff_read on public.patients
  for select using (public.is_clinic_member(clinic_id) and public.sees_patient(id));

drop policy if exists patients_staff_write on public.patients;
create policy patients_staff_write on public.patients
  for update using (public.is_clinic_member(clinic_id) and public.sees_patient(id))
  with check (public.is_clinic_member(clinic_id) and public.sees_patient(id));

-- Deleting a patient is the owner's alone (decision of 18.9: a secretary may
-- remove an appointment, never a file).
drop policy if exists patients_owner_deletes on public.patients;
create policy patients_owner_deletes on public.patients
  for delete using (public.has_clinic_role(clinic_id, array['owner']));

drop policy if exists patients_staff_insert on public.patients;
create policy patients_staff_insert on public.patients
  for insert
  with check (
    public.is_clinic_member(clinic_id)
    and public.has_clinic_role(clinic_id, array['owner', 'practitioner', 'staff'])
  );

/** A practitioner who opens a file is treating that person. */
create or replace function public.link_new_patient()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.memberships m
     where m.user_id = auth.uid()
       and m.clinic_id = new.clinic_id
       and m.is_active
       and m.role = 'practitioner'
  ) then
    insert into public.patient_practitioners (clinic_id, patient_id, user_id, source)
    values (new.clinic_id, new.id, auth.uid(), 'manual')
    on conflict (patient_id, user_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists patients_link_creator on public.patients;
create trigger patients_link_creator
  after insert on public.patients
  for each row execute function public.link_new_patient();

drop policy if exists appointments_staff_all on public.appointments;
create policy appointments_staff_all on public.appointments
  for all using (public.is_clinic_member(clinic_id) and public.sees_patient(patient_id))
  with check (public.is_clinic_member(clinic_id) and public.sees_patient(patient_id));

drop policy if exists invoices_staff_all on public.invoices;
create policy invoices_staff_all on public.invoices
  for all using (public.is_clinic_member(clinic_id) and public.sees_patient(patient_id))
  with check (public.is_clinic_member(clinic_id) and public.sees_patient(patient_id));

drop policy if exists patient_packages_staff_all on public.patient_packages;
create policy patient_packages_staff_all on public.patient_packages
  for all using (public.is_clinic_member(clinic_id) and public.sees_patient(patient_id))
  with check (public.is_clinic_member(clinic_id) and public.sees_patient(patient_id));

drop policy if exists treatment_confirmations_staff_all on public.treatment_confirmations;
create policy treatment_confirmations_staff_all on public.treatment_confirmations
  for all using (public.is_clinic_member(clinic_id) and public.sees_patient(patient_id))
  with check (public.is_clinic_member(clinic_id) and public.sees_patient(patient_id));

-- A task need not be about anyone; one that is follows its patient.
drop policy if exists clinic_tasks_staff_all on public.clinic_tasks;
create policy clinic_tasks_staff_all on public.clinic_tasks
  for all
  using (public.is_clinic_member(clinic_id) and (patient_id is null or public.sees_patient(patient_id)))
  with check (public.is_clinic_member(clinic_id) and (patient_id is null or public.sees_patient(patient_id)));

-- Clinical -------------------------------------------------------------------
drop policy if exists encounters_staff_all on public.encounters;
create policy encounters_staff_all on public.encounters
  for all
  using (public.is_clinic_member(clinic_id) and (select public.sees_clinical()) and public.sees_patient(patient_id))
  with check (public.is_clinic_member(clinic_id) and (select public.sees_clinical()) and public.sees_patient(patient_id));

drop policy if exists patient_medical_history_staff_all on public.patient_medical_history;
create policy patient_medical_history_staff_all on public.patient_medical_history
  for all
  using (public.is_clinic_member(clinic_id) and (select public.sees_clinical()) and public.sees_patient(patient_id))
  with check (public.is_clinic_member(clinic_id) and (select public.sees_clinical()) and public.sees_patient(patient_id));

drop policy if exists patient_documents_staff_all on public.patient_documents;
create policy patient_documents_staff_all on public.patient_documents
  for all
  using (public.is_clinic_member(clinic_id) and (select public.sees_clinical()) and public.sees_patient(patient_id))
  with check (public.is_clinic_member(clinic_id) and (select public.sees_clinical()) and public.sees_patient(patient_id));

drop policy if exists dispensing_records_staff_all on public.dispensing_records;
create policy dispensing_records_staff_all on public.dispensing_records
  for all
  using (public.is_clinic_member(clinic_id) and (select public.sees_clinical()) and public.sees_patient(patient_id))
  with check (public.is_clinic_member(clinic_id) and (select public.sees_clinical()) and public.sees_patient(patient_id));

drop policy if exists form_submissions_staff_all on public.form_submissions;
create policy form_submissions_staff_all on public.form_submissions
  for all
  using (public.is_clinic_member(clinic_id) and (select public.sees_clinical()) and public.sees_patient(patient_id))
  with check (public.is_clinic_member(clinic_id) and (select public.sees_clinical()) and public.sees_patient(patient_id));

-- A tag can say "pregnant" as easily as "prefers mornings".
drop policy if exists patient_tag_links_staff_all on public.patient_tag_links;
create policy patient_tag_links_staff_all on public.patient_tag_links
  for all
  using (public.is_clinic_member(clinic_id) and (select public.sees_clinical()) and public.sees_patient(patient_id))
  with check (public.is_clinic_member(clinic_id) and (select public.sees_clinical()) and public.sees_patient(patient_id));

-- Children, judged by their parent --------------------------------------------
drop policy if exists tcm_notes_staff_all on public.tcm_notes;
create policy tcm_notes_staff_all on public.tcm_notes
  for all
  using (
    public.is_clinic_member(clinic_id)
    and exists (select 1 from public.encounters e where e.id = tcm_notes.encounter_id)
  )
  with check (
    public.is_clinic_member(clinic_id)
    and exists (select 1 from public.encounters e where e.id = tcm_notes.encounter_id)
  );

drop policy if exists dispensing_items_staff_all on public.dispensing_items;
create policy dispensing_items_staff_all on public.dispensing_items
  for all
  using (
    public.is_clinic_member(clinic_id)
    and exists (select 1 from public.dispensing_records d where d.id = dispensing_items.dispensing_record_id)
  )
  with check (
    public.is_clinic_member(clinic_id)
    and exists (select 1 from public.dispensing_records d where d.id = dispensing_items.dispensing_record_id)
  );

drop policy if exists invoice_items_staff_all on public.invoice_items;
create policy invoice_items_staff_all on public.invoice_items
  for all
  using (
    public.is_clinic_member(clinic_id)
    and exists (select 1 from public.invoices i where i.id = invoice_items.invoice_id)
  )
  with check (
    public.is_clinic_member(clinic_id)
    and exists (select 1 from public.invoices i where i.id = invoice_items.invoice_id)
  );

drop policy if exists payments_staff_all on public.payments;
create policy payments_staff_all on public.payments
  for all
  using (
    public.is_clinic_member(clinic_id)
    and exists (select 1 from public.invoices i where i.id = payments.invoice_id)
  )
  with check (
    public.is_clinic_member(clinic_id)
    and exists (select 1 from public.invoices i where i.id = payments.invoice_id)
  );

drop policy if exists package_redemptions_staff_all on public.package_redemptions;
create policy package_redemptions_staff_all on public.package_redemptions
  for all
  using (
    public.is_clinic_member(clinic_id)
    and exists (select 1 from public.patient_packages p where p.id = package_redemptions.package_id)
  )
  with check (
    public.is_clinic_member(clinic_id)
    and exists (select 1 from public.patient_packages p where p.id = package_redemptions.package_id)
  );
