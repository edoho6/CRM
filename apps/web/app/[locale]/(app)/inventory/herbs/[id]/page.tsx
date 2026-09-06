import { notFound } from 'next/navigation';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import { PackagePlus, Pencil } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  DetailRow,
  Table,
  TableWrapper,
  Td,
  Th,
  Tr,
} from '@clinic/ui';
import { Link } from '@clinic/i18n/navigation';
import type { Herb, HerbBatch, HerbStockLevel, StockMovement, Supplier } from '@clinic/db/types';
import type { Locale } from '@clinic/domain';
import { PageHeader } from '@/components/app-shell';
import { getClinicScope } from '@/lib/session';
import { herbPrimaryName, herbSecondaryName } from '@/lib/display';
import { InventoryNav } from '@/features/inventory/inventory-nav';

type BatchRow = HerbBatch & { supplier: Pick<Supplier, 'id' | 'name'> | null };

export default async function HerbDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('inventory.herbs');
  const tBatches = await getTranslations('inventory.batches');
  const tMovements = await getTranslations('inventory.movements');
  const tCategory = await getTranslations('inventory.category');
  const tUnit = await getTranslations('inventory.unit');
  const tc = await getTranslations('common');
  const format = await getFormatter();

  const scope = await getClinicScope();
  if (!scope) return null;

  const { data: herb } = await scope.supabase
    .from('herbs')
    .select('*')
    .eq('id', id)
    .maybeSingle<Herb>();

  if (!herb) notFound();

  const [levelResult, batchesResult, movementsResult] = await Promise.all([
    scope.supabase
      .from('herb_stock_levels')
      .select('*')
      .eq('herb_id', id)
      .maybeSingle<HerbStockLevel>(),
    scope.supabase
      .from('herb_batches')
      .select('*, supplier:suppliers(id, name)')
      .eq('herb_id', id)
      .order('expiry_date', { ascending: true, nullsFirst: false })
      .returns<BatchRow[]>(),
    scope.supabase
      .from('stock_movements')
      .select('*')
      .eq('herb_id', id)
      .order('created_at', { ascending: false })
      .limit(100)
      .returns<StockMovement[]>(),
  ]);

  const level = levelResult.data;
  const batches = batchesResult.data ?? [];
  const movements = movementsResult.data ?? [];
  const remaining = Number(level?.total_remaining ?? 0);

  return (
    <>
      <PageHeader
        title={herbPrimaryName(herb, locale as Locale)}
        description={
          <span dir="ltr" className="text-ink-500">
            {herbSecondaryName(herb, locale as Locale)}
          </span>
        }
        actions={
          <>
            <Button asChild variant="secondary">
              <Link href={{ pathname: '/inventory/batches/receive', query: { herb: herb.id } }}>
                <PackagePlus className="h-4 w-4" />
                {tBatches('receive')}
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href={`/inventory/herbs/${herb.id}/edit`}>
                <Pencil className="h-4 w-4" />
                {tc('edit')}
              </Link>
            </Button>
          </>
        }
      />
      <InventoryNav />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Card>
          <CardHeader>
            <CardTitle>{tc('name')}</CardTitle>
            {level?.is_below_threshold ? (
              <Badge tone={remaining <= 0 ? 'danger' : 'warning'}>{t('belowThreshold')}</Badge>
            ) : (
              <Badge tone="success">{t('inStock')}</Badge>
            )}
          </CardHeader>
          <CardBody>
            <dl>
              <DetailRow label={t('inStock')}>
                <span dir="ltr" className="text-base font-semibold tabular-nums">
                  {format.number(remaining)} {tUnit(herb.default_unit)}
                </span>
              </DetailRow>
              <DetailRow label={t('fields.category')}>{tCategory(herb.category)}</DetailRow>
              <DetailRow label={t('fields.reorderThreshold')}>
                {herb.reorder_threshold === null ? '—' : format.number(Number(herb.reorder_threshold))}
              </DetailRow>
              <DetailRow label={t('fields.properties')}>{herb.properties ?? '—'}</DetailRow>
              <DetailRow label={t('fields.functions')}>{herb.functions ?? '—'}</DetailRow>
              <DetailRow label={t('fields.cautions')}>{herb.cautions ?? '—'}</DetailRow>
            </dl>
          </CardBody>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>{tBatches('title')}</CardTitle>
            </CardHeader>
            <CardBody className="p-0">
              {batches.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-ink-400">{tBatches('empty')}</p>
              ) : (
                <TableWrapper className="rounded-none border-0">
                  <Table>
                    <thead>
                      <tr>
                        <Th>{tBatches('batchNumber')}</Th>
                        <Th>{tBatches('quantityRemaining')}</Th>
                        <Th>{tBatches('expiryDate')}</Th>
                        <Th>{tBatches('supplier')}</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {batches.map((batch) => {
                        const expired =
                          batch.expiry_date && new Date(batch.expiry_date) < new Date();
                        return (
                          <Tr key={batch.id}>
                            <Td>
                              <span dir="ltr">{batch.batch_number ?? '—'}</span>
                            </Td>
                            <Td>
                              <span dir="ltr" className="tabular-nums">
                                {format.number(Number(batch.quantity_remaining))} /{' '}
                                {format.number(Number(batch.quantity_received))}
                              </span>
                            </Td>
                            <Td>
                              {batch.expiry_date ? (
                                <span
                                  dir="ltr"
                                  className={expired ? 'tabular-nums text-red-600' : 'tabular-nums'}
                                >
                                  {format.dateTime(new Date(batch.expiry_date), 'short')}
                                </span>
                              ) : (
                                <span className="text-ink-400">{tBatches('noExpiry')}</span>
                              )}
                            </Td>
                            <Td>{batch.supplier?.name ?? '—'}</Td>
                          </Tr>
                        );
                      })}
                    </tbody>
                  </Table>
                </TableWrapper>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{tMovements('title')}</CardTitle>
            </CardHeader>
            <CardBody className="p-0">
              {movements.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-ink-400">{tMovements('empty')}</p>
              ) : (
                <TableWrapper className="rounded-none border-0">
                  <Table>
                    <thead>
                      <tr>
                        <Th>{tc('date')}</Th>
                        <Th>{tMovements('type')}</Th>
                        <Th>{tc('quantity')}</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {movements.map((movement) => {
                        const quantity = Number(movement.quantity);
                        return (
                          <Tr key={movement.id}>
                            <Td>
                              <span dir="ltr" className="tabular-nums">
                                {format.dateTime(new Date(movement.created_at), 'short')}
                              </span>
                            </Td>
                            <Td>{tMovements(`kind.${movement.movement_type}`)}</Td>
                            <Td>
                              <span
                                dir="ltr"
                                className={
                                  quantity < 0
                                    ? 'tabular-nums text-red-600'
                                    : 'tabular-nums text-jade-700'
                                }
                              >
                                {quantity > 0 ? '+' : ''}
                                {format.number(quantity)}
                              </span>
                            </Td>
                          </Tr>
                        );
                      })}
                    </tbody>
                  </Table>
                </TableWrapper>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
