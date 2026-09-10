import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import { Package, PackagePlus } from 'lucide-react';
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
import type { HerbBatchWithHerb } from '@clinic/db/types';
import type { Locale } from '@clinic/domain';
import { PageHeader } from '@/components/app-shell';
import { Pagination, pageFrom, pageRange } from '@/components/pagination';
import { getClinicScope } from '@/lib/session';
import { herbPrimaryName } from '@/lib/display';
import { InventoryNav } from '@/features/inventory/inventory-nav';
import { formatDate } from '@clinic/i18n';

/** Batches expiring within this window are flagged so they get used first. */
const EXPIRY_WARNING_DAYS = 60;

export default async function BatchesPage({
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

  const t = await getTranslations('inventory.batches');
  const tUnit = await getTranslations('inventory.unit');
  const tc = await getTranslations('common');
  const format = await getFormatter();

  const scope = await getClinicScope();
  if (!scope) return null;

  const { data, count } = await scope.supabase
    .from('herb_batches')
    .select(
      '*, herb:herbs(id, pinyin_name, chinese_name, english_name, hebrew_name), supplier:suppliers(id, name)',
      { count: 'exact' },
    )
    .order('expiry_date', { ascending: true, nullsFirst: false })
    .range(...pageRange(page))
    .returns<HerbBatchWithHerb[]>();

  const batches = data ?? [];
  const now = new Date();
  const warningDate = new Date(now.getTime() + EXPIRY_WARNING_DAYS * 24 * 60 * 60 * 1000);

  return (
    <>
      <PageHeader
        title={t('title')}
        actions={
          <Button asChild>
            <Link href="/inventory/batches/receive">
              <PackagePlus className="h-4 w-4" />
              {t('receive')}
            </Link>
          </Button>
        }
        below={<InventoryNav />}
      />

      {batches.length === 0 ? (
        <EmptyState
          icon={<Package className="h-8 w-8" />}
          title={t('empty')}
          action={
            <Button asChild size="sm">
              <Link href="/inventory/batches/receive">{t('receive')}</Link>
            </Button>
          }
        />
      ) : (
        <TableWrapper responsive>
          <SortableTable defaultSortKey="expiry">
            <thead>
              <tr>
                <SortTh sortKey="name">{tc('name')}</SortTh>
                <SortTh sortKey="batch">{t('batchNumber')}</SortTh>
                <SortTh sortKey="remaining" numeric>{t('quantityRemaining')}</SortTh>
                <SortTh sortKey="expiry">{t('expiryDate')}</SortTh>
                <SortTh sortKey="supplier">{t('supplier')}</SortTh>
                <SortTh sortKey="location">{t('storageLocation')}</SortTh>
              </tr>
            </thead>
            <SortBody locale={locale}>
              {batches.map((batch) => {
                const expiry = batch.expiry_date ? new Date(batch.expiry_date) : null;
                const expired = expiry !== null && expiry < now;
                const expiringSoon = expiry !== null && !expired && expiry < warningDate;
                return (
                  <Tr
                    key={batch.id}
                    sort={{
                      name: batch.herb ? herbPrimaryName(batch.herb, locale as Locale) : null,
                      batch: batch.batch_number,
                      remaining: Number(batch.quantity_remaining),
                      expiry: expiry ? expiry.getTime() : null,
                      supplier: batch.supplier?.name ?? null,
                      location: batch.storage_location,
                    }}
                  >
                    <Td data-card-title>
                      {batch.herb ? (
                        <Link
                          href={`/reference/herbs/${batch.herb.id}`}
                          className="font-medium text-jade-800 underline-offset-2 hover:underline"
                        >
                          {herbPrimaryName(batch.herb, locale as Locale)}
                        </Link>
                      ) : (
                        <Dash />
                      )}
                    </Td>
                    <Td>
                      <span dir="ltr">{batch.batch_number ?? <Dash />}</span>
                    </Td>
                    <Td numeric>
                      <span className="tabular-nums">
                        {format.number(Number(batch.quantity_remaining))} {tUnit(batch.unit)}
                      </span>
                    </Td>
                    <Td>
                      {expiry ? (
                        <span className="flex items-center gap-1.5">
                          <span dir="ltr" className="tabular-nums">
                            {formatDate(expiry)}
                          </span>
                          {expired ? (
                            <Badge tone="danger">{t('expired')}</Badge>
                          ) : expiringSoon ? (
                            <Badge tone="warning">{t('expiringSoon')}</Badge>
                          ) : null}
                        </span>
                      ) : (
                        <span className="text-ink-500">{t('noExpiry')}</span>
                      )}
                    </Td>
                    <Td>{batch.supplier?.name ?? <Dash />}</Td>
                    <Td>{batch.storage_location ?? <Dash />}</Td>
                  </Tr>
                );
              })}
            </SortBody>
          </SortableTable>
        </TableWrapper>
      )}
      <Pagination page={page} total={count ?? null} shown={batches.length} pathname="/inventory/batches" query={{}} />
    </>
  );
}
