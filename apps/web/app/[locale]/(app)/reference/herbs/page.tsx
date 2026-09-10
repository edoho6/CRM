import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import { Plus, Sprout } from 'lucide-react';
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
  Dash,
} from '@clinic/ui';
import { Link } from '@clinic/i18n/navigation';
import type { Herb, HerbStockLevel } from '@clinic/db/types';
import { TEMPERATURES, type Locale } from '@clinic/domain';
import { PageHeader } from '@/components/app-shell';
import { CATALOGUE_PAGE, Pagination, pageFrom, pageRange } from '@/components/pagination';
import { RememberQuery } from '@/components/remember-query';
import { TcmChip, TcmChips } from '@/components/tcm-chip';

/** Every chip links back into this list, filtered by what the chip says. */
const HERBS_PATH = '/reference/herbs';
import { getClinicScope } from '@/lib/session';
import { herbBotanicalName, herbChineseName, herbPrimaryName } from '@/lib/display';
import { ReferenceNav } from '@/features/reference/reference-nav';
import { CatalogueSearch } from '@/features/reference/catalogue-search';
import { referenceImageFor } from '@/features/inventory/herb-reference-image';
import { CompareToggle, CompareTray } from '@/features/reference/compare-controls';
import { HerbFilters } from '@/features/inventory/herb-filters';
import { parseHerbFilters, type HerbSearchParams } from '@/features/inventory/herb-filter-params';

