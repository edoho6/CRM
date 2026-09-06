-- ============================================================================
-- 03 · Patients
-- ============================================================================
-- Contact details and clinical background are separate tables on purpose: the
-- background is the more sensitive of the two, and splitting it now means a
-- future role that may book appointments but not read medical history is a policy
-- change rather than a data migration.
-- ============================================================================

create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null default public.current_clinic_id() references public.clinics(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  full_name text generated always as (first_name || ' ' || last_name) stored,
  date_of_birth date,
  sex text not null default 'unspecified'
    check (sex in ('female', 'male', 'other', 'unspecified')),
  national_id text,
  phone text,
  email text,
  address text,
  city text,
  emergency_contact_name text,
  emergency_contact_phone text,
  occupation text,
  referral_source text,
  preferred_locale text not null default 'he' check (preferred_locale in ('he', 'en')),
  notes text,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists patients_clinic_active_idx
  on public.patients (clinic_id, is_active, last_name, first_name);

-- Free-text search across name, phone and email, which is how the front desk looks
-- someone up. Trigram indexes handle partial matches in Hebrew and English alike,
-- and one index per column is what the `ilike` on each column can actually use.
create extension if not exists "pg_trgm";

create index if not exists patients_full_name_trgm_idx
  on public.patients using gin (full_name gin_trgm_ops);

create index if not exists patients_phone_trgm_idx
  on public.patients using gin (phone gin_trgm_ops);

create index if not exists patients_email_trgm_idx
  on public.patients using gin (email gin_trgm_ops);

create trigger patients_set_updated_at
  before update on public.patients
  for each row execute function public.set_updated_at();

create trigger patients_audit
  after insert or update or delete on public.patients
  for each row execute function public.write_audit_log();

-- ---------------------------------------------------------------------------
-- patient_medical_history — one row per patient
-- ---------------------------------------------------------------------------

create table if not exists public.patient_medical_history (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null default public.current_clinic_id() references public.clinics(id) on delete cascade,
  patient_id uuid not null unique references public.patients(id) on delete cascade,
  allergies text,
  medications text,
  chronic_conditions text,
  surgeries text,
  family_history text,
  lifestyle_notes text,
  pregnancy_status text,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger patient_medical_history_set_updated_at
  before update on public.patient_medical_history
  for each row execute function public.set_updated_at();

create trigger patient_medical_history_audit
  after insert or update or delete on public.patient_medical_history
  for each row execute function public.write_audit_log();

-- ---------------------------------------------------------------------------
-- patient_documents — metadata for files kept in Supabase Storage
-- ---------------------------------------------------------------------------

create table if not exists public.patient_documents (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null default public.current_clinic_id() references public.clinics(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  uploaded_by uuid references auth.users(id) on delete set null,
  file_path text not null,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  category text not null default 'other'
    check (category in ('intake_form', 'lab_result', 'id_scan', 'other')),
  -- Drives what the patient portal shows. Defaults to private: sharing is a
  -- deliberate act, never the fallback.
  shared_with_patient boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists patient_documents_patient_idx
  on public.patient_documents (clinic_id, patient_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Storage bucket for the files themselves
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('patient-documents', 'patient-documents', false)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.patients enable row level security;
alter table public.patient_medical_history enable row level security;
alter table public.patient_documents enable row level security;

drop policy if exists patients_staff_all on public.patients;
create policy patients_staff_all on public.patients
  for all using (public.is_clinic_member(clinic_id))
  with check (public.is_clinic_member(clinic_id));

drop policy if exists patient_medical_history_staff_all on public.patient_medical_history;
create policy patient_medical_history_staff_all on public.patient_medical_history
  for all using (public.is_clinic_member(clinic_id))
  with check (public.is_clinic_member(clinic_id));

drop policy if exists patient_documents_staff_all on public.patient_documents;
create policy patient_documents_staff_all on public.patient_documents
  for all using (public.is_clinic_member(clinic_id))
  with check (public.is_clinic_member(clinic_id));

-- Staff may read and write files under their own clinic's folder.
-- Object keys are `<clinic_id>/<patient_id>/<filename>`. The comparison casts the
-- trusted clinic id to text rather than casting the untrusted object name to uuid,
-- so a malformed key can never raise inside a security policy.
drop policy if exists patient_documents_storage_staff on storage.objects;
create policy patient_documents_storage_staff on storage.objects
  for all
  using (
    bucket_id = 'patient-documents'
    and split_part(name, '/', 1) = public.current_clinic_id()::text
  )
  with check (
    bucket_id = 'patient-documents'
    and split_part(name, '/', 1) = public.current_clinic_id()::text
  );
