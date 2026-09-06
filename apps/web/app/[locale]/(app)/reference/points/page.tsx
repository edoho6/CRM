import { getTranslations, setRequestLocale } from 'next-intl/server';
import { MapPin } from 'lucide-react';
import {
  Badge,
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
import { POINT_CHANNELS } from '@clinic/domain';
import { PageHeader } from '@/components/app-shell';
import { getClinicScope } from '@/lib/session';
import { ReferenceNav } from '@/features/reference/reference-nav';
import { PointSearch } from '@/features/reference/point-search';

export default async function PointsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; channel?: string }>;
}) {
  const { locale } = await params;
  const { q = '', channel = '' } = await searchParams;
  setRequestLocale(locale);

  const t = await getTranslations('reference.points');
  const tChannel = await getTranslations('reference.pointChannel');
  const tRegion = await getTranslations('encounters.region');
  const tReview = await getTranslations('inventory.review');
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

  const { data } = await query.returns<AcupuncturePoint[]>();
  const points = data ?? [];

  return (
    <>
      <PageHeader title={t('title')} description={t('count', { count: points.length })} />
      <ReferenceNav />

      <div className="mb-4">
        <PointSearch initialQuery={term} channel={channel} />
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
                <SortTh sortKey="name">{tc('name')}</SortTh>
                <SortTh sortKey="channel">{t('fields.channel')}</SortTh>
                <SortTh sortKey="region">{t('fields.region')}</SortTh>
                <SortTh sortKey="status">{tc('status')}</SortTh>
              </tr>
            </thead>
            <SortBody locale={locale}>
              {points.map((point) => (
                <Tr
                  key={point.id}
                  sort={{
                    // Channel first, then number, so ascending "code" reads as a
                    // channel walked in order rather than LU1, LU10, LU11, LU2.
                    code: `${point.channel} ${String(point.point_number ?? 0).padStart(3, '0')}`,
                    name: point.pinyin_name,
                    channel: tChannel(point.channel),
                    region: tRegion(point.default_region),
                    status: point.needs_review ? 1 : 0,
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
                    <span className="flex flex-wrap items-baseline gap-2">
                      {point.pinyin_name ? (
                        <span dir="ltr" className="font-medium text-ink-800">
                          {point.pinyin_name}
                        </span>
                      ) : null}
                      {point.chinese_name ? (
                        <span className="text-ink-600">{point.chinese_name}</span>
                      ) : null}
                    </span>
                    {point.english_name ? (
                      <span className="block text-xs text-ink-400" dir="ltr">
                        {point.english_name}
                      </span>
                    ) : null}
                  </Td>
                  <Td>{tChannel(point.channel)}</Td>
                  <Td>
                    <span className="text-ink-600">{tRegion(point.default_region)}</span>
                    {!point.bilateral ? (
                      <span className="block text-xs text-ink-400">{t('midlinePoint')}</span>
                    ) : null}
                  </Td>
                  <Td>
                    {point.needs_review ? (
                      <Badge tone="warning">{tReview('badge')}</Badge>
                    ) : (
                      <Badge tone="success">{tReview('allClear')}</Badge>
                    )}
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
