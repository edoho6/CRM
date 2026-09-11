import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@clinic/i18n/navigation';
import type { InvoiceWithDetails } from '@clinic/db/types';
import { PageHeader } from '@/components/app-shell';
import { getClinicScope } from '@/lib/session';
import { InvoiceEditor } from '@/features/billing/invoice-editor';
import { pageTitle } from '@/lib/page-title';

export const generateMetadata = pageTitle('billing', 'invoice');

export default async function InvoicePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('billing');

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

  // PostgREST returns embedded rows in arbitrary order; the invoice must read
  // in the order the lines were added.
  const ordered: InvoiceWithDetails = {
    ...invoice,
    items: [...(invoice.items ?? [])].sort((a, b) => a.sequence - b.sequence),
    payments: [...(invoice.payments ?? [])].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    ),
  };

  return (
    <>
      <PageHeader
        title={t('invoiceNumber', { number: invoice.invoice_number })}
        description={
          invoice.patient ? (
            <Link
              href={`/patients/${invoice.patient.id}`}
              className="font-medium text-jade-800 underline-offset-2 hover:underline"
            >
              {invoice.patient.full_name}
            </Link>
          ) : null
        }
      />
      <InvoiceEditor invoice={ordered} />
    </>
  );
}
