-- ============================================================================
-- 27 · Signatures, treatment packages, and treatment confirmations
-- ============================================================================
-- Three things a clinic in Israel needs and this system could not do.
--
-- 1 · A signature. Consent already records the document version, the method and
--     the timestamp, which is most of what makes it defensible — but not the
--     mark the patient actually made.
--
-- 2 · A punch card. "Ten treatments for ₪3,000" is how a large share of Israeli
--     practices sell, and there was nowhere to put it: every visit was billed
--     as if it were the first.
--
-- 3 · A treatment confirmation. To claim on their supplementary health-fund
--     insurance, a patient needs a document naming the practitioner and their
--     qualification, and — for a course of treatment — the dates actually
--     given. No international product issues that, because the requirement is
--     local. It is deliberately *not* a receipt: tax documents come from a
--     licensed provider, and this one says so on its face.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- The practitioner's own identity
-- ---------------------------------------------------------------------------
-- The confirmation is a personal attestation — "I, so-and-so, ID such-and-such,
-- confirm that I treated…" — so it needs the practitioner's national ID beside
-- the qualification columns that have been here since the first milestone and
-- never had a screen.

alter table public.profiles
  add column if not exists national_id text;

comment on column public.profiles.national_id is
  'The practitioner''s own ID number, printed on a treatment confirmation. Their data, not a patient''s, and entered only by them.';

-- ---------------------------------------------------------------------------
-- Signatures
-- ---------------------------------------------------------------------------
-- Its own table rather than a column on the thing signed, for one concrete
-- reason: `write_audit_log` stores `to_jsonb(new)` on insert, so a base64 image
-- inside `patient_consents` would be copied whole into the audit log, doubling
-- the storage and burying the readable diff. Nothing here carries an audit
-- trigger — the row this points at is already audited, and the signature cannot
-- change.

create table if not exists public.signatures (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null default public.current_clinic_id() references public.clinics(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,

  -- Exactly one of these. A polymorphic `subject_id` could not be a foreign key
  -- at all, and a signature pointing at a row that no longer exists is not
  -- evidence of anything.
  consent_id uuid references public.patient_consents(id) on delete cascade,
  form_submission_id uuid references public.form_submissions(id) on delete cascade,

  /**
   * How the person signed.
   *
   * `typed` is not a lesser signature, it is the accessible one: drawing with a
   * finger is impossible for some people and awkward for many, so confirming by
   * typing your own name is offered as an equal route. Which was used is
   * recorded because they are different evidence, not because one is worth less.
   */
  method text not null check (method in ('drawn', 'typed')),

  /** A PNG data URL for `drawn`, the typed name for `typed`. */
  content text not null,

  signed_at timestamptz not null default now(),
  /** Set when a member of staff witnessed it; null when signed in the portal. */
  witnessed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),

  constraint signatures_one_subject check (
    (consent_id is not null and form_submission_id is null)
    or (consent_id is null and form_submission_id is not null)
  ),
  constraint signatures_content_not_blank check (length(btrim(content)) > 0),
  -- A drawn signature is a small PNG. The cap is a brake on a runaway canvas,
  -- not a design constraint: 256 kB is far more than a signature needs.
  constraint signatures_content_bounded check (length(content) <= 262144)
);

create index if not exists signatures_consent_idx on public.signatures (consent_id);
create index if not exists signatures_submission_idx on public.signatures (form_submission_id);
create index if not exists signatures_patient_idx on public.signatures (clinic_id, patient_id);

-- Append-only, on the same reasoning as the consents themselves, and with the
-- same exception for erasing a patient's file.
create or replace function public.block_signature_mutation()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE'
     and not exists (select 1 from public.patients p where p.id = old.patient_id) then
    return old;
  end if;

  raise exception 'signatures_are_append_only';
end;
$$;

drop trigger if exists signatures_no_update on public.signatures;
create trigger signatures_no_update
  before update or delete on public.signatures
  for each row execute function public.block_signature_mutation();

alter table public.signatures enable row level security;

drop policy if exists signatures_staff_read on public.signatures;
create policy signatures_staff_read on public.signatures
  for select using (public.is_clinic_member(clinic_id));

drop policy if exists signatures_staff_insert on public.signatures;
create policy signatures_staff_insert on public.signatures
  for insert with check (public.is_clinic_member(clinic_id));

