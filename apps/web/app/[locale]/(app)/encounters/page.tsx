import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import { ClipboardList } from 'lucide-react';
import { Badge, EmptyState, SortBody, SortTh, SortableTable, TableWrapper, Td, Tr } from '@clinic/ui';
import { Link } from '@clinic/i18n/navigation';
import type { Encounter, Patient } from '@clinic/db/types';
import { PageHeader } from '@/components/app-shell';
import { DateRangeFilter } from '@/components/date-range-filter';
import { getClinicScope } from '@/lib/session';
import { resolveRange } from '@/lib/date-range';

type EncounterRow = Encounter & {
  patient: Pick<Patient, 'id' | 'full_name'> | null;
};

export default async function EncountersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('encounters');
  const tc = await getTranslations('common');
  const tPatients = await getTranslations('patients');
  const tFilters = await getTranslations('filters');
  const format = await getFormatter();

  const scope = await getClinicScope();
  if (!scope) return null;

  // Filtering happens in the query, not in the browser. A practitioner who has
  // been in practice for five years has thousands of these, and "show me today"
  // should not mean fetching all of them and hiding most.
  const range = resolveRange(await searchParams);

  let query = scope.supabase
    .from('encounters')
    .select('*, patient:patients(id, full_name)')
    .order('encounter_date', { ascending: false })
    .order('started_at', { ascending: false })
    .limit(500);

  if (range.from) query = query.gte('encounter_date', range.from);
  if (range.to) query = query.lte('encounter_date', range.to);

  const { data } = await query.returns<EncounterRow[]>();

  const encounters = data ?? [];

  return (
    <>
      <PageHeader title={t('title')} />

      <DateRangeFilter className="mb-4" />

      {encounters.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="h-8 w-8" />}
          title={range.preset === 'all' ? t('empty') : tFilters('noneInRange')}
        />
      ) : (
        <TableWrapper>
          <SortableTable defaultSortKey="date" defaultSortDirection="desc">
            <thead>
              <tr>
                <SortTh sortKey="date">{tc('date')}</SortTh>
                <SortTh sortKey="patient">{tPatients('title')}</SortTh>
                <SortTh sortKey="status">{tc('status')}</SortTh>
              </tr>
            </thead>
            <SortBody locale={locale}>
              {encounters.map((encounter) => (
                <Tr
                  key={encounter.id}
                  sort={{
                    // Sort on the instant, so two records on one day order by
                    // the time they were opened rather than arbitrarily.
                    date: new Date(encounter.started_at ?? encounter.encounter_date).getTime(),
                    patient: encounter.patient?.full_name ?? null,
                    status: t(`status.${encounter.status}`),
                  }}
                >
                  <Td>
                    {/* Date and time together: on a day with six patients the
                        date alone cannot tell two records apart. */}
                    <Link
                      href={`/encounters/${encounter.id}`}
                      className="font-medium text-jade-800 underline-offset-2 hover:underline"
                      dir="ltr"
                    >
                      {format.dateTime(new Date(encounter.encounter_date), 'short')}
                    </Link>
                    {encounter.started_at ? (
                      <span dir="ltr" className="ms-2 text-xs tabular-nums text-ink-600">
                        {format.dateTime(new Date(encounter.started_at), 'time')}
                      </span>
                    ) : null}
                  </Td>
                  <Td>
                    {encounter.patient ? (
                      <Link
                        href={`/patients/${encounter.patient.id}`}
                        className="text-ink-800 underline-offset-2 hover:underline"
                      >
                        {encounter.patient.full_name}
                      </Link>
                    ) : (
                      '—'
                    )}
                  </Td>
                  <Td>
                    <Badge tone={encounter.status === 'signed' ? 'success' : 'warning'}>
                      {t(`status.${encounter.status}`)}
                    </Badge>
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
