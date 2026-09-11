-- ============================================================================
-- 38 · A home page of one's own, and reopening a signed treatment record
-- ============================================================================
-- Two small things a practitioner asked for on the same day.
--
-- home_path: where the clinic's name at the top of the menu leads. A choice
-- of the person, kept on their profile so it follows them between devices.
--
-- reopen_encounter: a signed record could not be edited at all. The lock was
-- right — a clinical record that can be quietly rewritten after the fact is
-- worth nothing as a record — but "never" was the wrong word. Records do get
-- corrected. What the law and good practice ask is that a correction be
-- visible: who reopened, when, why, and that the earlier signature is not
-- erased. So: the signature is copied into encounter_signatures, which is
-- append-only and nobody can edit; the record goes back to draft with the
-- reason on file; and it has to be signed again. The audit log records
-- every field change in between, as it always did.
-- ============================================================================

alter table public.profiles
  add column if not exists home_path text not null default '/';

alter table public.profiles
  drop constraint if exists profiles_home_path_check;
alter table public.profiles
  add constraint profiles_home_path_check
  check (home_path in ('/', '/calendar', '/patients', '/tasks', '/encounters'));

comment on column public.profiles.home_path is
  'Where the clinic name at the top of the menu leads. The person''s own choice.';

-- ---------------------------------------------------------------------------
-- encounter_signatures — every signature a record has carried, kept for good
-- ---------------------------------------------------------------------------

create table if not exists public.encounter_signatures (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  encounter_id uuid not null references public.encounters(id) on delete cascade,
  signed_at timestamptz not null,
  signed_by uuid references auth.users(id) on delete set null,
  reopened_at timestamptz not null default now(),
  reopened_by uuid references auth.users(id) on delete set null,
  reason text not null,
  constraint encounter_signatures_reason_not_blank check (length(btrim(reason)) > 0)
);

comment on table public.encounter_signatures is
  'A signature a treatment record carried before it was reopened for editing: who signed, who reopened, when, and why. Append-only; written only by reopen_encounter.';

create index if not exists encounter_signatures_encounter_idx
  on public.encounter_signatures (encounter_id, reopened_at desc);

alter table public.encounter_signatures enable row level security;

drop policy if exists encounter_signatures_select on public.encounter_signatures;
create policy encounter_signatures_select on public.encounter_signatures
  for select using (public.is_clinic_member(clinic_id));
-- No insert, update or delete policy on purpose: the only way in is the
-- function below, and there is no way to change or remove a row afterwards.

-- ---------------------------------------------------------------------------
-- The lock on a signed record now has one door
-- ---------------------------------------------------------------------------
-- reopen_encounter announces itself through a transaction-local setting that
-- names the record; the trigger lets that one update through and refuses
-- every other, exactly as before.

create or replace function public.prevent_signed_encounter_edit()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'signed'
     and coalesce(current_setting('herbalist.reopening', true), '') <> old.id::text then
    raise exception 'encounter_locked'
      using hint = 'This treatment record has been signed. Reopen it, with a reason, to edit it.';
  end if;
  return new;
end;
$$;

create or replace function public.reopen_encounter(p_encounter_id uuid, p_reason text)
returns public.encounters
language plpgsql
security definer
set search_path = public
as $$
declare
  v_encounter public.encounters;
begin
  if auth.uid() is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'reason_required' using errcode = '22023';
  end if;

  select * into v_encounter from public.encounters where id = p_encounter_id for update;
  if v_encounter.id is null then
    raise exception 'encounter_not_found' using errcode = 'P0002';
  end if;
  -- Someone in the record's own clinic — and either the person who signed it
  -- or an owner. A colleague cannot reopen another practitioner's signature.
  if not public.is_clinic_member(v_encounter.clinic_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_encounter.signed_by is distinct from auth.uid()
     and not public.has_clinic_role(v_encounter.clinic_id, array['owner']) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_encounter.status <> 'signed' then
    raise exception 'encounter_not_signed' using errcode = '22023';
  end if;

  insert into public.encounter_signatures (clinic_id, encounter_id, signed_at, signed_by, reopened_by, reason)
  values (v_encounter.clinic_id, v_encounter.id, v_encounter.signed_at, v_encounter.signed_by, auth.uid(), btrim(p_reason));

  perform set_config('herbalist.reopening', v_encounter.id::text, true);
  update public.encounters
     set status = 'draft',
         signed_at = null,
         signed_by = null
   where id = v_encounter.id
  returning * into v_encounter;
  perform set_config('herbalist.reopening', '', true);

  return v_encounter;
end;
$$;

comment on function public.reopen_encounter(uuid, text) is
  'Reopens a signed treatment record for editing. Keeps the signature in encounter_signatures with the reason; the record must be signed again.';

revoke all on function public.reopen_encounter(uuid, text) from public;
revoke execute on function public.reopen_encounter(uuid, text) from anon;
grant execute on function public.reopen_encounter(uuid, text) to authenticated;
