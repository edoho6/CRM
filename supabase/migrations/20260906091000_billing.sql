-- ============================================================================
-- 10 · Billing, with Grow (Meshulam) as the payment provider
-- ============================================================================
-- Invoices are modelled locally and payment is delegated to Grow. That split
-- matters: the clinic's own record of what was charged must survive regardless
-- of what happens at the provider, and swapping or adding a provider later must
-- not touch the invoice model.
--
-- Grow's flow is: our server asks for a payment process, Grow returns a URL, the
-- patient pays on it, Grow calls our webhook, and we acknowledge with
-- approveTransaction. The columns below carry the identifiers that flow needs.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Provider credentials
-- ---------------------------------------------------------------------------
-- Grow issues a userId and pageCode per business. They are secrets: anyone
-- holding them can open charges against the clinic's account, so only the owner
-- may read this table, and nothing here is ever sent to the browser.

create table if not exists public.clinic_payment_settings (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null unique default public.current_clinic_id()
    references public.clinics(id) on delete cascade,
  provider text not null default 'grow' check (provider in ('grow')),
  environment text not null default 'sandbox' check (environment in ('sandbox', 'production')),
  -- Grow's own identifier for the business. Named *_credential to keep it from
  -- being confused with our own user ids.
  grow_user_id text,
  grow_page_code text,
  -- Only needed for platform/multi-business integrations; unused for a single clinic.
  grow_api_key text,
  -- Grow can issue the tax invoice itself once invoicing is enabled on their side.
  issue_invoice_via_provider boolean not null default true,
  is_active boolean not null default false,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create trigger clinic_payment_settings_set_updated_at
  before update on public.clinic_payment_settings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- invoices
-- ---------------------------------------------------------------------------

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null default public.current_clinic_id() references public.clinics(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete restrict,
  -- An invoice usually follows a visit, but a product sale or a package has no
  -- encounter, so the link is optional in both directions.
  encounter_id uuid references public.encounters(id) on delete set null,
  appointment_id uuid references public.appointments(id) on delete set null,
  -- Sequential per clinic, assigned on insert by the trigger below.
  invoice_number integer not null,
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'paid', 'partially_paid', 'cancelled')),
  currency text not null default 'ILS',
  subtotal numeric(12, 2) not null default 0,
  total numeric(12, 2) not null default 0,
  amount_paid numeric(12, 2) not null default 0,
  issued_at timestamptz,
  due_date date,
  notes text,
  -- Where the patient pays, and the receipt Grow issues afterwards.
  payment_url text,
  provider_invoice_url text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, invoice_number),
  constraint invoices_totals_non_negative check (subtotal >= 0 and total >= 0 and amount_paid >= 0)
);

create index if not exists invoices_patient_idx
  on public.invoices (clinic_id, patient_id, created_at desc);

create index if not exists invoices_status_idx
  on public.invoices (clinic_id, status, created_at desc);

create trigger invoices_set_updated_at
  before update on public.invoices
  for each row execute function public.set_updated_at();

create trigger invoices_audit
  after insert or update or delete on public.invoices
  for each row execute function public.write_audit_log();

-- Per-clinic running number. Computed inside the insert so two invoices created
-- at the same moment cannot take the same number.
create or replace function public.assign_invoice_number()
returns trigger
language plpgsql
as $$
begin
  if new.invoice_number is null or new.invoice_number = 0 then
    select coalesce(max(i.invoice_number), 0) + 1
      into new.invoice_number
    from public.invoices i
    where i.clinic_id = new.clinic_id;
  end if;
  return new;
end;
$$;

create trigger invoices_assign_number
  before insert on public.invoices
  for each row execute function public.assign_invoice_number();

-- ---------------------------------------------------------------------------
-- invoice_items
-- ---------------------------------------------------------------------------
-- `source_table`/`source_id` point back at what was billed — a dispensing record
-- or an appointment — so an invoice line can always be traced to the thing that
-- justified it.

create table if not exists public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null default public.current_clinic_id() references public.clinics(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  description text not null,
  quantity numeric(12, 3) not null default 1 check (quantity > 0),
  unit_price numeric(12, 2) not null default 0,
  line_total numeric(12, 2) not null default 0,
  source_table text,
  source_id uuid,
  sequence integer not null default 0
);

create index if not exists invoice_items_invoice_idx
  on public.invoice_items (invoice_id, sequence);

-- Keep the invoice totals in step with its lines, so no screen has to sum them
-- and no two screens can disagree about what the patient owes.
create or replace function public.recalculate_invoice_totals()
returns trigger
language plpgsql
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
         total = v_subtotal
   where id = v_invoice;

  return coalesce(new, old);
end;
$$;

create trigger invoice_items_recalculate
  after insert or update or delete on public.invoice_items
  for each row execute function public.recalculate_invoice_totals();

-- ---------------------------------------------------------------------------
-- payments
-- ---------------------------------------------------------------------------

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null default public.current_clinic_id() references public.clinics(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  method text not null default 'card'
    check (method in ('card', 'cash', 'bank_transfer', 'bit', 'other')),
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'failed', 'refunded')),
  provider text not null default 'grow' check (provider in ('grow', 'manual')),
  -- Grow's identifiers for the payment attempt. The process id is what the
  -- webhook arrives with, so it is the lookup key and must be unique.
  provider_process_id text,
  provider_process_token text,
  provider_transaction_id text,
  paid_at timestamptz,
  raw_response jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists payments_process_id_idx
  on public.payments (provider_process_id) where provider_process_id is not null;

