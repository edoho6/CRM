import { notFound } from 'next/navigation';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import type { InvoiceWithDetails } from '@clinic/db/types';
import { getClinicScope } from '@/lib/session';
import { logRecordAccess } from '@/lib/access-log';
import { PrintButton } from '@/features/documents/print-button';
import { formatDate } from '@clinic/i18n';

/**
 * An invoice on paper.
 *
 * Until now the money could be recorded and collected but never handed over: a
 * practitioner could raise an invoice on screen and had nothing to give the
 * patient, which is the point at which a clinic management system stops being
 * able to run a clinic.
 *
 * **This is not a tax invoice, and it says so on itself.** An Israeli tax
 * invoice comes out of a certified bookkeeping system and, above the threshold,
 * carries an allocation number from the Tax Authority; this application is
 * neither and has neither. What it prints is the demand — what was given, for
 * how much, what has been paid and what is left — which is the document a
 * patient actually asks for at the end of a treatment, alongside the receipt
 * the practitioner issues separately. The footer is not boilerplate: a page
 * listing a clinic, a patient and a sum looks enough like a receipt that
 * somebody will eventually try to file it as one.
 *
 * The heading changes with the state, because the same page answers two
 * different questions: an unpaid invoice is a request, a settled one is a
 * statement of what was paid.
 *
 * Every figure comes from the invoice's own rows — the lines as they were
 * written, the payments as they were taken — and nothing is recomputed from
 * today's prices. Reprinting March's invoice must produce March's invoice.
 */
