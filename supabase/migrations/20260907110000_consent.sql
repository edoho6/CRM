-- ============================================================================
-- 17 · Consent, with the document it was given to
-- ============================================================================
-- A checkbox is not consent. What makes a record defensible two years later is
-- knowing *which text* the patient agreed to and *when* — so the document is a
-- row with a version, and the consent points at that row rather than at a
-- concept.
--
-- Consents are append-only. Withdrawing is a new row saying `granted = false`,
-- not an update to the old one, because "she consented in March and withdrew in
-- September" is the fact worth keeping, and an update destroys it.
--
-- Marketing is a separate kind from the outset. Bundling it with terms of use
-- is the thing that makes a consent unfree, and separating it later means
-- re-collecting everything.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- consent_documents — the texts, versioned
-- ---------------------------------------------------------------------------

create table if not exists public.consent_documents (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null default public.current_clinic_id() references public.clinics(id) on delete cascade,
  kind text not null check (kind in ('terms', 'privacy', 'treatment', 'marketing')),
  -- Monotonic per kind. The number is what a consent record cites.
  version integer not null check (version > 0),
  locale text not null default 'he' check (locale in ('he', 'en')),
  title text not null,
  body text not null,
  -- Null until published. An unpublished draft can be edited; a published one
  -- never is — you publish a new version instead, which is what makes the
  -- version number mean something.
  published_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, kind, version, locale)
);

create index if not exists consent_documents_current_idx
  on public.consent_documents (clinic_id, kind, locale, version desc)
  where published_at is not null;

drop trigger if exists consent_documents_set_updated_at on public.consent_documents;
create trigger consent_documents_set_updated_at
  before update on public.consent_documents
  for each row execute function public.set_updated_at();

-- A published document is frozen. Editing the text a patient agreed to would
-- make every consent that cites it a lie, so the database refuses.
create or replace function public.freeze_published_consent_document()
returns trigger
language plpgsql
as $$
begin
  if old.published_at is not null
     and (new.body is distinct from old.body
          or new.title is distinct from old.title
          or new.version is distinct from old.version
          or new.kind is distinct from old.kind) then
    raise exception 'published_consent_document_is_immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists consent_documents_freeze on public.consent_documents;
create trigger consent_documents_freeze
  before update on public.consent_documents
  for each row execute function public.freeze_published_consent_document();

drop trigger if exists consent_documents_audit on public.consent_documents;
create trigger consent_documents_audit
  after insert or update or delete on public.consent_documents
  for each row execute function public.write_audit_log();

alter table public.consent_documents enable row level security;

drop policy if exists consent_documents_staff_all on public.consent_documents;
create policy consent_documents_staff_all on public.consent_documents
  for all using (public.is_clinic_member(clinic_id))
  with check (public.is_clinic_member(clinic_id));

-- A patient must be able to read the document they are being asked to accept,
-- and the one they accepted before.
drop policy if exists consent_documents_patient_read on public.consent_documents;
create policy consent_documents_patient_read on public.consent_documents
  for select using (
    published_at is not null
    and exists (
      select 1 from public.patient_portal_access a
      where a.user_id = auth.uid() and a.clinic_id = consent_documents.clinic_id and a.is_active
    )
  );

-- ---------------------------------------------------------------------------
-- patient_consents — append-only decisions
-- ---------------------------------------------------------------------------

