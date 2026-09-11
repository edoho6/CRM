import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import { Plus, Receipt, Settings } from 'lucide-react';
import {
  Dash,
  Badge,
  Button,
  EmptyState,
  SortBody,
  SortTh,
  SortableTable,
  TableWrapper,
  Td,
  Tr,
} from '@clinic/ui';
import { Link } from '@clinic/i18n/navigation';
import type { Invoice, Patient } from '@clinic/db/types';
import { INVOICE_STATUS_TONES, statusTone } from '@clinic/domain';
import { PageHeader } from '@/components/app-shell';
import { Pagination, pageFrom, pageRange } from '@/components/pagination';
import { getClinicScope } from '@/lib/session';
import { formatDate } from '@clinic/i18n';
import { pageTitle } from '@/lib/page-title';

export const generateMetadata = pageTitle('billing', 'title');

type InvoiceRow = Invoice & { patient: Pick<Patient, 'id' | 'full_name'> | null };


export default async function BillingPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { locale } = await params;
  const { page: pageParam } = await searchParams;
  const page = pageFrom(pageParam);
  setRequestLocale(locale);

  const t = await getTranslations('billing');
  const tc = await getTranslations('common');
  const tPatients = await getTranslations('patients');
  const format = await getFormatter();

  const scope = await getClinicScope();
  if (!scope) return null;

  // Fifty a page, newest first, with the count so the foot can say how many
  // there are in all — it used to stop at two hundred without a word.
  const { data, count } = await scope.supabase
    .from('invoices')
    .select('*, patient:patients(id, full_name)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(...pageRange(page))
    .returns<InvoiceRow[]>();

  const invoices = data ?? [];

  return (
    <>
      <PageHeader
        title={t('title')}
        actions={
          <>
            <Button asChild variant="secondary">
              <Link href="/billing/settings">
                <Settings className="h-4 w-4" />
                {t('settings.title')}
              </Link>
            </Button>
            <Button asChild>
              <Link href="/billing/new">
                <Plus className="h-4 w-4" />
                {t('new')}
              </Link>
            </Button>
          </>
        }
      />

      {invoices.length === 0 ? (
        <EmptyState
          icon={<Receipt className="h-8 w-8" />}
          title={t('empty')}
          description={t('emptyBody')}
          action={
            <Button asChild size="sm">
              <Link href="/billing/new">{t('new')}</Link>
            </Button>
          }
        />
      ) : (
        <TableWrapper responsive>
          <SortableTable defaultSortKey="date" defaultSortDirection="desc">
            <thead>
              <tr>
                <SortTh sortKey="number">{t('invoice')}</SortTh>
                <SortTh sortKey="patient">{tPatients('title')}</SortTh>
                <SortTh sortKey="date">{tc('date')}</SortTh>
                <SortTh sortKey="total" numeric>{t('total')}</SortTh>
                <SortTh sortKey="paid" numeric>{t('paid')}</SortTh>
                <SortTh sortKey="status">{tc('status')}</SortTh>
              </tr>
            </thead>
            <SortBody locale={locale}>
              {invoices.map((invoice) => (
                <Tr
                  key={invoice.id}
                  sort={{
                    number: invoice.invoice_number,
                    patient: invoice.patient?.full_name ?? null,
                    date: new Date(invoice.created_at).getTime(),
                    total: Number(invoice.total),
                    paid: Number(invoice.amount_paid),
                    status: t(`status.${invoice.status}`),
                  }}
                >
                  <Td data-card-title>
                    <Link
                      href={`/billing/${invoice.id}`}
                      className="font-medium text-jade-800 underline-offset-2 hover:underline"
                      dir="ltr"
                    >
                      #{invoice.invoice_number}
                    </Link>
                  </Td>
                  <Td>
                    {invoice.patient ? (
                      <Link
                        href={`/patients/${invoice.patient.id}`}
                        className="text-ink-800 underline-offset-2 hover:underline"
                      >
                        {invoice.patient.full_name}
                      </Link>
                    ) : (
                      <Dash />
                    )}
                  </Td>
                  <Td>
                    <span dir="ltr" className="tabular-nums">
                      {formatDate(new Date(invoice.created_at))}
                    </span>
                  </Td>
                  <Td numeric>
                    <span dir="ltr" className="tabular-nums">
                      {format.number(Number(invoice.total), 'currency')}
                    </span>
                  </Td>
                  <Td numeric>
                    <span dir="ltr" className="tabular-nums text-ink-600">
                      {format.number(Number(invoice.amount_paid), 'currency')}
                    </span>
                  </Td>
                  <Td>
                    <Badge tone={statusTone(INVOICE_STATUS_TONES, invoice.status)}>{t(`status.${invoice.status}`)}</Badge>
                  </Td>
                </Tr>
              ))}
            </SortBody>
          </SortableTable>
        </TableWrapper>
      )}
      <Pagination page={page} total={count ?? null} shown={invoices.length} pathname="/billing" query={{}} />
    </>
  );
}