create index if not exists payments_invoice_idx
  on public.payments (invoice_id, created_at desc);

create trigger payments_set_updated_at
  before update on public.payments
  for each row execute function public.set_updated_at();

-- A settled payment updates what the invoice shows as paid.
create or replace function public.apply_payment_to_invoice()
returns trigger
language plpgsql
as $$
declare
  v_paid numeric(12, 2);
  v_total numeric(12, 2);
begin
  select coalesce(sum(p.amount), 0) into v_paid
  from public.payments p
  where p.invoice_id = new.invoice_id
    and p.status = 'paid';

  select i.total into v_total from public.invoices i where i.id = new.invoice_id;

  update public.invoices
     set amount_paid = v_paid,
         status = case
           when v_paid <= 0 then status
           when v_paid >= v_total then 'paid'
           else 'partially_paid'
         end
   where id = new.invoice_id;

  return new;
end;
$$;

create trigger payments_apply_to_invoice
  after insert or update of status, amount on public.payments
  for each row execute function public.apply_payment_to_invoice();

-- ---------------------------------------------------------------------------
-- settle_grow_payment — the webhook's only way in
-- ---------------------------------------------------------------------------
-- Grow's callback carries no credential we can verify, so this function is the
-- security boundary instead: it accepts only a process id that we ourselves
-- generated and stored, and touches nothing else. SECURITY DEFINER because the
-- webhook has no signed-in user, and it is deliberately the *only* definer-rights
-- write path in the billing module.

create or replace function public.settle_grow_payment(
  p_process_id text,
  p_transaction_id text default null,
  p_status text default 'paid',
  p_raw jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments;
begin
  if p_process_id is null or length(trim(p_process_id)) = 0 then
    raise exception 'process_id_required';
  end if;

  select * into v_payment
  from public.payments
  where provider_process_id = p_process_id
  for update;

  if v_payment.id is null then
    raise exception 'payment_not_found';
  end if;

  -- Grow may retry a callback; settling twice must not double-count.
  if v_payment.status = 'paid' and p_status = 'paid' then
    return v_payment.id;
  end if;

  update public.payments
     set status = case when p_status = 'paid' then 'paid' else 'failed' end,
         provider_transaction_id = coalesce(p_transaction_id, provider_transaction_id),
         paid_at = case when p_status = 'paid' then now() else null end,
         raw_response = coalesce(p_raw, raw_response)
   where id = v_payment.id;

  return v_payment.id;
end;
$$;

comment on function public.settle_grow_payment(text, text, text, jsonb) is
  'Settles a Grow payment from the webhook. Accepts only a process id this system issued, and is idempotent so a retried callback cannot double-count.';

-- ---------------------------------------------------------------------------
-- grow_credentials_for_process — lets the webhook acknowledge the transaction
-- ---------------------------------------------------------------------------
-- Grow requires an approveTransaction call after every callback, but the webhook
-- has no signed-in user and `clinic_payment_settings` is owner-only. Rather than
-- give the webhook broad rights, this returns the credentials for one specific
-- payment: the caller must already hold a process id this system issued, and it
-- learns nothing about any other clinic. The API key is never returned.

create or replace function public.grow_credentials_for_process(p_process_id text)
returns table (environment text, grow_user_id text, grow_page_code text)
language sql
stable
security definer
set search_path = public
as $$
  select s.environment, s.grow_user_id, s.grow_page_code
  from public.payments p
  join public.clinic_payment_settings s on s.clinic_id = p.clinic_id
  where p.provider_process_id = p_process_id
    and s.is_active
  limit 1;
$$;

comment on function public.grow_credentials_for_process(text) is
  'Credentials needed to acknowledge one Grow callback, keyed by a process id this system issued. Never returns the API key.';

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.clinic_payment_settings enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.payments enable row level security;

-- Credentials: owner only, read and write.
drop policy if exists clinic_payment_settings_owner on public.clinic_payment_settings;
create policy clinic_payment_settings_owner on public.clinic_payment_settings
  for all using (public.has_clinic_role(clinic_id, array['owner']))
  with check (public.has_clinic_role(clinic_id, array['owner']));

drop policy if exists invoices_staff_all on public.invoices;
create policy invoices_staff_all on public.invoices
  for all using (public.is_clinic_member(clinic_id))
  with check (public.is_clinic_member(clinic_id));

drop policy if exists invoice_items_staff_all on public.invoice_items;
create policy invoice_items_staff_all on public.invoice_items
  for all using (public.is_clinic_member(clinic_id))
  with check (public.is_clinic_member(clinic_id));

drop policy if exists payments_staff_all on public.payments;
create policy payments_staff_all on public.payments
  for all using (public.is_clinic_member(clinic_id))
  with check (public.is_clinic_member(clinic_id));

-- Patients may see their own invoices in the portal, but never the payment rows
-- or the clinic's provider credentials.
drop policy if exists invoices_portal_self on public.invoices;
create policy invoices_portal_self on public.invoices
  for select using (patient_id = public.current_patient_id());

drop policy if exists invoice_items_portal_self on public.invoice_items;
create policy invoice_items_portal_self on public.invoice_items
  for select using (
    exists (
      select 1 from public.invoices i
      where i.id = invoice_items.invoice_id
        and i.patient_id = public.current_patient_id()
    )
  );
