import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AlertTriangle, ClipboardList } from 'lucide-react';
import { Badge, Button, Card, CardBody, CardHeader, CardTitle, DetailRow } from '@clinic/ui';
import { Link } from '@clinic/i18n/navigation';
import type { AcupuncturePoint } from '@clinic/db/types';
import { PageHeader } from '@/components/app-shell';
import { getClinicScope } from '@/lib/session';
import { ReferenceNav } from '@/features/reference/reference-nav';
import { BodyMap, type MappedPoint } from '@/features/reference/body-map';

/**
 * A point's page.
 *
 * The clinical text is empty for every point in the bundled catalogue — that
 * content is being written separately. Rather than pretend otherwise, the page
 * says so plainly and offers the edit form, so a practitioner filling in their
 * own notes has somewhere to put them from day one.
 */

function Prose({ text }: { text: string | null }) {
  if (!text) return <span className="text-ink-500">—</span>;
  return <span className="whitespace-pre-wrap">{text}</span>;
}

export default async function PointDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('reference.points');
  const tChannel = await getTranslations('reference.pointChannel');
  const tRegion = await getTranslations('encounters.region');
  const tArea = await getTranslations('reference.bodyArea');
  const tPointCategory = await getTranslations('reference.pointCategory');
  const tReview = await getTranslations('inventory.review');
  const tc = await getTranslations('common');

  const scope = await getClinicScope();
  if (!scope) return null;

  const { data: point } = await scope.supabase
    .from('acupuncture_points')
    .select('*')
    .eq('id', id)
    .maybeSingle<AcupuncturePoint>();

  if (!point) notFound();

  const neighbours = await scope.supabase
    .from('acupuncture_points')
    .select('id, code, point_number')
    .eq('channel', point.channel)
    .order('point_number', { ascending: true })
    .returns<Pick<AcupuncturePoint, 'id' | 'code' | 'point_number'>[]>();

  const channelPoints = neighbours.data ?? [];
  const position = channelPoints.findIndex((entry) => entry.id === point.id);
  const previous = position > 0 ? channelPoints[position - 1] : null;
  const next =
    position >= 0 && position < channelPoints.length - 1 ? channelPoints[position + 1] : null;

  const mapped: MappedPoint[] =
    point.x !== null && point.y !== null
      ? [
          {
            key: point.id,
            pointId: point.id,
            code: point.code,
            label: point.pinyin_name ?? point.code,
            view: point.body_view,
            x: Number(point.x),
            y: Number(point.y),
            bilateral: point.bilateral,
            region: point.default_region,
          },
        ]
      : [];

  const hasClinicalText = Boolean(
    point.location || point.actions || point.indications || point.needling || point.cautions,
  );

  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span dir="ltr">{point.code}</span>
            {point.pinyin_name ? (
              <span className="font-normal text-ink-700" dir="ltr">
                {point.pinyin_name}
              </span>
            ) : null}
            {point.chinese_name ? (
              <span className="font-normal text-ink-600">{point.chinese_name}</span>
            ) : null}
          </span>
        }
        description={
          <span dir="ltr">
            {point.english_name ?? ''}
            {point.english_name ? ' · ' : ''}
            {tChannel(point.channel)}
          </span>
        }
        actions={
          <div className="flex items-center gap-1">
            {previous ? (
              <Button asChild variant="secondary" size="sm">
                <Link href={`/reference/points/${previous.id}`}>
                  <span dir="ltr">{previous.code}</span>
                </Link>
              </Button>
            ) : null}
            {next ? (
              <Button asChild variant="secondary" size="sm">
                <Link href={`/reference/points/${next.id}`}>
                  <span dir="ltr">{next.code}</span>
                </Link>
              </Button>
            ) : null}
          </div>
        }
      />
      <ReferenceNav />

      {!hasClinicalText ? (
        <p className="mb-4 flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {t('noClinicalText')}
        </p>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>{t('sections.clinical')}</CardTitle>
              {point.needs_review ? (
                <Badge tone="warning">
                  <AlertTriangle className="h-3 w-3" />
                  {tReview('badge')}
                </Badge>
              ) : null}
            </CardHeader>
            <CardBody>
              {point.point_categories.length > 0 ? (
                <div className="mb-3 flex flex-wrap gap-1.5">
                  {point.point_categories.map((entry) => (
                    <Link
                      key={entry}
                      href={{ pathname: '/reference/points', query: { category: entry } }}
                      className="rounded-full bg-jade-50 px-2 py-0.5 text-xs font-medium text-jade-800 ring-1 ring-jade-200 transition-all hover:-translate-y-px hover:shadow-xs"
                    >
                      {tPointCategory(entry)}
                    </Link>
                  ))}
                </div>
              ) : null}
              <dl>
                <DetailRow label={t('fields.location')}>
                  <Prose text={point.location} />
                </DetailRow>
                <DetailRow label={t('fields.actions')}>
                  <Prose text={point.actions} />
                </DetailRow>
                <DetailRow label={t('fields.indications')}>
                  <Prose text={point.indications} />
                </DetailRow>
                <DetailRow label={t('fields.needling')}>
                  <Prose text={point.needling} />
                </DetailRow>
                <DetailRow label={t('fields.cautions')}>
                  <Prose text={point.cautions} />
                </DetailRow>
              </dl>
              {hasClinicalText ? (
                <p className="mt-3 border-t border-ink-100 pt-2 text-xs leading-relaxed text-ink-600">
                  {t('clinicalSource')}
                </p>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('sections.identity')}</CardTitle>
            </CardHeader>
            <CardBody>
              <dl className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
                <DetailRow label={t('fields.code')}>
                  <span dir="ltr">{point.code}</span>
                </DetailRow>
                <DetailRow label={t('fields.channel')}>{tChannel(point.channel)}</DetailRow>
                <DetailRow label={t('fields.pinyin')}>
                  <span dir="ltr">{point.pinyin_name ?? '—'}</span>
                </DetailRow>
                <DetailRow label={t('fields.chinese')}>{point.chinese_name ?? '—'}</DetailRow>
                <DetailRow label={t('fields.english')}>
                  <span dir="ltr">{point.english_name ?? '—'}</span>
                </DetailRow>
                <DetailRow label={t('fields.bodyArea')}>
                  {point.body_area ? tArea(point.body_area) : '—'}
                  {!point.bilateral ? ` · ${t('midlinePoint')}` : ''}
                </DetailRow>
                <DetailRow label={t('fields.region')}>{tRegion(point.default_region)}</DetailRow>
              </dl>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-5">
          <BodyMap points={mapped} />

          <Card>
            <CardBody>
              <p className="text-sm text-ink-600">{t('useInTreatment')}</p>
              <Button asChild variant="secondary" size="sm" className="mt-2">
                <Link href="/encounters">
                  <ClipboardList className="h-4 w-4" />
                  {tc('viewAll')}
                </Link>
              </Button>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