create table if not exists public.patient_consents (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null default public.current_clinic_id() references public.clinics(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  -- The document is what makes this defensible. It may be null only for a
  -- withdrawal of a consent given before the clinic used versioned documents.
  document_id uuid references public.consent_documents(id) on delete restrict,
  kind text not null check (kind in ('terms', 'privacy', 'treatment', 'marketing')),
  granted boolean not null,
  -- How the decision reached us. A signature on paper and a click in the portal
  -- are both valid and are not the same evidence.
  method text not null default 'in_person'
    check (method in ('in_person', 'portal', 'paper_form', 'phone', 'email')),
  decided_at timestamptz not null default now(),
  notes text,
  recorded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists patient_consents_current_idx
  on public.patient_consents (clinic_id, patient_id, kind, decided_at desc);

drop trigger if exists patient_consents_audit on public.patient_consents;
create trigger patient_consents_audit
  after insert or update or delete on public.patient_consents
  for each row execute function public.write_audit_log();

-- Append-only in the strong sense: the row cannot be edited or removed, so a
-- withdrawal has to be recorded as its own decision.
--
-- With one exception, and it matters: erasing a patient's file must not be
-- blocked by that file's own consent history. Postgres deletes the parent row
-- before running the cascade, so an already-absent patient tells us this delete
-- is part of erasing the file rather than someone quietly editing history. The
-- deletion of the patient is itself written to the audit log, so the erasure
-- leaves a trace even though the consents do not.
create or replace function public.block_consent_mutation()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE'
     and not exists (select 1 from public.patients p where p.id = old.patient_id) then
    return old;
  end if;

  raise exception 'patient_consents_is_append_only';
end;
$$;

drop trigger if exists patient_consents_no_update on public.patient_consents;
create trigger patient_consents_no_update
  before update or delete on public.patient_consents
  for each row execute function public.block_consent_mutation();

alter table public.patient_consents enable row level security;

drop policy if exists patient_consents_staff_read on public.patient_consents;
create policy patient_consents_staff_read on public.patient_consents
  for select using (public.is_clinic_member(clinic_id));

drop policy if exists patient_consents_staff_insert on public.patient_consents;
create policy patient_consents_staff_insert on public.patient_consents
  for insert with check (public.is_clinic_member(clinic_id));

-- A patient may read their own decisions, and may record one — which is what
-- makes "withdraw at any time" real rather than a promise to email someone.
drop policy if exists patient_consents_patient_read on public.patient_consents;
create policy patient_consents_patient_read on public.patient_consents
  for select using (patient_id = public.current_patient_id());

drop policy if exists patient_consents_patient_insert on public.patient_consents;
create policy patient_consents_patient_insert on public.patient_consents
  for insert with check (patient_id = public.current_patient_id() and method = 'portal');

-- ---------------------------------------------------------------------------
-- patient_consent_status — the latest decision per kind
-- ---------------------------------------------------------------------------
-- The history is the record; this is the answer to "may I send this person a
-- newsletter today", which is the question actually asked.

create or replace view public.patient_consent_status
with (security_invoker = on)
as
select distinct on (c.patient_id, c.kind)
  c.patient_id,
  c.clinic_id,
  c.kind,
  c.granted,
  c.decided_at,
  c.method,
  c.document_id,
  d.version as document_version,
  d.title as document_title
from public.patient_consents c
left join public.consent_documents d on d.id = c.document_id
order by c.patient_id, c.kind, c.decided_at desc, c.created_at desc;

comment on view public.patient_consent_status is
  'The standing answer per patient and kind: the most recent decision, with the version of the document it cites.';

-- ---------------------------------------------------------------------------
-- publish_consent_document — allocate the next version and freeze it
-- ---------------------------------------------------------------------------
-- Version numbering belongs in the database. Two people publishing at once from
-- the application would otherwise both read "the current version is 3" and both
-- write 4.

create or replace function public.publish_consent_document(
  p_kind text,
  p_locale text,
  p_title text,
  p_body text
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_clinic uuid := public.current_clinic_id();
  v_version integer;
  v_id uuid;
begin
  if v_clinic is null then
    raise exception 'no_clinic';
  end if;

  select coalesce(max(version), 0) + 1 into v_version
  from public.consent_documents
  where clinic_id = v_clinic and kind = p_kind and locale = p_locale;

  insert into public.consent_documents (
    clinic_id, kind, version, locale, title, body, published_at, created_by
  )
  values (v_clinic, p_kind, v_version, p_locale, p_title, p_body, now(), auth.uid())
  returning id into v_id;

  return v_id;
end;
$$;

comment on function public.publish_consent_document is
  'Publishes the next version of a consent document. Versioning is allocated here so two concurrent publishes cannot collide on a number.';