export default async function InvoicePrintPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('billing.document');
  const tBilling = await getTranslations('billing');
  const tMethods = await getTranslations('billing.payment.methods');
  const format = await getFormatter();

  const scope = await getClinicScope();
  if (!scope) return null;

  const { data: invoice } = await scope.supabase
    .from('invoices')
    .select(
      '*, items:invoice_items(*), payments:payments(*), patient:patients(id, full_name, phone, email)',
    )
    .eq('id', id)
    .maybeSingle<InvoiceWithDetails>();

  if (!invoice) notFound();

  // Named patient, what they were treated for, and a sum — printed to be handed
  // to someone. An export, like the prescription and the confirmation.
  await logRecordAccess(scope.supabase, 'invoices', id, 'export');

  const clinic = scope.context.clinic;
  const money = (value: number) =>
    format.number(value, { style: 'currency', currency: invoice.currency || 'ILS' });

  const items = [...(invoice.items ?? [])].sort((a, b) => a.sequence - b.sequence);
  // Only payments that actually landed. A pending card attempt printed on an
  // invoice would read as money received.
  const settled = (invoice.payments ?? [])
    .filter((payment) => payment.status === 'paid')
    .sort(
      (a, b) =>
        new Date(a.paid_at ?? a.created_at).getTime() -
        new Date(b.paid_at ?? b.created_at).getTime(),
    );

  const paid = Number(invoice.amount_paid ?? 0);
  const balance = Number(invoice.total) - paid;
  // Half an agora: a rounding tail is not an outstanding balance.
  const settledInFull = balance <= 0.005;

  return (
    <article className="space-y-6">
      <PrintButton />

      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-ink-300 pb-4">
        <div>
          <h1 className="text-xl font-semibold">{clinic.name}</h1>
          <p className="mt-0.5 text-sm text-ink-600">
            {[clinic.address, clinic.phone].filter(Boolean).join(' · ')}
          </p>
          {clinic.tax_id ? (
            <p className="text-sm text-ink-600">
              {t('taxId')}: <span dir="ltr">{clinic.tax_id}</span>
            </p>
          ) : null}
        </div>
        <div className="text-end">
          <h2 className="text-lg font-semibold">
            {settledInFull ? t('headingPaid') : t('heading')}
          </h2>
          <p className="text-sm tabular-nums text-ink-600">
            {t('number', { number: invoice.invoice_number })}
          </p>
          <p className="text-sm text-ink-600">
            {t('issuedOn', {
              date: formatDate(new Date(invoice.issued_at ?? invoice.created_at)),
            })}
          </p>
        </div>
      </header>

      <section>
        <h3 className="text-sm font-semibold text-ink-900">{t('billTo')}</h3>
        <p className="text-base" dir="auto">
          {invoice.patient?.full_name ?? '—'}
        </p>
        {invoice.patient?.phone ? (
          <p className="text-sm text-ink-600" dir="ltr">
            {invoice.patient.phone}
          </p>
        ) : null}
        {invoice.due_date && !settledInFull ? (
          <p className="mt-1 text-sm text-ink-700">
            {t('dueOn', { date: formatDate(new Date(invoice.due_date)) })}
          </p>
        ) : null}
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-ink-900">{t('lines')}</h3>
        {items.length === 0 ? (
          <p className="text-sm text-ink-600">{tBilling('noLines')}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-300">
                <th scope="col" className="py-1.5 text-start font-semibold">
                  {tBilling('description')}
                </th>
                <th scope="col" className="w-20 py-1.5 text-end font-semibold">
                  {tBilling('quantity')}
                </th>
                <th scope="col" className="w-28 py-1.5 text-end font-semibold">
                  {tBilling('unitPrice')}
                </th>
                <th scope="col" className="w-28 py-1.5 text-end font-semibold">
                  {tBilling('lineTotal')}
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-ink-100 align-top">
                  <td className="py-1.5" dir="auto">
                    {item.description}
                  </td>
                  <td className="py-1.5 text-end tabular-nums">{format.number(item.quantity)}</td>
                  <td className="py-1.5 text-end tabular-nums">{money(Number(item.unit_price))}</td>
                  <td className="py-1.5 text-end tabular-nums">{money(Number(item.line_total))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* The sums, in a narrow block at the end of the line rather than across
          the page: three figures read as a column, not as a row. */}
      <section className="flex justify-end">
        <dl className="w-64 space-y-1 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-ink-600">{tBilling('subtotal')}</dt>
            <dd className="tabular-nums">{money(Number(invoice.subtotal))}</dd>
          </div>
          <div className="flex justify-between gap-4 border-t border-ink-300 pt-1 text-base font-semibold">
            <dt>{tBilling('total')}</dt>
            <dd className="tabular-nums">{money(Number(invoice.total))}</dd>
          </div>
          {paid > 0 ? (
            <div className="flex justify-between gap-4">
              <dt className="text-ink-600">{t('paid')}</dt>
              <dd className="tabular-nums">{money(paid)}</dd>
            </div>
          ) : null}
          {!settledInFull ? (
            <div className="flex justify-between gap-4 font-semibold">
              <dt>{t('balance')}</dt>
              <dd className="tabular-nums">{money(balance)}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      {settled.length > 0 ? (
        <section>
          <h3 className="mb-2 text-sm font-semibold text-ink-900">{t('paymentsHeading')}</h3>
          <ul className="space-y-0.5 text-sm">
            {settled.map((payment) => (
              <li key={payment.id} className="flex flex-wrap gap-x-3">
                <span dir="ltr" className="tabular-nums">
                  {formatDate(new Date(payment.paid_at ?? payment.created_at))}
                </span>
                <span>{tMethods(payment.method)}</span>
                <span className="tabular-nums">{money(Number(payment.amount))}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {invoice.notes ? (
        <section>
          <h3 className="mb-1 text-sm font-semibold text-ink-900">{t('notes')}</h3>
          <p className="whitespace-pre-wrap text-sm text-ink-700" dir="auto">
            {invoice.notes}
          </p>
        </section>
      ) : null}

      <footer className="border-t border-ink-200 pt-3 text-xs text-ink-600">
        {t('disclaimer')}
      </footer>
    </article>
  );
}