export default async function HerbsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<HerbSearchParams>;
}) {
  const { locale } = await params;
  const rawParams = await searchParams;
  const filters = parseHerbFilters(rawParams);
  const page = pageFrom((rawParams as { page?: string }).page);
  setRequestLocale(locale);

  const t = await getTranslations('inventory.herbs');
  const tUnit = await getTranslations('inventory.unit');
  const tTcm = await getTranslations('inventory.tcmCategory');
  const tTemp = await getTranslations('inventory.temperature');
  const tTaste = await getTranslations('inventory.taste');
  const tReview = await getTranslations('inventory.review');
  const tc = await getTranslations('common');
  const tCompare = await getTranslations('reference.compare');
  const format = await getFormatter();

  const scope = await getClinicScope();
  if (!scope) return null;

  let query = scope.supabase
    .from('herbs')
    .select('*', { count: 'exact' })
    .order('pinyin_name', { ascending: true })
    .range(...pageRange(page, CATALOGUE_PAGE));

  if (filters.q) {
    const escaped = filters.q.replace(/[%,()]/g, ' ');
    query = query.or(
      `pinyin_name.ilike.%${escaped}%,chinese_name.ilike.%${escaped}%,english_name.ilike.%${escaped}%,hebrew_name.ilike.%${escaped}%,botanical_name.ilike.%${escaped}%`,
    );
  }
  // Values within a facet are alternatives; the facets themselves narrow.
  if (filters.cat.length) query = query.in('tcm_category', filters.cat);
  if (filters.temp.length) query = query.in('temperature', filters.temp);
  if (filters.taste.length) query = query.overlaps('tastes', filters.taste);
  if (filters.chan.length) query = query.overlaps('channels', filters.chan);
  if (filters.review) query = query.eq('needs_review', true);

  const { data, count } = await query.returns<Herb[]>();
  const herbs = data ?? [];

  /**
   * The library says nothing about stock unless the clinic keeps any. When it
   * does, the position is fetched separately and merged here rather than by
   * querying the view: the filters above read columns (tastes, channels) that
   * only the base table carries.
   */
  const tracksInventory = scope.context.clinic.tracks_inventory !== false;
  let stockByHerb = new Map<string, { remaining: number; unit: string; low: boolean }>();
  if (tracksInventory && herbs.length > 0) {
    const { data: levels } = await scope.supabase
      .from('herb_stock_levels')
      .select('herb_id, total_remaining, default_unit, is_below_threshold, is_stocked')
      .eq('is_stocked', true)
      .limit(2000)
      .returns<
        Pick<
          HerbStockLevel,
          'herb_id' | 'total_remaining' | 'default_unit' | 'is_below_threshold' | 'is_stocked'
        >[]
      >();
    stockByHerb = new Map(
      (levels ?? []).map((level) => [
        level.herb_id,
        {
          remaining: Number(level.total_remaining),
          unit: level.default_unit,
          low: level.is_below_threshold,
        },
      ]),
    );
  }

  return (
    <>
      <PageHeader
        title={t('title')}
        description={t('count', { count: count ?? herbs.length })}
        actions={
          <Button asChild>
            <Link href="/reference/herbs/new">
              <Plus className="h-4 w-4" />
              {t('new')}
            </Link>
          </Button>
        }
      />
      <ReferenceNav />

      <div className="mb-4 space-y-3">
        <RememberQuery id="herbs" keys={['q', 'cat', 'temp', 'taste', 'chan', 'review']} />
        <CatalogueSearch initialQuery={filters.q} placeholder={t('searchPlaceholder')} />
        <HerbFilters filters={filters} />
      </div>

      {herbs.length === 0 ? (
        <EmptyState
          icon={<Sprout className="h-8 w-8" />}
          title={filters.q ? tc('noResults') : t('empty')}
          description={filters.q ? undefined : t('emptyBody')}
          action={
            filters.q ? undefined : (
              <Button asChild size="sm">
                <Link href="/reference/herbs/new">{t('new')}</Link>
              </Button>
            )
          }
        />
      ) : (
        <TableWrapper responsive>
          <SortableTable defaultSortKey="name" sortDisabled={(count ?? 0) > CATALOGUE_PAGE}>
            <thead>
              <tr>
                <th scope="col" className="w-10 border-b border-ink-200 bg-ink-50 px-3 py-2">
                  <span className="sr-only">{tCompare('column')}</span>
                </th>
                <SortTh sortKey="name">{tc('name')}</SortTh>
                <SortTh sortKey="cat">{t('fields.tcmCategory')}</SortTh>
                <SortTh sortKey="temp">{t('fields.temperature')}</SortTh>
                <SortTh sortKey="taste">{t('fields.tastes')}</SortTh>
                <SortTh sortKey="dose">{t('fields.dosageRange')}</SortTh>
                {tracksInventory ? <SortTh sortKey="stock">{t('inStock')}</SortTh> : null}
              </tr>
            </thead>
            <SortBody locale={locale}>
              {herbs.map((herb) => {
                const chinese = herbChineseName(herb);
                const botanical = herbBotanicalName(herb);
                const tastes = herb.tastes ?? [];
                const stock = stockByHerb.get(herb.id);
                const dose =
                  herb.dosage_min_g !== null || herb.dosage_max_g !== null
                    ? `${herb.dosage_min_g !== null ? format.number(Number(herb.dosage_min_g)) : '?'}–${
                        herb.dosage_max_g !== null ? format.number(Number(herb.dosage_max_g)) : '?'
                      } g`
                    : null;
                return (
                  <Tr
                    key={herb.id}
                    sort={{
                      name: herbPrimaryName(herb, locale as Locale),
                      cat: herb.tcm_category ? tTcm(herb.tcm_category) : null,
                      // Sorted by how hot it is, not by how the word is spelled.
                      temp: herb.temperature ? TEMPERATURES.indexOf(herb.temperature) : null,
                      taste: tastes.map((value) => tTaste(value)).join(' '),
                      dose: herb.dosage_min_g === null ? null : Number(herb.dosage_min_g),
                      // Herbs the clinic does not stock sort below the ones it
                      // does, rather than tying with the ones that ran out.
                      stock: stock ? stock.remaining : null,
                    }}
                  >
                    <Td className="w-10">
                      <CompareToggle
                        kind="herb"
                        id={herb.id}
                        label={herbPrimaryName(herb, locale as Locale)}
                      />
                    </Td>
                    <Td data-card-title>
                      <div className="flex items-start gap-3">
                        {herb.image_url || referenceImageFor(herb) ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={herb.image_url ?? referenceImageFor(herb)!.src}
                            alt=""
                            loading="lazy"
                            className="h-12 w-12 shrink-0 rounded-lg border border-ink-100 object-cover"
                          />
                        ) : (
                          <span
                            aria-hidden
                            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-jade-50 text-jade-700"
                          >
                            <Sprout className="h-5 w-5" />
                          </span>
                        )}
                        <div className="min-w-0">
                          {/* Pinyin leads at full size with the Chinese characters
                              beside it; the botanical binomial gets its own line,
                              because it answers a different question. */}
                          <Link
                            href={`/reference/herbs/${herb.id}`}
                            className="flex items-baseline gap-2 underline-offset-2 hover:underline"
                          >
                            <span className="text-base font-semibold text-jade-800">
                              {herbPrimaryName(herb, locale as Locale)}
                            </span>
                            {chinese ? (
                              <span className="text-base text-ink-600">{chinese}</span>
                            ) : null}
                          </Link>
                          {herb.needs_review ? (
                            <Badge tone="warning" className="mt-0.5">
                              {tReview('badge')}
                            </Badge>
                          ) : null}
                          {botanical ? (
                            <span className="mt-0.5 block text-xs text-ink-500 italic" dir="ltr">
                              {botanical}
                            </span>
                          ) : null}
                          {herb.english_name ? (
                            <span className="block text-xs text-ink-500" dir="ltr">
                              {herb.english_name}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </Td>
                    <Td>
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
                    </Td>
                    <Td>
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
                    </Td>
                    <Td>
                      <TcmChips
                        scale="taste"
                        values={tastes}
                        render={(value) => tTaste(value as never)}
                        hrefFor={(value) => ({ pathname: HERBS_PATH, query: { taste: value } })}
                        size="sm"
                      />
                    </Td>
                    <Td>
                      {dose ? (
                        <span dir="ltr" className="text-sm font-semibold tabular-nums text-ink-800">
                          {dose}
                        </span>
                      ) : (
                        <Dash />
                      )}
                    </Td>
                    {tracksInventory ? (
                      <Td>
                        {stock ? (
                          <span
                            dir="ltr"
                            className={
                              stock.remaining <= 0
                                ? 'font-semibold tabular-nums text-red-700'
                                : stock.low
                                  ? 'font-semibold tabular-nums text-amber-700'
                                  : 'font-semibold tabular-nums text-jade-700'
                            }
                          >
                            {format.number(stock.remaining)} {tUnit(stock.unit as never)}
                          </span>
                        ) : (
                          <span className="text-xs text-ink-500">{t('notStocked')}</span>
                        )}
                      </Td>
                    ) : null}
                  </Tr>
                );
              })}
            </SortBody>
          </SortableTable>
        </TableWrapper>
      )}

      {/* Fixed to the bottom of the window, so ticking a row far down the
          catalogue still leaves the Compare button in reach. */}
      <CompareTray />
      <Pagination
        page={page}
        size={CATALOGUE_PAGE}
        total={count ?? null}
        shown={herbs.length}
        pathname="/reference/herbs"
        query={{ ...rawParams }}
      />
    </>
  );
}
