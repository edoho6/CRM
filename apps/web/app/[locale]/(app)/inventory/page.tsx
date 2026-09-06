import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import { AlertTriangle, PackagePlus, Sprout } from 'lucide-react';
import { Badge, Button, EmptyState, Table, TableWrapper, Td, Th, Tr } from '@clinic/ui';
import { Link } from '@clinic/i18n/navigation';
import type { HerbStockLevel } from '@clinic/db/types';
import type { Locale } from '@clinic/domain';
import { PageHeader } from '@/components/app-shell';
import { getClinicScope } from '@/lib/session';
import { herbPrimaryName, herbSecondaryName } from '@/lib/display';
import { InventoryNav } from '@/features/inventory/inventory-nav';

export default async function InventoryOverviewPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('inventory');
  const tHerbs = await getTranslations('inventory.herbs');
  const tBatches = await getTranslations('inventory.batches');
  const tUnit = await getTranslations('inventory.unit');
  const tc = await getTranslations('common');
  const format = await getFormatter();

  const scope = await getClinicScope();
  if (!scope) return null;

  const { data } = await scope.supabase
    .from('herb_stock_levels')
    .select('*')
    .eq('is_active', true)
    // Herbs that need attention first: below threshold, then lowest stock.
    .order('is_below_threshold', { ascending: false })
    .order('total_remaining', { ascending: true })
    .limit(500)
    .returns<HerbStockLevel[]>();

  const levels = data ?? [];
  const lowCount = levels.filter((level) => level.is_below_threshold).length;

  return (
    <>
      <PageHeader
        title={t('title')}
        description={
          lowCount > 0 ? (
            <span className="inline-flex items-center gap-1.5 text-amber-700">
              <AlertTriangle className="h-4 w-4" />
              {tHerbs('belowThreshold')}: {lowCount}
            </span>
          ) : undefined
        }
        actions={
          <Button asChild>
            <Link href="/inventory/batches/receive">
              <PackagePlus className="h-4 w-4" />
              {tBatches('receive')}
            </Link>
          </Button>
        }
      />
      <InventoryNav />

      {levels.length === 0 ? (
        <EmptyState
          icon={<Sprout className="h-8 w-8" />}
          title={tHerbs('empty')}
          description={tHerbs('emptyBody')}
          action={
            <Button asChild size="sm">
              <Link href="/inventory/herbs/new">{tHerbs('new')}</Link>
            </Button>
          }
        />
      ) : (
        <TableWrapper>
          <Table>
            <thead>
              <tr>
                <Th>{tc('name')}</Th>
                <Th>{tHerbs('inStock')}</Th>
                <Th>{tHerbs('fields.reorderThreshold')}</Th>
                <Th>{tBatches('expiryDate')}</Th>
                <Th>{tc('status')}</Th>
              </tr>
            </thead>
            <tbody>
              {levels.map((level) => {
                const remaining = Number(level.total_remaining);
                const secondary = herbSecondaryName(level, locale as Locale);
                return (
                  <Tr key={level.herb_id}>
                    <Td>
                      <Link
                        href={`/inventory/herbs/${level.herb_id}`}
                        className="font-medium text-jade-800 underline-offset-2 hover:underline"
                      >
                        {herbPrimaryName(level, locale as Locale)}
                      </Link>
                      {secondary ? (
                        <span className="block text-xs text-ink-500" dir="ltr">
                          {secondary}
                        </span>
                      ) : null}
                    </Td>
                    <Td>
                      <span dir="ltr" className="tabular-nums">
                        {format.number(remaining)} {tUnit(level.default_unit)}
                      </span>
                    </Td>
                    <Td>
                      {level.reorder_threshold === null ? (
                        <span className="text-ink-400">—</span>
                      ) : (
                        <span dir="ltr" className="tabular-nums text-ink-600">
                          {format.number(Number(level.reorder_threshold))}
                        </span>
                      )}
                    </Td>
                    <Td>
                      {level.nearest_expiry ? (
                        <span dir="ltr" className="tabular-nums">
                          {format.dateTime(new Date(level.nearest_expiry), 'short')}
                        </span>
                      ) : (
                        <span className="text-ink-400">{tBatches('noExpiry')}</span>
                      )}
                    </Td>
                    <Td>
                      {remaining <= 0 ? (
                        <Badge tone="danger">{tc('none')}</Badge>
                      ) : level.is_below_threshold ? (
                        <Badge tone="warning">{tHerbs('belowThreshold')}</Badge>
                      ) : (
                        <Badge tone="success">{tHerbs('inStock')}</Badge>
                      )}
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        </TableWrapper>
      )}
    </>
  );
}
