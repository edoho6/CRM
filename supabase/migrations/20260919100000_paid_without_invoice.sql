-- ---------------------------------------------------------------------------
-- Paid without an invoice
-- ---------------------------------------------------------------------------
-- A visit paid in cash, by Bit or by a bank transfer, with no invoice raised
-- through the payment provider, had no way to say so: "paid" existed only as
-- an invoice's status. Now the booking itself carries it — when, how, and who
-- marked it — and the two views every screen reads count it.
--
-- On the appointment, not in a table of its own: it is one fact about one
-- visit, the appointment is already the row the diary, the list and the
-- patient's file read, and its audit trigger (appointments_audit) records the
-- change and who made it like any other edit. The appointment's existing
-- policies decide who may write it; the screens offer it only to a role that
-- sees money.
--
-- The method is optional — "paid" is the fact, how is a detail — and is five
-- words, not free text, so a report can count them.

alter table public.appointments
  add column if not exists paid_at timestamptz,
  add column if not exists paid_method text,
  add column if not exists paid_by uuid references auth.users(id) on delete set null;

alter table public.appointments drop constraint if exists appointments_paid_method_check;
alter table public.appointments
  add constraint appointments_paid_method_check
  check (paid_method is null or paid_method in ('cash', 'card', 'bank_transfer', 'bit', 'paybox'));

-- A method without the payment is a half-written fact.
alter table public.appointments drop constraint if exists appointments_paid_method_needs_paid_check;
alter table public.appointments
  add constraint appointments_paid_method_needs_paid_check
  check (paid_at is not null or paid_method is null);

comment on column public.appointments.paid_at is
  'Marked paid by hand, without (or regardless of) an invoice. Null = not marked.';
comment on column public.appointments.paid_method is
  'cash | card | bank_transfer | bit | paybox, or null when not said.';

-- ---------------------------------------------------------------------------
-- The two views: a hand mark counts as paid
-- ---------------------------------------------------------------------------
-- Columns are only appended (create or replace view allows nothing else), and
-- the hand mark wins over an invoice's state: someone who took the cash and
-- said so knows more than an invoice still waiting at the provider.

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
    when a.paid_at is not null then 'paid'
    when i.id is null then 'unbilled'
    when i.status = 'cancelled' then 'cancelled'
    when i.status = 'paid' then 'paid'
    when i.status = 'partially_paid' then 'partially_paid'
    else 'unpaid'
  end as payment_state,
  a.paid_at,
  a.paid_method
from public.appointments a
left join lateral (
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
  case
    when ap.paid_at is not null then 'paid'
    when i.id is null then 'unbilled'
    when i.status = 'cancelled' then 'cancelled'
    when i.status = 'paid' then 'paid'
    when i.status = 'partially_paid' then 'partially_paid'
    else 'unpaid'
  end as payment_state,
  ap.paid_at,
  ap.paid_method
from public.encounters e
left join public.appointments ap on ap.id = e.appointment_id
left join lateral (
  select inv.*
  from public.invoices inv
  where inv.encounter_id = e.id
    and inv.status <> 'cancelled'
  order by inv.created_at desc
  limit 1
) i on true;
