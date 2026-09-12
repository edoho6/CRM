import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import { Plus, Sprout } from 'lucide-react';
import {
  Badge,
  Button,
  EmptyState,
  Table,
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
import { SortLinkTh } from '@/components/sort-link-th';
import { compareComputed, parseSort, type SortState } from '@/lib/sort-params';
import { TcmChip, TcmChips } from '@/components/tcm-chip';
import { pageTitle } from '@/lib/page-title';
import { doseRangeLabel } from '@/features/inventory/dose-range';

export const generateMetadata = pageTitle('inventory.herbs', 'title');

/** Every chip links back into this list, filtered by what the chip says. */
const HERBS_PATH = '/reference/herbs';

/**
 * Columns the list can be ordered by, and the database column behind each.
 * Temperature and stock have no column that sorts the way a person means —
 * hot to cold is not alphabetical, and stock lives in another table — so
 * those two are ordered here, over every matching herb, before the page is cut.
 */
const HERB_SORT_KEYS = ['name', 'cat', 'temp', 'taste', 'dose', 'stock'] as const;
type HerbSortKey = (typeof HERB_SORT_KEYS)[number];
const HERB_SORT_COLUMNS: Record<HerbSortKey, string | null> = {
  name: 'pinyin_name',
  cat: 'tcm_category',
  temp: null,
  taste: 'tastes',
  dose: 'dosage_min_g',
  stock: null,
};
const HERB_DEFAULT_SORT: SortState<HerbSortKey> = { key: 'name', dir: 'asc' };
import { getClinicScope } from '@/lib/session';
import { herbBotanicalName, herbChineseName, herbPrimaryName } from '@/lib/display';
import { ReferenceNav } from '@/features/reference/reference-nav';
import { CatalogueSearch } from '@/features/reference/catalogue-search';
import { referenceImageFor } from '@/features/inventory/herb-reference-image';
import { HerbCompareButton, HerbGalleryProvider, HerbThumb } from '@/features/inventory/herb-gallery';
import { loadHerbGalleryEntries } from '@/features/inventory/herb-gallery-entries';
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

  const tracksInventory = scope.context.clinic.tracks_inventory !== false;
  const sort = parseSort(
    rawParams as { sort?: string; dir?: string },
    tracksInventory ? HERB_SORT_KEYS : HERB_SORT_KEYS.filter((key) => key !== 'stock'),
    HERB_DEFAULT_SORT,
  );

  /** The catalogue narrowed by the URL's filters; the caller chooses what to select. */
  const filtered = (select: string) => {
    let query = scope.supabase.from('herbs').select(select, { count: 'exact' });
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
    return query;
  };

  /**
   * The library says nothing about stock unless the clinic keeps any. When it
   * does, the position is fetched separately and merged here rather than by
   * querying the view: the filters above read columns (tastes, channels) that
   * only the base table carries.
   */
  let stockByHerb = new Map<string, { remaining: number; unit: string; low: boolean }>();
  if (tracksInventory) {
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

  let herbs: Herb[] = [];
  let count: number | null = null;
  const column = HERB_SORT_COLUMNS[sort.key];
  if (column) {
    const result = await filtered('*')
      .order(column, { ascending: sort.dir === 'asc', nullsFirst: false })
      .order('pinyin_name', { ascending: true })
      .range(...pageRange(page, CATALOGUE_PAGE))
      .returns<Herb[]>();
    herbs = result.data ?? [];
    count = result.count;
  } else {
    // Ordered here: every matching herb by its computed value, then only the
    // page's rows fetched in full and put back in that order.
    const light = await filtered('id, pinyin_name, temperature')
      .limit(5000)
      .returns<Pick<Herb, 'id' | 'pinyin_name' | 'temperature'>[]>();
    const collator = new Intl.Collator(locale);
    const valueOf = (row: Pick<Herb, 'temperature' | 'id'>) =>
      sort.key === 'temp'
        ? row.temperature
          ? TEMPERATURES.indexOf(row.temperature)
          : null
        : (stockByHerb.get(row.id)?.remaining ?? null);
    const ordered = [...(light.data ?? [])].sort(
      (a, b) =>
        compareComputed(valueOf(a), valueOf(b), sort.dir, collator) ||
        collator.compare(a.pinyin_name ?? '', b.pinyin_name ?? ''),
    );
    count = light.count ?? ordered.length;
    const [from, to] = pageRange(page, CATALOGUE_PAGE);
    const ids = ordered.slice(from, to + 1).map((row) => row.id);
    if (ids.length) {
      const rows = await filtered('*').in('id', ids).returns<Herb[]>();
      const byId = new Map((rows.data ?? []).map((row) => [row.id, row]));
      herbs = ids.map((id) => byId.get(id)).filter((row): row is Herb => Boolean(row));
    }
  }

  // Every herb with a photograph, for the gallery's search box.
  const galleryEntries = await loadHerbGalleryEntries(scope.supabase, locale);

  return (
    <HerbGalleryProvider entries={galleryEntries}>
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

      <div className="mb-4 space-y-3">
        <RememberQuery
          id="herbs"
          keys={['q', 'cat', 'temp', 'taste', 'chan', 'review', 'sort', 'dir']}
        />
        {/* The catalogue switch and the search share a row: one line of
            furniture over the list instead of three. */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <ReferenceNav />
          <div className="flex flex-wrap items-center gap-2">
            <HerbCompareButton />
            <CatalogueSearch initialQuery={filters.q} placeholder={t('searchPlaceholder')} />
          </div>
        </div>
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
          <Table>
            <thead>
              <tr>
                <th scope="col" className="w-10 border-b border-ink-200 bg-ink-50 px-3 py-2">
                  <span className="sr-only">{tCompare('column')}</span>
                </th>
                <SortLinkTh sortKey="name" sort={sort} defaultSort={HERB_DEFAULT_SORT}>{tc('name')}</SortLinkTh>
                <SortLinkTh sortKey="cat" sort={sort} defaultSort={HERB_DEFAULT_SORT}>{t('fields.tcmCategory')}</SortLinkTh>
                <SortLinkTh sortKey="temp" sort={sort} defaultSort={HERB_DEFAULT_SORT}>{t('fields.temperature')}</SortLinkTh>
                <SortLinkTh sortKey="taste" sort={sort} defaultSort={HERB_DEFAULT_SORT}>{t('fields.tastes')}</SortLinkTh>
                <SortLinkTh sortKey="dose" sort={sort} defaultSort={HERB_DEFAULT_SORT}>{t('fields.dosageRange')}</SortLinkTh>
                {tracksInventory ? <SortLinkTh sortKey="stock" sort={sort} defaultSort={HERB_DEFAULT_SORT}>{t('inStock')}</SortLinkTh> : null}
              </tr>
            </thead>
            <tbody>
              {herbs.map((herb) => {
                const chinese = herbChineseName(herb);
                const botanical = herbBotanicalName(herb);
                const tastes = herb.tastes ?? [];
                const stock = stockByHerb.get(herb.id);
                const dose = doseRangeLabel(herb, (n) => format.number(n), tUnit('gram'));
                return (
                  <Tr
                    key={herb.id}>
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
                          <HerbThumb
                            herbId={herb.id}
                            src={herb.image_url ?? referenceImageFor(herb)!.src}
                            alt={herbPrimaryName(herb, locale as Locale)}
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
            </tbody>
          </Table>
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
    </HerbGalleryProvider>
  );
}
