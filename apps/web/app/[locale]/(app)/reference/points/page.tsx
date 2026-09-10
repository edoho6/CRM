import { getTranslations, setRequestLocale } from 'next-intl/server';
import { MapPin } from 'lucide-react';
import { EmptyState, Table, TableWrapper, Td, Tr, Dash } from '@clinic/ui';
import { Link } from '@clinic/i18n/navigation';
import type { AcupuncturePoint } from '@clinic/db/types';
import { POINT_BODY_AREAS, POINT_CATEGORIES, POINT_CHANNELS } from '@clinic/domain';
import { PageHeader } from '@/components/app-shell';
import { CATALOGUE_PAGE, Pagination, pageFrom, pageRange } from '@/components/pagination';
import { RememberQuery } from '@/components/remember-query';
import { SortLinkTh } from '@/components/sort-link-th';
import { parseSort, type SortState } from '@/lib/sort-params';
import { getClinicScope } from '@/lib/session';
import { ReferenceNav } from '@/features/reference/reference-nav';
import { CompareToggle, CompareTray } from '@/features/reference/compare-controls';
import { PointSearch } from '@/features/reference/point-search';

/**
 * Columns the list can be ordered by; every one is a column, so the database
 * orders. The code is channel then number, so ascending reads as a channel
 * walked in order rather than LU1, LU10, LU11, LU2.
 */
const POINT_SORT_KEYS = ['code', 'pinyin', 'chinese', 'english', 'channel', 'area'] as const;
type PointSortKey = (typeof POINT_SORT_KEYS)[number];
const POINT_SORT_COLUMNS: Record<PointSortKey, string> = {
  code: 'channel',
  pinyin: 'pinyin_name',
  chinese: 'chinese_name',
  english: 'english_name',
  channel: 'channel',
  area: 'body_area',
};
const POINT_DEFAULT_SORT: SortState<PointSortKey> = { key: 'code', dir: 'asc' };

