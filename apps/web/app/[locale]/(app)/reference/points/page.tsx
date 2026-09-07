import { getTranslations, setRequestLocale } from 'next-intl/server';
import { MapPin } from 'lucide-react';
import {
  EmptyState,
  SortBody,
  SortTh,
  SortableTable,
  TableWrapper,
  Td,
  Tr,
} from '@clinic/ui';
import { Link } from '@clinic/i18n/navigation';
import type { AcupuncturePoint } from '@clinic/db/types';
import { POINT_BODY_AREAS, POINT_CATEGORIES, POINT_CHANNELS } from '@clinic/domain';
import { PageHeader } from '@/components/app-shell';
import { getClinicScope } from '@/lib/session';
import { ReferenceNav } from '@/features/reference/reference-nav';
import { PointSearch } from '@/features/reference/point-search';

export default async function PointsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; channel?: string; area?: string; category?: string }>;
}) {
  const { locale } = await params;
  const { q = '', channel = '', area = '', category = '' } = await searchParams;
  setRequestLocale(locale);

  const t = await getTranslations('reference.points');
  const tChannel = await getTranslations('reference.pointChannel');
  const tArea = await getTranslations('reference.bodyArea');
  const tc = await getTranslations('common');

  const scope = await getClinicScope();
  if (!scope) return null;

  let query = scope.supabase
    .from('acupuncture_points')
    .select('*')
    .order('channel', { ascending: true })
    .order('point_number', { ascending: true })
    .limit(1000);

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

  const { data } = await query.returns<AcupuncturePoint[]>();
  const points = data ?? [];

  return (
    <>
      <PageHeader title={t('title')} description={t('count', { count: points.length })} />
      <ReferenceNav />

      <div className="mb-4">
        <PointSearch initialQuery={term} channel={channel} area={area} category={category} />
      </div>

      {points.length === 0 ? (
        <EmptyState
          icon={<MapPin className="h-8 w-8" />}
          title={term ? tc('noResults') : t('empty')}
          description={term ? undefined : t('emptyBody')}
        />
      ) : (
        <TableWrapper>
          <SortableTable defaultSortKey="code">
            <thead>
              <tr>
                <SortTh sortKey="code">{t('fields.code')}</SortTh>
                <SortTh sortKey="pinyin">{t('fields.pinyin')}</SortTh>
                <SortTh sortKey="chinese">{t('fields.chineseName')}</SortTh>
                <SortTh sortKey="english">{t('fields.english')}</SortTh>
                <SortTh sortKey="channel">{t('fields.channel')}</SortTh>
                <SortTh sortKey="area">{t('fields.bodyArea')}</SortTh>
              </tr>
            </thead>
            <SortBody locale={locale}>
              {points.map((point) => (
                <Tr
                  key={point.id}
                  sort={{
                    // Channel first, then number, so ascending "point" reads as a
                    // channel walked in order rather than LU1, LU10, LU11, LU2.
                    code: `${point.channel} ${String(point.point_number ?? 0).padStart(3, '0')}`,
                    pinyin: point.pinyin_name,
                    chinese: point.chinese_name,
                    english: point.english_name,
                    channel: tChannel(point.channel),
                    area: point.body_area ? tArea(point.body_area) : null,
                  }}
                >
                  <Td>
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
                      <span className="text-ink-500">—</span>
                    )}
                  </Td>
                  <Td>
                    {point.chinese_name ? (
                      <span className="text-base text-ink-800">{point.chinese_name}</span>
                    ) : (
                      <span className="text-ink-500">—</span>
                    )}
                  </Td>
                  <Td>
                    {point.english_name ? (
                      <span dir="ltr" className="text-ink-600">
                        {point.english_name}
                      </span>
                    ) : (
                      <span className="text-ink-500">—</span>
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
                      <span className="text-ink-500">—</span>
                    )}
                    {!point.bilateral ? (
                      <span className="block text-xs text-ink-500">{t('midlinePoint')}</span>
                    ) : null}
                  </Td>
                </Tr>
              ))}
            </SortBody>
          </SortableTable>
        </TableWrapper>
      )}
    </>
  );
}
