-- ============================================================================
-- One invoice per treatment, one payment per Grow transaction
-- ============================================================================
-- Two clicks on "create invoice" at the same moment each found no invoice for
-- the treatment and each made one; from then on the screen's lookup failed on
-- two rows and made another every time it opened. And nothing stopped one Grow
-- transaction from settling two payments.
--
-- Both become unique indexes. They are in a file of their own, apart from the
-- security fixes, because creating them fails if the data already breaks the
-- rule — and that must not hold the security fixes back.
--
-- If the data already breaks it, this file stops, lists the rows, and changes
-- nothing. It never picks which invoice to keep: cancelling the extra one
-- (billing → the invoice → cancel) is a decision about money a person makes.
-- Then run this file again.
-- ============================================================================

do $$
declare
  v_invoices text;
  v_payments text;
begin
  select string_agg(pg_catalog.format('treatment %s: invoice numbers %s', d.encounter_id, d.numbers), '; ')
    into v_invoices
    from (
      select i.encounter_id, string_agg(i.invoice_number::text, ', ' order by i.invoice_number) as numbers
        from public.invoices i
       where i.encounter_id is not null and i.status <> 'cancelled'
       group by i.encounter_id
      having count(*) > 1
    ) d;

  select string_agg(pg_catalog.format('Grow transaction %s: payments %s', d.provider_transaction_id, d.ids), '; ')
    into v_payments
    from (
      select p.provider_transaction_id, string_agg(p.id::text, ', ') as ids
        from public.payments p
       where p.provider = 'grow' and p.provider_transaction_id is not null
       group by p.provider_transaction_id
      having count(*) > 1
    ) d;

  if v_invoices is not null or v_payments is not null then
    raise exception 'duplicates_found: % %', coalesce(v_invoices, ''), coalesce(v_payments, '')
      using hint = 'Cancel all but one invoice per listed treatment (and look at the listed payments), then run this file again. Nothing was changed.';
  end if;
end;
$$;

create unique index if not exists invoices_one_per_encounter_idx
  on public.invoices (encounter_id)
  where encounter_id is not null and status <> 'cancelled';

create unique index if not exists payments_grow_transaction_idx
  on public.payments (provider_transaction_id)
  where provider = 'grow' and provider_transaction_id is not null;

comment on index public.invoices_one_per_encounter_idx is
  'A treatment has at most one invoice that is not cancelled; features/billing/actions.ts reads the existing one when the insert collides.';
