import type { SupabaseClient } from '@supabase/supabase-js';
import { getTranslations } from 'next-intl/server';
import { Badge, Card, CardBody, CardHeader, CardTitle, EmptyNote } from '@clinic/ui';
import { formatDateTime } from '@clinic/i18n';
import { Link } from '@clinic/i18n/navigation';
import { MED_KINDS, MED_STATUSES, MED_STATUS_TONES, statusTone, type MedKind, type MedStatus } from '@clinic/domain';
import { MedicineKindIcon } from './medicine-body';

interface StatRow {
  kind: MedKind;
  status: MedStatus;
  entries: number;
  last_updated: string | null;
}

interface FlaggedRow {
  id: string;
  slug: string;
  kind: MedKind;
  name_he: string | null;
  name_en: string;
  review_note: string | null;
  reviewed_at: string | null;
  reviewed_by_name: string | null;
}

/**
 * The reference's state, for whoever runs the service: how much is loaded,
 * when it was last imported, how much of it a person has approved — and the
 * entries a reviewer flagged, which are the ones waiting for work. Counts
 * and names of the corpus only; nothing here is a patient's.
 */
export async function MedicinePlatformCard({ db }: { db: SupabaseClient }) {
  const t = await getTranslations('platform.medicine');
  const tm = await getTranslations('medicine');

  const [statsResult, flaggedResult] = await Promise.all([
    db.rpc('med_stats'),
    db
      .from('med_entries')
      .select('id, slug, kind, name_he, name_en, review_note, reviewed_at, reviewed_by_name')
      .eq('status', 'flagged')
      .order('reviewed_at', { ascending: false })
      .limit(50)
      .returns<FlaggedRow[]>(),
  ]);
  const stats = (Array.isArray(statsResult.data) ? statsResult.data : []) as StatRow[];
  const flagged = flaggedResult.data ?? [];

  const total = stats.reduce((sum, row) => sum + Number(row.entries), 0);
  const lastImport = stats.reduce<string | null>((latest, row) => (row.last_updated && (!latest || row.last_updated > latest) ? row.last_updated : latest), null);
  const count = (kind: MedKind, status: MedStatus) => stats.filter((row) => row.kind === kind && row.status === status).reduce((sum, row) => sum + Number(row.entries), 0);
  const kinds = MED_KINDS.filter((kind) => stats.some((row) => row.kind === kind));
  const statusLabel: Record<MedStatus, string> = {
    draft: t('draft'),
    cross_checked: t('crossChecked'),
    verified: t('verified'),
    flagged: t('flagged'),
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
      </CardHeader>
      <CardBody className="space-y-4">
        <p className="text-sm text-ink-800">
          {t('entries', { count: total })}
          <span className="text-ink-600"> · {lastImport ? t('lastImport', { date: formatDateTime(new Date(lastImport)) }) : t('never')}</span>
        </p>

        {kinds.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">{t('byKind')}</caption>
              <thead>
                <tr className="text-xs text-ink-600">
                  <th scope="col" className="py-1 text-start font-medium">
                    {t('byKind')}
                  </th>
                  {MED_STATUSES.map((status) => (
                    <th key={status} scope="col" className="py-1 text-end font-medium">
                      {statusLabel[status]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {kinds.map((kind) => (
                  <tr key={kind} className="border-t border-ink-100">
                    <th scope="row" className="flex items-center gap-1.5 py-1.5 text-start font-medium text-ink-900">
                      <MedicineKindIcon kind={kind} className="h-4 w-4 text-sky-800" />
                      {tm(`kinds.${kind}`)}
                    </th>
                    {MED_STATUSES.map((status) => (
                      <td key={status} className="py-1.5 text-end tabular-nums text-ink-800">
                        {count(kind, status) || '–'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-ink-900">{t('flaggedList')}</h3>
          {flagged.length === 0 ? (
            <EmptyNote>{t('noFlagged')}</EmptyNote>
          ) : (
            <ul className="divide-y divide-ink-100 rounded-lg border border-ink-200 bg-white">
              {flagged.map((row) => (
                <li key={row.id} className="space-y-0.5 px-3 py-2 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <MedicineKindIcon kind={row.kind} className="h-4 w-4 text-sky-800" />
                    <Link href={`/reference/medicine/${row.slug}`} className="font-medium text-ink-900 underline-offset-2 hover:underline">
                      {row.name_he ?? row.name_en}
                    </Link>
                    <Badge tone={statusTone(MED_STATUS_TONES, 'flagged')}>{tm('status.flagged')}</Badge>
                    {row.reviewed_at ? (
                      <span className="text-xs text-ink-600">
                        {tm('review.flaggedBy', { name: row.reviewed_by_name ?? tm('review.someone'), date: formatDateTime(new Date(row.reviewed_at)) })}
                      </span>
                    ) : null}
                  </div>
                  {row.review_note ? <p className="text-ink-700">{row.review_note}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
