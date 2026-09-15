import { notFound } from 'next/navigation';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import { AlertTriangle, PackagePlus, Pencil } from 'lucide-react';
import {
  Dash,
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  DetailRow,
  SortBody,
  SortTh,
  SortableTable,
  TableWrapper,
  Td,
  Tr,
} from '@clinic/ui';
import { Link } from '@clinic/i18n/navigation';
import type {
  Herb,
  HerbBatch,
  HerbFormula,
  HerbStockLevel,
  StockMovement,
  Supplier,
} from '@clinic/db/types';
import { localizedField, type HerbUnit, type Locale } from '@clinic/domain';
import { PageHeader } from '@/components/app-shell';
import { RegisterOpenFile } from '@/features/workspace/register-open-file';
import { SourcesLine } from '@/features/reference/sources-line';
import { TcmChip, TcmChips } from '@/components/tcm-chip';
import { getClinicScope } from '@/lib/session';
import {
  formulaChineseName,
  formulaPrimaryName,
  herbBotanicalName,
  herbChineseName,
  herbPrimaryName,
} from '@/lib/display';
import { ReferenceNav } from '@/features/reference/reference-nav';
import { ApproveButton } from '@/features/reference/approve-button';
import { ReviewedLine } from '@/features/reference/reviewed-line';
import { HerbImageCard } from '@/features/inventory/herb-image-card';
import { HerbGalleryProvider } from '@/features/inventory/herb-gallery';
import { loadHerbGalleryEntries } from '@/features/inventory/herb-gallery-entries';
import { referenceImageFor } from '@/features/inventory/herb-reference-image';
import { OrderDialog } from '@/features/inventory/order-dialog';
import { formatDate } from '@clinic/i18n';
import { pageTitle } from '@/lib/page-title';
import { doseRangeLabel } from '@/features/inventory/dose-range';

export const generateMetadata = pageTitle('inventory.herbs', 'single');

/** Where a chip on this page sends you: the same herb list, filtered. */
const HERBS_PATH = '/reference/herbs';

type BatchRow = HerbBatch & { supplier: Pick<Supplier, 'id' | 'name'> | null };

type FormulaUse = {
  dosage: number;
  unit: HerbUnit;
  notes: string | null;
  formula: Pick<
    HerbFormula,
    | 'id'
    | 'name_pinyin'
    | 'name_chinese'
    | 'name_english'
    | 'name_hebrew'
    | 'tcm_category'
    | 'category'
    | 'is_active'
  > | null;
};

function Prose({ text }: { text: string | null }) {
  if (!text) return <Dash />;
  return <span className="whitespace-pre-wrap">{text}</span>;
}

