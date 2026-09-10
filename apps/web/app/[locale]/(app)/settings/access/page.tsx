import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AlertTriangle, ShieldCheck } from 'lucide-react';
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  SortBody,
  SortTh,
  SortableTable,
  TableWrapper,
  Td,
  Tr,
} from '@clinic/ui';
import { Link } from '@clinic/i18n/navigation';
import { PageHeader } from '@/components/app-shell';
import { PAGE_SIZE, Pagination, pageFrom, pageRange } from '@/components/pagination';
import { getClinicScope } from '@/lib/session';
import { SettingsNav } from '@/features/settings/settings-nav';
import { formatDateTime } from '@clinic/i18n';

/**
 * Who read what, and when.
 *
 * The audit trail has always recorded changes; this screen exists because
 * reading a medical record is itself an act worth accounting for, and because
 * an account nobody can look at is not an account. It answers two questions:
 * what happened to this clinic's records recently, and is any of it odd.
 *
 * The anomaly rules are deliberately blunt and their thresholds are printed on
 * the page. A practitioner who can see the rule can judge whether a row matters;
 * a screen of unexplained red flags gets ignored within a week.
 */

interface ActivityRow {
  id: string;
  table_name: string;
  record_id: string;
  action: 'insert' | 'update' | 'delete' | 'sign' | 'view' | 'export';
  changed_at: string;
  changed_by: string | null;
  actor_name: string;
  patient_name: string | null;
}

interface AnomalyRow {
  changed_by: string | null;
  window_start: string;
  records_touched: number;
  kind: 'bulk_access' | 'after_hours';
}


export default async function AccessLogPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ action?: string; page?: string }>;
}) {
  const { locale } = await params;
  const { action = '', page: pageParam } = await searchParams;
  const page = pageFrom(pageParam);
  const [from, to] = pageRange(page);
  setRequestLocale(locale);

  const t = await getTranslations('settings.access');
  const tc = await getTranslations('common');

  const scope = await getClinicScope();
  if (!scope) return null;

  let query = scope.supabase
    .from('access_activity')
    .select('*', { count: 'exact' })
    .order('changed_at', { ascending: false })
    .range(from, to);

  if (action === 'reads') query = query.in('action', ['view', 'export']);
  else if (action === 'writes') query = query.in('action', ['insert', 'update', 'delete', 'sign']);

  const [activityResult, anomalyResult, actorsResult] = await Promise.all([
    query.returns<ActivityRow[]>(),
    scope.supabase
      .from('access_anomalies')
      .select('*')
      .order('window_start', { ascending: false })
      .limit(50)
      .returns<AnomalyRow[]>(),
    scope.supabase
      .from('profiles')
      .select('id, full_name')
      .returns<{ id: string; full_name: string | null }[]>(),
  ]);

  const activity = activityResult.data ?? [];
  const activityCount = activityResult.count ?? null;
  const anomalies = anomalyResult.data ?? [];
  const actorNames = new Map((actorsResult.data ?? []).map((row) => [row.id, row.full_name ?? '']));

  return (
    <>
      <PageHeader title={t('title')} description={t('subtitle')} below={<SettingsNav />} />

      <Card className="mb-5">
        <CardHeader>
          <CardTitle>{t('anomalies.title')}</CardTitle>
          {anomalies.length === 0 ? (
            <Badge tone="success">
              <ShieldCheck className="h-3 w-3" />
              {t('anomalies.clear')}
            </Badge>
          ) : (
            <Badge tone="warning">{anomalies.length}</Badge>
          )}
        </CardHeader>
        <CardBody>
          {anomalies.length === 0 ? (
            <p className="text-sm text-ink-600">{t('anomalies.clearBody')}</p>
          ) : (
            <ul className="space-y-2">
              {anomalies.map((row) => (
                <li
                  key={`${row.kind}-${row.changed_by}-${row.window_start}`}
                  className="flex flex-wrap items-baseline gap-x-2 gap-y-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
                >
                  <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="font-medium">
                    {actorNames.get(row.changed_by ?? '') || t('unknownActor')}
                  </span>
                  <span>{t(`anomalies.kind.${row.kind}`, { count: row.records_touched })}</span>
                  <span dir="ltr" className="text-xs tabular-nums text-amber-800">
                    {formatDateTime(new Date(row.window_start))}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 border-t border-ink-100 pt-2 text-xs leading-relaxed text-ink-600">
            {t('anomalies.rules')}
          </p>
        </CardBody>
      </Card>

      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {(
          [
            { key: '', label: tc('all') },
            { key: 'reads', label: t('filters.reads') },
            { key: 'writes', label: t('filters.writes') },
          ] as const
        ).map((option) => (
          <Link
            key={option.key || 'all'}
            href={
              option.key
                ? { pathname: '/settings/access', query: { action: option.key } }
                : '/settings/access'
            }
            aria-current={action === option.key ? 'page' : undefined}
            className={
              action === option.key
                ? 'rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-fg'
                : 'rounded-full bg-ink-100 px-3 py-1 text-xs font-medium text-ink-700 transition-colors hover:bg-ink-200'
            }
          >
            {option.label}
          </Link>
        ))}
      </div>

      {activity.length === 0 ? (
        <EmptyState icon={<ShieldCheck className="h-8 w-8" />} title={t('empty')} />
      ) : (
        <TableWrapper responsive>
          <SortableTable defaultSortKey="when" defaultSortDirection="desc">
            <thead>
              <tr>
                <SortTh sortKey="when">{tc('date')}</SortTh>
                <SortTh sortKey="actor">{t('actor')}</SortTh>
                <SortTh sortKey="what">{t('action')}</SortTh>
                <SortTh sortKey="record">{t('record')}</SortTh>
              </tr>
            </thead>
            <SortBody locale={locale}>
              {activity.map((row) => {
                const isRead = row.action === 'view' || row.action === 'export';
                return (
                  <Tr
                    key={row.id}
                    sort={{
                      when: new Date(row.changed_at).getTime(),
                      actor: row.actor_name,
                      what: t(`actions.${row.action}`),
                      record: row.patient_name ?? row.table_name,
                    }}
                  >
                    <Td data-card-title>
                      <span dir="ltr" className="tabular-nums text-ink-700">
                        {formatDateTime(new Date(row.changed_at))}
                      </span>
                    </Td>
                    <Td>{row.actor_name || t('unknownActor')}</Td>
                    <Td>
                      <Badge
                        tone={row.action === 'export' ? 'warning' : isRead ? 'neutral' : 'info'}
                      >
                        {t(`actions.${row.action}`)}
                      </Badge>
                    </Td>
                    <Td>
                      {row.patient_name ? (
                        <Link
                          href={`/patients/${row.record_id}`}
                          className="text-jade-800 underline-offset-2 hover:underline"
                        >
                          {row.patient_name}
                        </Link>
                      ) : (
                        <span className="text-ink-600">
                          {t.has(`tables.${row.table_name}`)
                            ? t(`tables.${row.table_name}`)
                            : row.table_name}
                        </span>
                      )}
                    </Td>
                  </Tr>
                );
              })}
            </SortBody>
          </SortableTable>
        </TableWrapper>
      )}

      <Pagination
        page={page}
        total={activityCount}
        shown={activity.length}
        pathname="/settings/access"
        query={{ action: action || undefined }}
      />

      <p className="mt-4 text-xs leading-relaxed text-ink-600">{t('retentionNote')}</p>
    </>
  );
}
