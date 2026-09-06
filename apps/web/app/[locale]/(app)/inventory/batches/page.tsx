import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import { Package, PackagePlus } from 'lucide-react';
import {
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
import { getClinicScope } from '@/lib/session';
import { herbPrimaryName } from '@/lib/display';
import { InventoryNav } from '@/features/inventory/inventory-nav';

/** Batches expiring within this window are flagged so they get used first. */
const EXPIRY_WARNING_DAYS = 60;

export default async function BatchesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('inventory.batches');
  const tUnit = await getTranslations('inventory.unit');
  const tc = await getTranslations('common');
  const format = await getFormatter();

  const scope = await getClinicScope();
  if (!scope) return null;

  const { data } = await scope.supabase
    .from('herb_batches')
    .select(
      '*, herb:herbs(id, pinyin_name, chinese_name, english_name, hebrew_name), supplier:suppliers(id, name)',
    )
    .order('expiry_date', { ascending: true, nullsFirst: false })
    .limit(500)
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
      />
      <InventoryNav />

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
        <TableWrapper>
          <SortableTable defaultSortKey="expiry">
            <thead>
              <tr>
                <SortTh sortKey="name">{tc('name')}</SortTh>
                <SortTh sortKey="batch">{t('batchNumber')}</SortTh>
                <SortTh sortKey="remaining">{t('quantityRemaining')}</SortTh>
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
                    <Td>
                      {batch.herb ? (
                        <Link
                          href={`/inventory/herbs/${batch.herb.id}`}
                          className="font-medium text-jade-800 underline-offset-2 hover:underline"
                        >
                          {herbPrimaryName(batch.herb, locale as Locale)}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </Td>
                    <Td>
                      <span dir="ltr">{batch.batch_number ?? '—'}</span>
                    </Td>
                    <Td>
                      <span dir="ltr" className="tabular-nums">
                        {format.number(Number(batch.quantity_remaining))} {tUnit(batch.unit)}
                      </span>
                    </Td>
                    <Td>
                      {expiry ? (
                        <span className="flex items-center gap-1.5">
                          <span dir="ltr" className="tabular-nums">
                            {format.dateTime(expiry, 'short')}
                          </span>
                          {expired ? (
                            <Badge tone="danger">{t('expired')}</Badge>
                          ) : expiringSoon ? (
                            <Badge tone="warning">{t('expiringSoon')}</Badge>
                          ) : null}
                        </span>
                      ) : (
                        <span className="text-ink-400">{t('noExpiry')}</span>
                      )}
                    </Td>
                    <Td>{batch.supplier?.name ?? '—'}</Td>
                    <Td>{batch.storage_location ?? '—'}</Td>
                  </Tr>
                );
              })}
            </SortBody>
          </SortableTable>
        </TableWrapper>
      )}
    </>
  );
}
