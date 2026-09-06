-- ============================================================================
-- 09 · Patient portal access
-- ============================================================================
-- Patients sign in as real auth users but hold no clinic membership, so every
-- staff policy written so far already excludes them by construction. Their access
-- is granted here, additively, and only to their own rows.
--
-- This is the safety property worth stating plainly: a patient cannot see a
-- clinical note, because no policy on `tcm_notes` mentions patients at all.
-- ============================================================================

create table if not exists public.patient_portal_access (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null default public.current_clinic_id() references public.clinics(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  -- Null until the patient first signs in; the invite is created before the
  -- auth user exists.
  user_id uuid references auth.users(id) on delete set null,
  email text not null,
  invited_at timestamptz not null default now(),
  activated_at timestamptz,
  is_active boolean not null default true,
  unique (patient_id),
  unique (user_id)
);

create index if not exists patient_portal_access_email_idx
  on public.patient_portal_access (lower(email)) where is_active;

-- ---------------------------------------------------------------------------
-- Identity helper for portal users
-- ---------------------------------------------------------------------------

create or replace function public.current_patient_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select ppa.patient_id
  from public.patient_portal_access ppa
  where ppa.user_id = auth.uid()
    and ppa.is_active
  limit 1;
$$;

comment on function public.current_patient_id() is
  'The patient file belonging to the signed-in portal user, or null for staff. Every patient-facing policy is anchored on this.';

-- Links a freshly signed-in magic-link user to the invite created for their email.
create or replace function public.claim_portal_access()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_patient uuid;
begin
  select lower(u.email) into v_email from auth.users u where u.id = auth.uid();
  if v_email is null then
    return null;
  end if;

  update public.patient_portal_access
     set user_id = auth.uid(),
         activated_at = coalesce(activated_at, now())
   where lower(email) = v_email
     and is_active
     and user_id is null
  returning patient_id into v_patient;

  if v_patient is null then
    select patient_id into v_patient
    from public.patient_portal_access
    where user_id = auth.uid() and is_active
    limit 1;
  end if;

  return v_patient;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.patient_portal_access enable row level security;

drop policy if exists patient_portal_access_staff on public.patient_portal_access;
create policy patient_portal_access_staff on public.patient_portal_access
  for all using (public.is_clinic_member(clinic_id))
  with check (public.is_clinic_member(clinic_id));

drop policy if exists patient_portal_access_self on public.patient_portal_access;
create policy patient_portal_access_self on public.patient_portal_access
  for select using (user_id = auth.uid());

-- --- What a patient may read -----------------------------------------------

-- Their own patient record (contact details only — medical history has no such policy).
drop policy if exists patients_portal_self on public.patients;
create policy patients_portal_self on public.patients
  for select using (id = public.current_patient_id());

-- Their own appointments.
drop policy if exists appointments_portal_self on public.appointments;
create policy appointments_portal_self on public.appointments
  for select using (patient_id = public.current_patient_id());

-- Appointment types, so the portal can name the booking rather than show a blank.
drop policy if exists appointment_types_portal_read on public.appointment_types;
create policy appointment_types_portal_read on public.appointment_types
  for select using (
    public.current_patient_id() is not null
    and clinic_id = (
      select p.clinic_id from public.patients p where p.id = public.current_patient_id()
    )
  );

-- The practitioner's display name for those appointments.
drop policy if exists profiles_portal_read_practitioner on public.profiles;
create policy profiles_portal_read_practitioner on public.profiles
  for select using (
    public.current_patient_id() is not null
    and exists (
      select 1
      from public.appointments a
      where a.patient_id = public.current_patient_id()
        and a.practitioner_id = public.profiles.id
    )
  );

-- Only documents explicitly shared with them.
drop policy if exists patient_documents_portal_self on public.patient_documents;
create policy patient_documents_portal_self on public.patient_documents
  for select using (
    patient_id = public.current_patient_id()
    and shared_with_patient
  );

-- The matching storage rule, so the file itself is reachable and nothing else is.
drop policy if exists patient_documents_storage_portal on storage.objects;
create policy patient_documents_storage_portal on storage.objects
  for select using (
    bucket_id = 'patient-documents'
    and exists (
      select 1
      from public.patient_documents d
      where d.file_path = storage.objects.name
        and d.patient_id = public.current_patient_id()
        and d.shared_with_patient
    )
  );
