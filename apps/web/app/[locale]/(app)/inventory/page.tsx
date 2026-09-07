import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import { AlertTriangle, Boxes, PackagePlus, ShoppingCart } from 'lucide-react';
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
import { Link, redirect } from '@clinic/i18n/navigation';
import type {
  FormulaStockLevel,
  HerbStockByPreparation,
  HerbStockLevel,
  OrderListEntryWithTarget,
} from '@clinic/db/types';
import type { HerbPreparation, Locale } from '@clinic/domain';
import { PageHeader } from '@/components/app-shell';
import { getClinicScope } from '@/lib/session';
import { formulaPrimaryName, herbPrimaryName, herbSecondaryName } from '@/lib/display';
import { InventoryNav } from '@/features/inventory/inventory-nav';
import { parseStockTab, type StockTab } from '@/features/inventory/stock-tabs';
import { ThresholdCell } from '@/features/inventory/stock-controls';
import { OrderDialog } from '@/features/inventory/order-dialog';
import { StockEditor, type StockBatchSummary } from '@/features/inventory/stock-editor';
import { OrderListRowControls } from '@/features/inventory/order-list-row';

/** Just enough of a batch for the stock editor's list. */
type BatchRow = StockBatchSummary & { herb_id: string };

/**
 * The stock room.
 *
 * It lists what the clinic actually holds, not the whole materia medica: a herb
 * appears here once it has been received or once someone set a threshold for
 * it. That distinction is what keeps a shelf of forty herbs from being buried
 * under a catalogue of four hundred.
 *
 * A formula has no stock of its own, so it is measured in the doses its
 * scarcest ingredient still allows — the honest answer to "can I still make
 * this".
 */

const ORDER_SELECT =
  '*, herb:herbs(id, pinyin_name, chinese_name, english_name, hebrew_name, default_unit), ' +
  'formula:herb_formulas(id, name_pinyin, name_chinese, name_english, name_hebrew), ' +
  'supplier:suppliers(id, name)';

