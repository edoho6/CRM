-- ============================================================================
-- 05 · Clinical documentation
-- ============================================================================
-- An `encounter` is the visit; the `tcm_note` is what was written about it. They
-- are separate because herbs dispensed, documents and (later) invoice lines all
-- hang off the visit, not off the note.
--
-- An encounter can exist without an appointment, which is what makes walk-ins and
-- retrospective documentation possible.
-- ============================================================================

create table if not exists public.encounters (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null default public.current_clinic_id() references public.clinics(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  appointment_id uuid unique references public.appointments(id) on delete set null,
  practitioner_id uuid not null references public.profiles(id) on delete restrict,
  encounter_date date not null default current_date,
  status text not null default 'draft' check (status in ('draft', 'signed')),
  signed_at timestamptz,
  signed_by uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint encounters_signed_fields check (
    (status = 'draft' and signed_at is null and signed_by is null)
    or (status = 'signed' and signed_at is not null)
  )
);

create index if not exists encounters_patient_idx
  on public.encounters (clinic_id, patient_id, encounter_date desc);

create index if not exists encounters_status_idx
  on public.encounters (clinic_id, status, encounter_date desc);

create trigger encounters_set_updated_at
  before update on public.encounters
  for each row execute function public.set_updated_at();

create trigger encounters_audit
  after insert or update or delete on public.encounters
  for each row execute function public.write_audit_log();

-- ---------------------------------------------------------------------------
-- tcm_notes — the structured treatment record
-- ---------------------------------------------------------------------------
-- Tongue and pulse get their own columns rather than living in one free-text blob:
-- they are the two findings a practitioner looks back through history for, and
-- searching prose for "thin white coating" does not work.

create table if not exists public.tcm_notes (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null default public.current_clinic_id() references public.clinics(id) on delete cascade,
  encounter_id uuid not null unique references public.encounters(id) on delete cascade,

  chief_complaint text,
  history_of_present_illness text,

  tongue_body_color text,
  tongue_shape text,
  tongue_coating text,
  tongue_notes text,

  pulse_left text,
  pulse_right text,
  pulse_qualities text[] not null default '{}',
  pulse_notes text,

  tcm_pattern_diagnosis text,
  western_diagnosis text,
  treatment_principle text,

  modalities_used text[] not null default '{}',
  -- Array of {point, side, technique, retention_minutes, notes}
  points_used jsonb not null default '[]'::jsonb,

  treatment_notes text,
  recommendations text,
  follow_up_plan text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint tcm_notes_points_is_array check (jsonb_typeof(points_used) = 'array')
);

create trigger tcm_notes_set_updated_at
  before update on public.tcm_notes
  for each row execute function public.set_updated_at();

create trigger tcm_notes_audit
  after insert or update or delete on public.tcm_notes
  for each row execute function public.write_audit_log();

-- ---------------------------------------------------------------------------
-- Signing locks the record
-- ---------------------------------------------------------------------------

create or replace function public.prevent_signed_note_edit()
returns trigger
language plpgsql
as $$
declare
  v_status text;
begin
  select status into v_status
  from public.encounters
  where id = coalesce(new.encounter_id, old.encounter_id);

  if v_status = 'signed' then
    raise exception 'encounter_locked'
      using hint = 'This treatment record has been signed and can no longer be edited.';
  end if;

  return coalesce(new, old);
end;
$$;

create trigger tcm_notes_block_edit_after_signing
  before update or delete on public.tcm_notes
  for each row execute function public.prevent_signed_note_edit();

-- A signed encounter may not be edited or re-opened. Milestone 2 can add a proper
-- addendum record; silently mutating signed clinical history is never acceptable.
create or replace function public.prevent_signed_encounter_edit()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'signed' then
    raise exception 'encounter_locked'
      using hint = 'This treatment record has been signed and can no longer be edited.';
  end if;
  return new;
end;
$$;

create trigger encounters_block_edit_after_signing
  before update on public.encounters
  for each row
  when (old.status = 'signed')
  execute function public.prevent_signed_encounter_edit();

-- ---------------------------------------------------------------------------
-- Signing helper — sets status, timestamp and signer atomically
-- ---------------------------------------------------------------------------

create or replace function public.sign_encounter(p_encounter_id uuid)
returns public.encounters
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_encounter public.encounters;
begin
  select * into v_encounter from public.encounters where id = p_encounter_id for update;

  if v_encounter.id is null then
    raise exception 'encounter_not_found';
  end if;

  if v_encounter.status = 'signed' then
    raise exception 'encounter_already_signed';
  end if;

  update public.encounters
     set status = 'signed',
         signed_at = now(),
         signed_by = auth.uid()
   where id = p_encounter_id
  returning * into v_encounter;

  return v_encounter;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.encounters enable row level security;
alter table public.tcm_notes enable row level security;

drop policy if exists encounters_staff_all on public.encounters;
create policy encounters_staff_all on public.encounters
  for all using (public.is_clinic_member(clinic_id))
  with check (public.is_clinic_member(clinic_id));

drop policy if exists tcm_notes_staff_all on public.tcm_notes;
create policy tcm_notes_staff_all on public.tcm_notes
  for all using (public.is_clinic_member(clinic_id))
  with check (public.is_clinic_member(clinic_id));