-- A patient signs their own consent in the portal, and may see what they signed.
drop policy if exists signatures_patient_read on public.signatures;
create policy signatures_patient_read on public.signatures
  for select using (patient_id = public.current_patient_id());

drop policy if exists signatures_patient_insert on public.signatures;
create policy signatures_patient_insert on public.signatures
  for insert with check (patient_id = public.current_patient_id());

comment on table public.signatures is
  'One signature, against a consent decision or a filled-in form. Append-only. Drawn or typed — the typed route is the accessible one and is equal evidence.';

-- ---------------------------------------------------------------------------
-- Treatment packages
-- ---------------------------------------------------------------------------

create table if not exists public.patient_packages (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null default public.current_clinic_id() references public.clinics(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,

  name text not null,
  total_sessions integer not null check (total_sessions > 0 and total_sessions <= 200),
  price numeric(10, 2) check (price is null or price >= 0),

  purchased_on date not null default current_date,
  -- Null means it does not expire, which is the common case and should not be
  -- expressed as a date far in the future.
  expires_on date,

  -- The invoice the package was sold on, when there is one. Optional in both
  -- directions: a package can be recorded before it is billed.
  invoice_id uuid references public.invoices(id) on delete set null,

  notes text,
  is_active boolean not null default true,

  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint patient_packages_name_not_blank check (length(btrim(name)) > 0),
  constraint patient_packages_expiry_after_purchase
    check (expires_on is null or expires_on >= purchased_on)
);

create index if not exists patient_packages_patient_idx
  on public.patient_packages (clinic_id, patient_id, purchased_on desc);

drop trigger if exists patient_packages_set_updated_at on public.patient_packages;
create trigger patient_packages_set_updated_at
  before update on public.patient_packages
  for each row execute function public.set_updated_at();

drop trigger if exists patient_packages_audit on public.patient_packages;
create trigger patient_packages_audit
  after insert or update or delete on public.patient_packages
  for each row execute function public.write_audit_log();

/**
 * One session drawn off a package.
 *
 * `encounter_id` is optional on purpose. A treatment recorded before the package
 * was set up still has to be redeemable against it, and a practice that charges
 * a late cancellation to the card has a redemption with no treatment behind it.
 * Requiring the link would force one of those to be recorded as a lie.
 */
create table if not exists public.package_redemptions (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null default public.current_clinic_id() references public.clinics(id) on delete cascade,
  package_id uuid not null references public.patient_packages(id) on delete cascade,
  encounter_id uuid references public.encounters(id) on delete set null,
  redeemed_on date not null default current_date,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists package_redemptions_package_idx
  on public.package_redemptions (package_id, redeemed_on);

-- One treatment cannot be drawn off the same card twice. A partial index,
-- because several redemptions may legitimately have no encounter at all.
create unique index if not exists package_redemptions_one_per_encounter
  on public.package_redemptions (package_id, encounter_id)
  where encounter_id is not null;

/**
 * The card cannot go below zero.
 *
 * In the database rather than in the button, because the button is not where
 * this can be got wrong: two tabs open on the same patient, or a redemption
 * recorded from the treatment page while the packages panel is also open, and a
 * client-side count is already stale. `for update` locks the package row so two
 * concurrent redemptions cannot both read the same remaining balance.
 */
create or replace function public.enforce_package_balance()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_total integer;
  v_used integer;
begin
  select total_sessions into v_total
  from public.patient_packages
  where id = new.package_id
  for update;

  if v_total is null then
    raise exception 'package_not_found';
  end if;

  select count(*) into v_used
  from public.package_redemptions
  where package_id = new.package_id;

  if v_used >= v_total then
    raise exception 'package_exhausted'
      using hint = 'This package has no sessions left. Sell another one rather than overdrawing this.';
  end if;

  return new;
end;
$$;

drop trigger if exists package_redemptions_balance on public.package_redemptions;
create trigger package_redemptions_balance
  before insert on public.package_redemptions
  for each row execute function public.enforce_package_balance();

drop trigger if exists package_redemptions_audit on public.package_redemptions;
create trigger package_redemptions_audit
  after insert or update or delete on public.package_redemptions
  for each row execute function public.write_audit_log();

alter table public.patient_packages enable row level security;
alter table public.package_redemptions enable row level security;

drop policy if exists patient_packages_staff_all on public.patient_packages;
create policy patient_packages_staff_all on public.patient_packages
  for all using (public.is_clinic_member(clinic_id))
  with check (public.is_clinic_member(clinic_id));

drop policy if exists package_redemptions_staff_all on public.package_redemptions;
create policy package_redemptions_staff_all on public.package_redemptions
  for all using (public.is_clinic_member(clinic_id))
  with check (public.is_clinic_member(clinic_id));

-- A patient may see what they bought and what is left of it. Read only: how many
-- sessions remain is not a thing the holder of the card gets to adjust.
drop policy if exists patient_packages_patient_read on public.patient_packages;
create policy patient_packages_patient_read on public.patient_packages
  for select using (patient_id = public.current_patient_id());

drop policy if exists package_redemptions_patient_read on public.package_redemptions;
create policy package_redemptions_patient_read on public.package_redemptions
  for select using (
    exists (
      select 1 from public.patient_packages p
      where p.id = package_redemptions.package_id
        and p.patient_id = public.current_patient_id()
    )
  );

/** Balance per card, so no screen has to count redemptions itself. */
create or replace view public.package_balances
with (security_invoker = on) as
select
  p.id as package_id,
  p.clinic_id,
  p.patient_id,
  p.name,
  p.total_sessions,
  p.price,
  p.purchased_on,
  p.expires_on,
  p.is_active,
  count(r.id)::integer as used_sessions,
  (p.total_sessions - count(r.id))::integer as remaining_sessions,
  max(r.redeemed_on) as last_redeemed_on,
  (p.expires_on is not null and p.expires_on < current_date) as is_expired
from public.patient_packages p
left join public.package_redemptions r on r.package_id = p.id
group by p.id;

comment on view public.package_balances is
  'One row per package with sessions used and left. security_invoker, so it inherits the caller''s policies rather than the creator''s.';

-- ---------------------------------------------------------------------------
-- Treatment confirmations
-- ---------------------------------------------------------------------------
-- What was attested, to whom, over which dates, and when. A statement made to a
-- third party about a patient's care is exactly the kind of thing that should
-- leave a record — both so it can be reissued identically, and so "what did I
-- confirm to the health fund in March" has an answer.

create table if not exists public.treatment_confirmations (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null default public.current_clinic_id() references public.clinics(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  practitioner_id uuid not null references public.profiles(id) on delete restrict,

  /**
   * The dates, as they were printed.
   *
   * Stored rather than recomputed from the encounters, and that is the point: a
   * confirmation is a statement made on a day, and it has to keep saying what it
   * said even after a record is corrected or a visit is deleted. It may also
   * include dates typed by hand, for treatment given before this system existed.
   */
  treatment_dates date[] not null check (
    array_length(treatment_dates, 1) between 1 and 200
  ),

  /** The practitioner's details as printed, frozen for the same reason. */
  practitioner_name text not null,
  practitioner_national_id text,
  practitioner_title text,
  practitioner_license text,
  /** The patient's, likewise. */
  patient_name text not null,
  patient_national_id text,

  purpose text,
  notes text,
  issued_at timestamptz not null default now(),
  issued_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),

  constraint treatment_confirmations_names_not_blank
    check (length(btrim(practitioner_name)) > 0 and length(btrim(patient_name)) > 0)
);

create index if not exists treatment_confirmations_patient_idx
  on public.treatment_confirmations (clinic_id, patient_id, issued_at desc);

drop trigger if exists treatment_confirmations_audit on public.treatment_confirmations;
create trigger treatment_confirmations_audit
  after insert or update or delete on public.treatment_confirmations
  for each row execute function public.write_audit_log();

alter table public.treatment_confirmations enable row level security;

drop policy if exists treatment_confirmations_staff_all on public.treatment_confirmations;
create policy treatment_confirmations_staff_all on public.treatment_confirmations
  for all using (public.is_clinic_member(clinic_id))
  with check (public.is_clinic_member(clinic_id));

drop policy if exists treatment_confirmations_patient_read on public.treatment_confirmations;
create policy treatment_confirmations_patient_read on public.treatment_confirmations
  for select using (patient_id = public.current_patient_id());

comment on table public.treatment_confirmations is
  'A practitioner''s attestation that they treated a patient on given dates, for a health-fund claim. Not a receipt and not a tax document — those come from a licensed provider.';