export default async function StockRoomPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { locale } = await params;
  const { tab: rawTab } = await searchParams;
  setRequestLocale(locale);

  const tab: StockTab = parseStockTab(rawTab);

  const t = await getTranslations('inventory.stock');
  const tHerbs = await getTranslations('inventory.herbs');
  const tFormulas = await getTranslations('inventory.formulas');
  const tBatches = await getTranslations('inventory.batches');
  const tOrder = await getTranslations('inventory.order');
  const tUnit = await getTranslations('inventory.unit');
  const tPrep = await getTranslations('inventory.preparation');
  const tc = await getTranslations('common');
  const format = await getFormatter();

  const scope = await getClinicScope();
  if (!scope) return null;

  // The stock room does not exist for a clinic that keeps no stock; the nav
  // already hides it, and this closes the door on a bookmarked URL.
  if (scope.context.clinic.tracks_inventory === false) {
    redirect({ href: '/reference/herbs', locale: locale as Locale });
    return null;
  }

  const [herbResult, formulaResult, orderResult, prepResult, batchResult] = await Promise.all([
    scope.supabase
      .from('herb_stock_levels')
      .select('*')
      .eq('is_active', true)
      .eq('is_stocked', true)
      .limit(2000)
      .returns<HerbStockLevel[]>(),
    scope.supabase
      .from('formula_stock_levels')
      .select('*')
      .eq('is_active', true)
      .eq('is_stocked', true)
      .limit(1000)
      .returns<FormulaStockLevel[]>(),
    scope.supabase
      .from('order_list')
      .select(ORDER_SELECT)
      .order('created_at', { ascending: false })
      .limit(500)
      .returns<OrderListEntryWithTarget[]>(),
    // The shelf as it actually is: 40g of dried root and 100ml of tincture are
    // two lines, not 140 of anything.
    scope.supabase
      .from('herb_stock_by_preparation')
      .select('*')
      .limit(4000)
      .returns<HerbStockByPreparation[]>(),
    // Live batches, so the stock editor can show and correct expiry in place.
    scope.supabase
      .from('herb_batches')
      .select('id, herb_id, preparation, quantity_remaining, expiry_date')
      .gt('quantity_remaining', 0)
      .order('expiry_date', { ascending: true, nullsFirst: false })
      .limit(4000)
      .returns<BatchRow[]>(),
  ]);

  const herbs = herbResult.data ?? [];
  const formulas = formulaResult.data ?? [];
  const orders = orderResult.data ?? [];

  const preparationsByHerb = new Map<string, HerbStockByPreparation[]>();
  for (const row of prepResult.data ?? []) {
    if (Number(row.total_remaining ?? 0) <= 0) continue;
    const list = preparationsByHerb.get(row.herb_id);
    if (list) list.push(row);
    else preparationsByHerb.set(row.herb_id, [row]);
  }

  const batchesByHerb = new Map<string, BatchRow[]>();
  for (const batch of batchResult.data ?? []) {
    const list = batchesByHerb.get(batch.herb_id);
    if (list) list.push(batch);
    else batchesByHerb.set(batch.herb_id, [batch]);
  }

  // Which preparations of a herb are already on the order list. Not a block —
  // the dialog uses it only to say "this tops up the line already there".
  const listedPreparationsByHerb = new Map<string, (HerbPreparation | null)[]>();
  for (const entry of orders) {
    if (entry.status === 'received' || !entry.herb_id) continue;
    const list = listedPreparationsByHerb.get(entry.herb_id) ?? [];
    list.push(entry.preparation ?? null);
    listedPreparationsByHerb.set(entry.herb_id, list);
  }

  const listedHerbs = new Set(
    orders
      .filter((entry) => entry.status !== 'received' && entry.herb_id)
      .map((entry) => entry.herb_id!),
  );
  const listedFormulas = new Set(
    orders
      .filter((entry) => entry.status !== 'received' && entry.formula_id)
      .map((entry) => entry.formula_id!),
  );

  const inStockHerbs = herbs.filter((level) => Number(level.total_remaining) > 0);
  const lowHerbs = inStockHerbs.filter((level) => level.is_below_threshold);
  const outHerbs = herbs.filter((level) => Number(level.total_remaining) <= 0);

  const inStockFormulas = formulas.filter((level) => Number(level.doses_available) > 0);
  const lowFormulas = inStockFormulas.filter((level) => level.is_below_threshold);
  const outFormulas = formulas.filter((level) => Number(level.doses_available) <= 0);

  const counts: Record<StockTab, number> = {
    in_stock: inStockHerbs.length + inStockFormulas.length,
    low: lowHerbs.length + lowFormulas.length,
    out: outHerbs.length + outFormulas.length,
    to_order: orders.filter((entry) => entry.status !== 'received').length,
  };

  const shownHerbs = tab === 'low' ? lowHerbs : tab === 'out' ? outHerbs : inStockHerbs;
  const shownFormulas = tab === 'low' ? lowFormulas : tab === 'out' ? outFormulas : inStockFormulas;

  return (
    <>
      <PageHeader
        title={t('title')}
        description={
          counts.low > 0 ? (
            <span className="inline-flex items-center gap-1.5 text-amber-700">
              <AlertTriangle className="h-4 w-4" />
              {t('lowSummary', { count: counts.low })}
            </span>
          ) : (
            t('subtitle')
          )
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
      <InventoryNav counts={counts} />

      {tab === 'to_order' ? (
        orders.length === 0 ? (
          <EmptyState
            icon={<ShoppingCart className="h-8 w-8" />}
            title={tOrder('empty')}
            description={tOrder('emptyBody')}
          />
        ) : (
          <TableWrapper>
            <SortableTable defaultSortKey="name">
              <thead>
                <tr>
                  <SortTh sortKey="name">{tc('name')}</SortTh>
                  <SortTh sortKey="kind">{tOrder('kind')}</SortTh>
                  <SortTh sortKey="quantity">{tc('quantity')}</SortTh>
                  <SortTh sortKey="notes">{tc('notes')}</SortTh>
                  <SortTh sortKey="status">{tc('status')}</SortTh>
                  <SortTh sortKey="added">{tc('createdAt')}</SortTh>
                </tr>
              </thead>
              <SortBody locale={locale}>
                {orders.map((entry) => {
                  const isHerb = Boolean(entry.herb_id);
                  const name = isHerb
                    ? herbPrimaryName(entry.herb, locale as Locale)
                    : formulaPrimaryName(entry.formula, locale as Locale);
                  const href = isHerb
                    ? `/reference/herbs/${entry.herb_id}`
                    : `/reference/formulas/${entry.formula_id}`;
                  return (
                    <Tr
                      key={entry.id}
                      sort={{
                        name,
                        kind: isHerb ? tOrder('herb') : tOrder('formula'),
                        quantity: entry.quantity === null ? null : Number(entry.quantity),
                        notes: entry.notes,
                        status: tOrder(`status.${entry.status}`),
                        added: new Date(entry.created_at).getTime(),
                      }}
                    >
                      <Td>
                        <Link
                          href={href}
                          className="font-medium text-jade-800 underline-offset-2 hover:underline"
                        >
                          {name || '—'}
                        </Link>
                      </Td>
                      <Td>
                        <Badge tone={isHerb ? 'neutral' : 'info'}>
                          {isHerb ? tOrder('herb') : tOrder('formula')}
                        </Badge>
                      </Td>
                      <OrderListRowControls
                        entry={{
                          id: entry.id,
                          herb_id: entry.herb_id,
                          formula_id: entry.formula_id,
                          quantity: entry.quantity,
                          unit: entry.unit,
                          status: entry.status,
                          notes: entry.notes,
                        }}
                      />
                      <Td>
                        <span dir="ltr" className="text-xs tabular-nums text-ink-500">
                          {format.dateTime(new Date(entry.created_at), 'short')}
                        </span>
                      </Td>
                    </Tr>
                  );
                })}
              </SortBody>
            </SortableTable>
          </TableWrapper>
        )
      ) : shownHerbs.length === 0 && shownFormulas.length === 0 ? (
        <EmptyState
          icon={<Boxes className="h-8 w-8" />}
          title={t(`empty.${tab}`)}
          description={tab === 'in_stock' ? t('emptyBody') : undefined}
          action={
            tab === 'in_stock' ? (
              <Button asChild size="sm">
                <Link href="/inventory/batches/receive">{tBatches('receive')}</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-6">
          {shownHerbs.length > 0 ? (
            <section>
              <h2 className="mb-2 text-sm font-semibold text-ink-700">
                {tHerbs('title')}{' '}
                <span className="font-normal text-ink-500">({shownHerbs.length})</span>
              </h2>
              <TableWrapper>
                <SortableTable defaultSortKey="stock">
                  <thead>
                    <tr>
                      <SortTh sortKey="name">{tc('name')}</SortTh>
                      <SortTh sortKey="stock">{tHerbs('inStock')}</SortTh>
                      <SortTh sortKey="threshold">{t('threshold')}</SortTh>
                      <SortTh sortKey="expiry">{tBatches('expiryDate')}</SortTh>
                      <SortTh sortKey="order">{tc('actions')}</SortTh>
                    </tr>
                  </thead>
                  <SortBody locale={locale}>
                    {shownHerbs.map((level) => {
                      const remaining = Number(level.total_remaining);
                      const prepared = preparationsByHerb.get(level.herb_id) ?? [];
                      const secondary = herbSecondaryName(level, locale as Locale);
                      return (
                        <Tr
                          key={level.herb_id}
                          sort={{
                            name: herbPrimaryName(level, locale as Locale),
                            stock: remaining,
                            threshold:
                              level.reorder_threshold === null
                                ? null
                                : Number(level.reorder_threshold),
                            expiry: level.nearest_expiry
                              ? new Date(level.nearest_expiry).getTime()
                              : null,
                            order: listedHerbs.has(level.herb_id) ? 0 : 1,
                          }}
                        >
                          <Td>
                            <Link
                              href={`/reference/herbs/${level.herb_id}`}
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
                            {/* One line per preparation actually held, each in
                                its own unit — grams for a powder, millilitres
                                for a tincture. A single total across the two
                                would be a number of nothing.

                                An empty shelf reads as a dash rather than as a
                                zero: zero is a measurement, and none was taken. */}
                            {prepared.length === 0 ? (
                              <span className="text-ink-500">—</span>
                            ) : (
                              <span className="flex flex-col gap-0.5">
                                {prepared.map((row) => (
                                  <span
                                    key={row.preparation}
                                    className="flex items-baseline gap-1.5"
                                  >
                                    <span
                                      dir="ltr"
                                      className={
                                        level.is_below_threshold
                                          ? 'font-semibold tabular-nums text-amber-700'
                                          : 'font-semibold tabular-nums text-ink-800'
                                      }
                                    >
                                      {format.number(Number(row.total_remaining))} {tUnit(row.unit)}
                                    </span>
                                    <span className="text-xs text-ink-600">
                                      {tPrep(row.preparation)}
                                    </span>
                                  </span>
                                ))}
                              </span>
                            )}
                          </Td>
                          <Td>
                            {level.reorder_threshold === null ? (
                              <span className="text-ink-500">—</span>
                            ) : (
                              <span dir="ltr" className="tabular-nums text-ink-800">
                                {format.number(Number(level.reorder_threshold))}{' '}
                                {tUnit(level.default_unit)}
                              </span>
                            )}
                          </Td>
                          <Td>
                            {level.nearest_expiry ? (
                              <span dir="ltr" className="tabular-nums">
                                {format.dateTime(new Date(level.nearest_expiry), 'short')}
                              </span>
                            ) : (
                              <span className="text-ink-500">—</span>
                            )}
                          </Td>
                          <Td>
                            <span className="flex items-center gap-1">
                              <StockEditor
                                herbId={level.herb_id}
                                herbName={herbPrimaryName(level, locale as Locale)}
                                threshold={
                                  level.reorder_threshold === null
                                    ? null
                                    : Number(level.reorder_threshold)
                                }
                                reorderQuantity={
                                  level.reorder_quantity === null
                                    ? null
                                    : Number(level.reorder_quantity)
                                }
                                batches={batchesByHerb.get(level.herb_id) ?? []}
                              />
                              <OrderDialog
                                herbId={level.herb_id}
                                suggestedQuantity={
                                  level.reorder_quantity === null
                                    ? null
                                    : Number(level.reorder_quantity)
                                }
                                listedPreparations={
                                  listedPreparationsByHerb.get(level.herb_id) ?? []
                                }
                              />
                            </span>
                          </Td>
                        </Tr>
                      );
                    })}
                  </SortBody>
                </SortableTable>
              </TableWrapper>
            </section>
          ) : null}

          {shownFormulas.length > 0 ? (
            <section>
              <h2 className="mb-2 text-sm font-semibold text-ink-700">
                {tFormulas('title')}{' '}
                <span className="font-normal text-ink-500">({shownFormulas.length})</span>
              </h2>
              <p className="mb-2 text-xs text-ink-500">{t('formulaHint')}</p>
              <TableWrapper>
                <SortableTable defaultSortKey="doses">
                  <thead>
                    <tr>
                      <SortTh sortKey="name">{tc('name')}</SortTh>
                      <SortTh sortKey="doses">{t('dosesAvailable')}</SortTh>
                      <SortTh sortKey="threshold">{t('threshold')}</SortTh>
                      <SortTh sortKey="missing">{t('missingIngredients')}</SortTh>
                      <SortTh sortKey="order">{tc('actions')}</SortTh>
                    </tr>
                  </thead>
                  <SortBody locale={locale}>
                    {shownFormulas.map((level) => {
                      const doses = Number(level.doses_available);
                      return (
                        <Tr
                          key={level.formula_id}
                          sort={{
                            name: formulaPrimaryName(level, locale as Locale),
                            doses,
                            threshold:
                              level.reorder_threshold_doses === null
                                ? null
                                : Number(level.reorder_threshold_doses),
                            missing: level.missing_count,
                            order: listedFormulas.has(level.formula_id) ? 0 : 1,
                          }}
                        >
                          <Td>
                            <Link
                              href={`/reference/formulas/${level.formula_id}`}
                              className="font-medium text-jade-800 underline-offset-2 hover:underline"
                            >
                              {formulaPrimaryName(level, locale as Locale)}
                            </Link>
                            {level.name_chinese ? (
                              <span className="ms-2 text-ink-600">{level.name_chinese}</span>
                            ) : null}
                          </Td>
                          <Td>
                            <span
                              dir="ltr"
                              className={
                                doses <= 0
                                  ? 'font-semibold tabular-nums text-red-600'
                                  : level.is_below_threshold
                                    ? 'font-semibold tabular-nums text-amber-700'
                                    : 'font-semibold tabular-nums text-ink-800'
                              }
                            >
                              {format.number(doses)}
                            </span>
                            <span className="ms-1 text-xs text-ink-500">{t('doses')}</span>
                          </Td>
                          <Td>
                            <ThresholdCell
                              id={level.formula_id}
                              kind="formula"
                              value={
                                level.reorder_threshold_doses === null
                                  ? null
                                  : Number(level.reorder_threshold_doses)
                              }
                              suffix={t('doses')}
                            />
                          </Td>
                          <Td>
                            {level.missing_count > 0 ? (
                              <Badge tone="danger">
                                {t('missingCount', { count: level.missing_count })}
                              </Badge>
                            ) : (
                              <span className="text-xs text-ink-500">
                                {t('allIngredients', { count: level.item_count })}
                              </span>
                            )}
                          </Td>
                          <Td>
                            {/* A formula is ordered in doses and has no
                                preparation of its own, so the dialog shows just
                                the amount. */}
                            <OrderDialog formulaId={level.formula_id} />
                          </Td>
                        </Tr>
                      );
                    })}
                  </SortBody>
                </SortableTable>
              </TableWrapper>
            </section>
          ) : null}
        </div>
      )}

      {tab !== 'to_order' ? <p className="mt-4 text-xs text-ink-500">{t('scopeNote')}</p> : null}
    </>
  );
}
