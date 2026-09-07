-- ============================================================================
-- 22 · More than one payment provider
-- ============================================================================
-- The settings table was written around Grow, with Grow's own fields as columns.
-- Two more providers are wanted — SUMIT and EasyCount — and each has its own
-- idea of what a credential is.
--
-- Adding `sumit_api_key`, `sumit_company_id`, `easycount_api_key` and so on as
-- columns would mean a migration for every provider ever added, and a table
-- where nine of twelve columns are null for any given clinic. So credentials
-- move into one jsonb blob keyed by provider, and the columns that exist stay
-- where they are so nothing already configured breaks.
--
-- What deliberately does NOT move: card numbers. None of these providers needs
-- them and this system must never see one. Every provider here works the same
-- way — we ask for a payment page, the patient pays on the provider's own
-- domain, and a webhook tells us what happened. That is the whole reason a
-- provider is involved at all.
-- ============================================================================

alter table public.clinic_payment_settings
  drop constraint if exists clinic_payment_settings_provider_check;

alter table public.clinic_payment_settings
  add constraint clinic_payment_settings_provider_check
  check (provider in ('grow', 'sumit', 'easycount'));

/*
 * Per-provider credentials, so a practitioner can configure one, try another,
 * and switch back without losing what they typed.
 *
 * Shape: { "grow": { ... }, "sumit": { ... }, "easycount": { ... } }
 *
 * These are secrets. They are readable only through RLS by a member of the
 * clinic, they are never sent to the browser (every provider call happens in a
 * Server Action), and they are never written to a log. The alternative — env
 * vars — cannot work here, because the credentials belong to the clinic rather
 * than to the deployment, and a multi-clinic install has one set per tenant.
 */
alter table public.clinic_payment_settings
  add column if not exists credentials jsonb not null default '{}'::jsonb;

comment on column public.clinic_payment_settings.credentials is
  'Per-provider secrets, keyed by provider id. Never leaves the server. Read only by clinic members through RLS.';

-- The existing Grow columns are folded into the blob so there is one place to
-- read from, and left in place so nothing that still reads them breaks.
update public.clinic_payment_settings
   set credentials = jsonb_strip_nulls(
     credentials || jsonb_build_object(
       'grow', jsonb_strip_nulls(jsonb_build_object(
         'user_id', grow_user_id,
         'page_code', grow_page_code,
         'api_key', grow_api_key
       ))
     )
   )
 where coalesce(grow_user_id, grow_page_code, grow_api_key) is not null
   and not (credentials ? 'grow');

-- ---------------------------------------------------------------------------
-- What a payment is against
-- ---------------------------------------------------------------------------
-- An invoice already points at an encounter and an appointment. What was
-- missing is the reverse question, which is the one the screens actually ask:
-- "has this treatment been paid for?" A view answers it in one place rather
-- than each screen inventing its own join.

create or replace view public.encounter_payment_status
with (security_invoker = on)
as
select
  e.id as encounter_id,
  e.clinic_id,
  e.patient_id,
  e.appointment_id,
  i.id as invoice_id,
  i.invoice_number,
  i.status as invoice_status,
  i.total,
  i.amount_paid,
  i.payment_url,
  -- One word for the screens. `partially_paid` is deliberately not collapsed
  -- into "paid": a part payment is not a payment, and a badge that says it is
  -- would be the kind of error nobody catches until the year end.
  case
    when i.id is null then 'unbilled'
    when i.status = 'cancelled' then 'cancelled'
    when i.status = 'paid' then 'paid'
    when i.status = 'partially_paid' then 'partially_paid'
    else 'unpaid'
  end as payment_state
from public.encounters e
left join lateral (
  select inv.*
  from public.invoices inv
  where inv.encounter_id = e.id
    and inv.status <> 'cancelled'
  order by inv.created_at desc
  limit 1
) i on true;

comment on view public.encounter_payment_status is
  'Whether a treatment has been billed and paid, in one word, so every screen asks the question the same way.';

create or replace view public.appointment_payment_status
with (security_invoker = on)
as
select
  a.id as appointment_id,
  a.clinic_id,
  a.patient_id,
  i.id as invoice_id,
  i.invoice_number,
  i.status as invoice_status,
  i.total,
  i.amount_paid,
  i.payment_url,
  case
    when i.id is null then 'unbilled'
    when i.status = 'cancelled' then 'cancelled'
    when i.status = 'paid' then 'paid'
    when i.status = 'partially_paid' then 'partially_paid'
    else 'unpaid'
  end as payment_state
from public.appointments a
left join lateral (
  -- Either billed directly, or billed through the treatment that came out of
  -- the appointment — both mean the visit has been paid for.
  select inv.*
  from public.invoices inv
  where inv.status <> 'cancelled'
    and (
      inv.appointment_id = a.id
      or inv.encounter_id in (select e.id from public.encounters e where e.appointment_id = a.id)
    )
  order by inv.created_at desc
  limit 1
) i on true;

comment on view public.appointment_payment_status is
  'The same question for a booking, counting an invoice raised against the treatment it produced.';