export default async function HerbDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('inventory.herbs');
  const ts = await getTranslations('inventory.herbs.sections');
  const tBatches = await getTranslations('inventory.batches');
  const tMovements = await getTranslations('inventory.movements');
  const tFormulas = await getTranslations('inventory.formulas');
  const tCategory = await getTranslations('inventory.category');
  const tUnit = await getTranslations('inventory.unit');
  const tTcm = await getTranslations('inventory.tcmCategory');
  const tFormulaTcm = await getTranslations('inventory.formulaTcmCategory');
  const tTemp = await getTranslations('inventory.temperature');
  const tTaste = await getTranslations('inventory.taste');
  const tChannel = await getTranslations('inventory.channel');
  const tReview = await getTranslations('inventory.review');
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

  // A clinic that keeps no stock is not asked to look at any: the three stock
  // queries below are not merely hidden, they are never run.
  const tracksInventory = scope.context.clinic.tracks_inventory !== false;

  const [levelResult, batchesResult, movementsResult, usesResult] = await Promise.all([
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
    // The reverse of the formula page's ingredient list: every prescription this
    // herb takes part in, with the dose it contributes there.
    scope.supabase
      .from('herb_formula_items')
      .select(
        'dosage, unit, notes, formula:herb_formulas(id, name_pinyin, name_chinese, name_english, name_hebrew, tcm_category, category, is_active)',
      )
      .eq('herb_id', id)
      .returns<FormulaUse[]>(),
  ]);

  const level = tracksInventory ? levelResult.data : null;
  const batches = tracksInventory ? (batchesResult.data ?? []) : [];
  const movements = tracksInventory ? (movementsResult.data ?? []) : [];
  const uses = (usesResult.data ?? []).filter((use) => use.formula);
  // A formula adapted for one patient during a treatment is a record of that
  // treatment, not a place a practitioner looks a herb up in. The classics
  // and the clinic's own formulas are the table; the adapted ones fold away.
  const catalogueUses = uses.filter((use) => use.formula!.category !== 'modified');
  const modifiedUses = uses.filter((use) => use.formula!.category === 'modified');
  const remaining = Number(level?.total_remaining ?? 0);
  const chinese = herbChineseName(herb);
  const botanical = herbBotanicalName(herb);
  const primary = herbPrimaryName(herb);
  // Every herb with a photograph, so the picture can be compared with another.
  const galleryEntries = await loadHerbGalleryEntries(scope.supabase, locale);
  const tastes = herb.tastes ?? [];
  const channels = herb.channels ?? [];

  const dosage = doseRangeLabel(herb, (n) => format.number(n), tUnit('gram'));

  return (
    <>
      {/* Onto the tab strip in the shell, which knows the URL but not the
          name on it. */}
      <RegisterOpenFile
        kind="herb"
        id={herb.id}
        label={primary}
        href={`/reference/herbs/${herb.id}`}
      />

      <PageHeader
        title={
          <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span dir="ltr">{primary}</span>
            {chinese ? <span className="font-normal text-ink-600">{chinese}</span> : null}
            {herb.needs_review ? (
              <Badge tone="warning" className="align-middle">
                <AlertTriangle className="h-3 w-3" />
                {tReview('badge')}
              </Badge>
            ) : null}
          </span>
        }
        description={
          <span className="block" dir="ltr">
            {botanical ? <span className="italic">{botanical}</span> : null}
            {botanical && herb.english_name ? ' · ' : ''}
            {herb.english_name ?? ''}
          </span>
        }
        actions={
          <>
            <ReferenceNav compact />
            {tracksInventory ? (
              <Button asChild variant="secondary">
                <Link href={{ pathname: '/inventory/batches/receive', query: { herb: herb.id } }}>
                  <PackagePlus className="h-4 w-4" />
                  {tBatches('receive')}
                </Link>
              </Button>
            ) : null}
            <Button asChild variant="secondary">
              <Link href={`/reference/herbs/${herb.id}/edit`}>
                <Pencil className="h-4 w-4" />
                {tc('edit')}
              </Link>
            </Button>
          </>
        }
      />

      {herb.needs_review ? (
        <Alert tone="warning" className="mb-4">
          <span className="flex flex-wrap items-center justify-between gap-2">
            <span>{tReview('hint')}</span>
            <ApproveButton kind="herb" id={herb.id} />
          </span>
        </Alert>
      ) : (
        <ReviewedLine
          reviewedAt={herb.reviewed_at}
          reviewedByName={herb.reviewed_by_name}
          className="mb-4"
        />
      )}

      {/* The three things a practitioner reaches for before anything else: how
          much to give, how hot or cold it runs, and which group it belongs to.
          They sit above the fold so the answer never costs a scroll. */}
      <section className="mb-5 rounded-card border border-ink-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
          <div>
            <p className="text-xs font-medium text-ink-600">{t('fields.dosageRange')}</p>
            {dosage ? (
              <p dir="ltr" className="text-3xl leading-tight font-bold tabular-nums text-jade-800">
                {dosage}
              </p>
            ) : (
              <p className="text-3xl leading-tight font-bold text-ink-500">—</p>
            )}
          </div>

          <div className="h-12 w-px shrink-0 bg-ink-100" aria-hidden />

          {/* Every chip is a link into the list filtered by that value, which
              turns reading an entry into browsing: "warm" on this herb is one
              click from every other warm herb. */}
          <div className="flex flex-wrap items-start gap-x-8 gap-y-3">
            <div>
              <p className="mb-1 text-xs font-medium text-ink-600">{t('fields.temperature')}</p>
              {herb.temperature ? (
                <TcmChip
                  scale="temperature"
                  value={herb.temperature}
                  href={{ pathname: HERBS_PATH, query: { temp: herb.temperature } }}
                >
                  {tTemp(herb.temperature)}
                </TcmChip>
              ) : (
                <Dash />
              )}
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-ink-600">{t('fields.tastes')}</p>
              <TcmChips
                scale="taste"
                values={tastes}
                render={(value) => tTaste(value as never)}
                hrefFor={(value) => ({ pathname: HERBS_PATH, query: { taste: value } })}
              />
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-ink-600">{t('fields.channels')}</p>
              <TcmChips
                scale="channel"
                values={channels}
                render={(value) => tChannel(value as never)}
                hrefFor={(value) => ({ pathname: HERBS_PATH, query: { chan: value } })}
              />
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-ink-600">{t('fields.tcmCategory')}</p>
              {herb.tcm_category ? (
                <TcmChip
                  scale="tcmCategory"
                  value={herb.tcm_category}
                  href={{ pathname: HERBS_PATH, query: { cat: herb.tcm_category } }}
                >
                  {tTcm(herb.tcm_category)}
                </TcmChip>
              ) : (
                <Dash />
              )}
            </div>

            {/* Which prescriptions this herb belongs to reads as another of its
                properties, so it sits on the same line as the rest of them. */}
            <div>
              <p className="mb-1 text-xs font-medium text-ink-600">{t('usedIn')}</p>
              {uses.length > 0 ? (
                <a
                  href="#used-in"
                  className="inline-flex items-baseline gap-1 text-ink-800 underline-offset-2 hover:text-jade-800 hover:underline"
                >
                  <span className="text-xl font-semibold tabular-nums">{uses.length}</span>
                </a>
              ) : (
                <Dash />
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div className="space-y-5">
          <HerbGalleryProvider entries={galleryEntries}>
            <HerbImageCard
              herbId={herb.id}
              imageUrl={herb.image_url}
              attribution={herb.image_attribution}
              reference={referenceImageFor(herb)}
              alt={primary}
            />
          </HerbGalleryProvider>

          <Card>
            <CardHeader>
              <CardTitle>{ts('identity')}</CardTitle>
            </CardHeader>
            <CardBody>
              <dl>
                <DetailRow label={t('fields.category')}>{tCategory(herb.category)}</DetailRow>
                <DetailRow label={t('fields.pharmaceuticalName')}>
                  <span dir="ltr">{herb.pharmaceutical_name ?? <Dash />}</span>
                </DetailRow>
                {localizedField(herb, 'dosage_notes', locale) ? (
                  <DetailRow label={t('fields.dosageNotes')}>
                    {localizedField(herb, 'dosage_notes', locale)}
                  </DetailRow>
                ) : null}
              </dl>
              <SourcesLine row={herb} className="mt-3" />
            </CardBody>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>{ts('nature')}</CardTitle>
            </CardHeader>
            <CardBody>
              <dl>
                <DetailRow label={t('fields.functions')}>
                  <Prose text={localizedField(herb, 'functions', locale)} />
                </DetailRow>
                <DetailRow label={t('fields.indications')}>
                  <Prose text={localizedField(herb, 'indications', locale)} />
                </DetailRow>
                <DetailRow label={t('fields.cautions')}>
                  <Prose text={localizedField(herb, 'cautions', locale)} />
                </DetailRow>
                {herb.properties ? (
                  <DetailRow label={t('fields.properties')}>{herb.properties}</DetailRow>
                ) : null}
              </dl>
            </CardBody>
          </Card>

          {/* Stock sits directly under what the herb does, because "can I give
              this" and "have I got any" are read one after the other. */}
          {tracksInventory ? (
            <Card>
              <CardHeader>
                <CardTitle>{ts('stock')}</CardTitle>
                {level?.is_below_threshold ? (
                  <Badge tone={remaining <= 0 ? 'danger' : 'warning'}>{t('belowThreshold')}</Badge>
                ) : level?.is_stocked ? (
                  <Badge tone="success">{t('inStock')}</Badge>
                ) : (
                  <Badge tone="muted">{t('notStocked')}</Badge>
                )}
              </CardHeader>
              <CardBody className="flex flex-wrap items-end justify-between gap-3">
                <dl className="grid grid-cols-2 gap-x-6">
                  <DetailRow label={t('inStock')}>
                    <span className="text-base font-semibold tabular-nums">
                      {format.number(remaining)} {tUnit(herb.default_unit)}
                    </span>
                  </DetailRow>
                  <DetailRow label={t('fields.reorderThreshold')}>
                    {herb.reorder_threshold === null ? (
                      <Dash />
                    ) : (
                      format.number(Number(herb.reorder_threshold))
                    )}
                  </DetailRow>
                </dl>
                <OrderDialog
                  herbId={herb.id}
                  suggestedQuantity={
                    herb.reorder_quantity === null ? null : Number(herb.reorder_quantity)
                  }
                />
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle id="used-in">{t('usedIn')}</CardTitle>
              <span className="text-xs text-ink-500">{uses.length}</span>
            </CardHeader>
            <CardBody className="p-0">
              {uses.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-ink-500">{t('usedInEmpty')}</p>
              ) : catalogueUses.length === 0 ? null : (
                <TableWrapper inset responsive>
                  <SortableTable defaultSortKey="name">
                    <thead>
                      <tr>
                        <SortTh sortKey="name">{tc('name')}</SortTh>
                        <SortTh sortKey="cat">{tFormulas('fields.tcmCategory')}</SortTh>
                        <SortTh sortKey="dose">{t('usedInDose')}</SortTh>
                      </tr>
                    </thead>
                    <SortBody locale={locale}>
                      {catalogueUses.map((use) => {
                        const formula = use.formula!;
                        const formulaChinese = formulaChineseName(formula);
                        return (
                          <Tr
                            key={formula.id}
                            sort={{
                              name: formulaPrimaryName(formula, locale as Locale),
                              cat: formula.tcm_category ? tFormulaTcm(formula.tcm_category) : null,
                              dose: Number(use.dosage),
                            }}
                          >
                            <Td data-card-title>
                              {/* Pinyin and Chinese are one left-to-right run; a margin
                                  alone vanished between them in the Hebrew page, so the
                                  gap is a flex gap on a left-to-right box. */}
                              <span
                                dir="ltr"
                                className="inline-flex flex-wrap items-baseline gap-x-3"
                              >
                                <Link
                                  href={`/reference/formulas/${formula.id}`}
                                  className="font-medium text-jade-800 underline-offset-2 hover:underline"
                                >
                                  {formulaPrimaryName(formula, locale as Locale)}
                                </Link>
                                {formulaChinese ? (
                                  <span className="text-ink-600">{formulaChinese}</span>
                                ) : null}
                              </span>
                              {use.notes ? (
                                <span className="block text-sm text-ink-700">{use.notes}</span>
                              ) : null}
                            </Td>
                            <Td>
                              {formula.tcm_category ? (
                                <TcmChip
                                  scale="formulaTcmCategory"
                                  value={formula.tcm_category}
                                  size="sm"
                                >
                                  {tFormulaTcm(formula.tcm_category)}
                                </TcmChip>
                              ) : (
                                <Dash />
                              )}
                            </Td>
                            <Td>
                              <span className="font-semibold tabular-nums">
                                {format.number(Number(use.dosage))} {tUnit(use.unit)}
                              </span>
                            </Td>
                          </Tr>
                        );
                      })}
                    </SortBody>
                  </SortableTable>
                </TableWrapper>
              )}
              {modifiedUses.length > 0 ? (
                <details className="border-t border-ink-100 px-4 py-3 text-sm">
                  <summary className="cursor-pointer text-ink-700 underline-offset-2 hover:underline">
                    {t('usedInModified', { count: modifiedUses.length })}
                  </summary>
                  <p className="mt-1 text-xs text-ink-500">{t('usedInModifiedHint')}</p>
                  <ul className="mt-2 space-y-1">
                    {modifiedUses.map((use) => {
                      const formula = use.formula!;
                      return (
                        <li
                          key={formula.id}
                          className="flex flex-wrap items-baseline justify-between gap-x-3"
                        >
                          <Link
                            href={`/reference/formulas/${formula.id}`}
                            className="text-jade-800 underline-offset-2 hover:underline"
                          >
                            {formulaPrimaryName(formula, locale as Locale)}
                          </Link>
                          <span className="text-xs text-ink-600 tabular-nums">
                            {format.number(Number(use.dosage))} {tUnit(use.unit)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </details>
              ) : null}
            </CardBody>
          </Card>

          {/* Batches and the stock ledger belong to the shelf, not to the
              materia medica: a clinic without one never sees either. */}
          {tracksInventory ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>{tBatches('title')}</CardTitle>
                </CardHeader>
                <CardBody className="p-0">
                  {batches.length === 0 ? (
                    <p className="px-4 py-6 text-center text-sm text-ink-500">
                      {tBatches('empty')}
                    </p>
                  ) : (
                    <TableWrapper inset responsive>
                      <SortableTable defaultSortKey="expiry">
                        <thead>
                          <tr>
                            <SortTh sortKey="batch">{tBatches('batchNumber')}</SortTh>
                            <SortTh sortKey="remaining">{tBatches('quantityRemaining')}</SortTh>
                            <SortTh sortKey="expiry">{tBatches('expiryDate')}</SortTh>
                            <SortTh sortKey="supplier">{tBatches('supplier')}</SortTh>
                          </tr>
                        </thead>
                        <SortBody locale={locale}>
                          {batches.map((batch) => {
                            const expired =
                              batch.expiry_date && new Date(batch.expiry_date) < new Date();
                            return (
                              <Tr
                                key={batch.id}
                                sort={{
                                  batch: batch.batch_number,
                                  remaining: Number(batch.quantity_remaining),
                                  expiry: batch.expiry_date
                                    ? new Date(batch.expiry_date).getTime()
                                    : null,
                                  supplier: batch.supplier?.name ?? null,
                                }}
                              >
                                <Td data-card-title>
                                  <span dir="ltr">{batch.batch_number ?? <Dash />}</span>
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
                                      className={
                                        expired ? 'tabular-nums text-red-700' : 'tabular-nums'
                                      }
                                    >
                                      {formatDate(new Date(batch.expiry_date))}
                                    </span>
                                  ) : (
                                    <span className="text-ink-500">{tBatches('noExpiry')}</span>
                                  )}
                                </Td>
                                <Td>{batch.supplier?.name ?? <Dash />}</Td>
                              </Tr>
                            );
                          })}
                        </SortBody>
                      </SortableTable>
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
                    <p className="px-4 py-6 text-center text-sm text-ink-500">
                      {tMovements('empty')}
                    </p>
                  ) : (
                    <TableWrapper inset responsive>
                      <SortableTable defaultSortKey="date" defaultSortDirection="desc">
                        <thead>
                          <tr>
                            <SortTh sortKey="date">{tc('date')}</SortTh>
                            <SortTh sortKey="type">{tMovements('type')}</SortTh>
                            <SortTh sortKey="quantity">{tc('quantity')}</SortTh>
                          </tr>
                        </thead>
                        <SortBody locale={locale}>
                          {movements.map((movement) => {
                            const quantity = Number(movement.quantity);
                            return (
                              <Tr
                                key={movement.id}
                                sort={{
                                  date: new Date(movement.created_at).getTime(),
                                  type: tMovements(`kind.${movement.movement_type}`),
                                  quantity,
                                }}
                              >
                                <Td data-card-title>
                                  <span dir="ltr" className="tabular-nums">
                                    {formatDate(new Date(movement.created_at))}
                                  </span>
                                </Td>
                                <Td>{tMovements(`kind.${movement.movement_type}`)}</Td>
                                <Td>
                                  <span
                                    dir="ltr"
                                    className={
                                      quantity < 0
                                        ? 'tabular-nums text-red-700'
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
                        </SortBody>
                      </SortableTable>
                    </TableWrapper>
                  )}
                </CardBody>
              </Card>
            </>
          ) : null}
        </div>
      </div>
    </>
  );
}