export default async function PointsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    q?: string;
    channel?: string;
    area?: string;
    category?: string;
    page?: string;
    sort?: string;
    dir?: string;
  }>;
}) {
  const { locale } = await params;
  const rawParams = await searchParams;
  const { q = '', channel = '', area = '', category = '', page: pageParam } = rawParams;
  const page = pageFrom(pageParam);
  const sort = parseSort(rawParams, POINT_SORT_KEYS, POINT_DEFAULT_SORT);
  setRequestLocale(locale);

  const t = await getTranslations('reference.points');
  const tChannel = await getTranslations('reference.pointChannel');
  const tArea = await getTranslations('reference.bodyArea');
  const tc = await getTranslations('common');
  const tCompare = await getTranslations('reference.compare');

  const scope = await getClinicScope();
  if (!scope) return null;

  const ascending = sort.dir === 'asc';
  let query = scope.supabase
    .from('acupuncture_points')
    .select('*', { count: 'exact' })
    .order(POINT_SORT_COLUMNS[sort.key], { ascending, nullsFirst: false })
    // Within equal values, and for the code itself, the channel walked in order.
    .order('channel', { ascending: sort.key === 'code' ? ascending : true })
    .order('point_number', { ascending: sort.key === 'code' ? ascending : true })
    .range(...pageRange(page, CATALOGUE_PAGE));

  const term = q.trim();
  if (term) {
    const escaped = term.replace(/[%,()]/g, ' ');
    query = query.or(
      `code.ilike.%${escaped}%,pinyin_name.ilike.%${escaped}%,english_name.ilike.%${escaped}%,chinese_name.ilike.%${escaped}%,hebrew_name.ilike.%${escaped}%`,
    );
  }
  if (channel && (POINT_CHANNELS as readonly string[]).includes(channel)) {
    query = query.eq('channel', channel);
  }
  if (area && (POINT_BODY_AREAS as readonly string[]).includes(area)) {
    query = query.eq('body_area', area);
  }
  // A point can hold several categories, so membership is an array containment
  // test rather than equality.
  if (category && (POINT_CATEGORIES as readonly string[]).includes(category)) {
    query = query.contains('point_categories', [category]);
  }

  const { data, count } = await query.returns<AcupuncturePoint[]>();
  const points = data ?? [];

  return (
    <>
      <PageHeader title={t('title')} description={t('count', { count: count ?? points.length })} />

      <div className="mb-4 space-y-3">
        <RememberQuery id="points" keys={['q', 'channel', 'area', 'category', 'sort', 'dir']} />
        {/* Three rows of filter chips over an empty catalogue are furniture with
            nothing to filter; they appear with the first point. */}
        <PointSearch
          initialQuery={term}
          channel={channel}
          area={area}
          category={category}
          withFilters={points.length > 0 || Boolean(term || channel || area || category)}
        />
      </div>

      {points.length === 0 ? (
        <EmptyState
          icon={<MapPin className="h-8 w-8" />}
          title={term ? tc('noResults') : t('empty')}
          description={term ? undefined : t('emptyBody')}
        />
      ) : (
        <TableWrapper responsive>
          <Table>
            <thead>
              <tr>
                <th scope="col" className="w-10 border-b border-ink-200 bg-ink-50 px-3 py-2">
                  <span className="sr-only">{tCompare('column')}</span>
                </th>
                <SortLinkTh sortKey="code" sort={sort} defaultSort={POINT_DEFAULT_SORT}>{t('fields.code')}</SortLinkTh>
                <SortLinkTh sortKey="pinyin" sort={sort} defaultSort={POINT_DEFAULT_SORT}>{t('fields.pinyin')}</SortLinkTh>
                <SortLinkTh sortKey="chinese" sort={sort} defaultSort={POINT_DEFAULT_SORT}>{t('fields.chineseName')}</SortLinkTh>
                <SortLinkTh sortKey="english" sort={sort} defaultSort={POINT_DEFAULT_SORT}>{t('fields.english')}</SortLinkTh>
                <SortLinkTh sortKey="channel" sort={sort} defaultSort={POINT_DEFAULT_SORT}>{t('fields.channel')}</SortLinkTh>
                <SortLinkTh sortKey="area" sort={sort} defaultSort={POINT_DEFAULT_SORT}>{t('fields.bodyArea')}</SortLinkTh>
              </tr>
            </thead>
            <tbody>
              {points.map((point) => (
                <Tr
                  key={point.id}>
                  <Td className="w-10">
                    <CompareToggle kind="point" id={point.id} label={point.code} />
                  </Td>
                  <Td data-card-title>
                    <Link
                      href={`/reference/points/${point.id}`}
                      className="text-base font-semibold text-jade-800 underline-offset-2 hover:underline"
                      dir="ltr"
                    >
                      {point.code}
                    </Link>
                  </Td>
                  <Td>
                    {point.pinyin_name ? (
                      <span dir="ltr" className="font-medium text-ink-800">
                        {point.pinyin_name}
                      </span>
                    ) : (
                      <Dash />
                    )}
                  </Td>
                  <Td>
                    {point.chinese_name ? (
                      <span className="text-base text-ink-800">{point.chinese_name}</span>
                    ) : (
                      <Dash />
                    )}
                  </Td>
                  <Td>
                    {point.english_name ? (
                      <span dir="ltr" className="text-ink-600">
                        {point.english_name}
                      </span>
                    ) : (
                      <Dash />
                    )}
                  </Td>
                  <Td>{tChannel(point.channel)}</Td>
                  <Td>
                    {point.body_area ? (
                      <Link
                        href={{ pathname: '/reference/points', query: { area: point.body_area } }}
                        className="text-ink-700 underline-offset-2 hover:text-jade-800 hover:underline"
                      >
                        {tArea(point.body_area)}
                      </Link>
                    ) : (
                      <Dash />
                    )}
                    {!point.bilateral ? (
                      <span className="block text-xs text-ink-500">{t('midlinePoint')}</span>
                    ) : null}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </TableWrapper>
      )}

      <CompareTray />
      <Pagination
        page={page}
        size={CATALOGUE_PAGE}
        total={count ?? null}
        shown={points.length}
        pathname="/reference/points"
        query={{ ...rawParams }}
      />
    </>
  );
}
