import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import { ClipboardList } from 'lucide-react';
import { Badge, EmptyState, SortBody, SortTh, SortableTable, TableWrapper, Td, Tr } from '@clinic/ui';
import { Link } from '@clinic/i18n/navigation';
import type { Appointment, Encounter, Patient } from '@clinic/db/types';
import { PageHeader } from '@/components/app-shell';
import { DateRangeFilter } from '@/components/date-range-filter';
import { getClinicScope } from '@/lib/session';
import { resolveRange, toDateKey } from '@/lib/date-range';

type EncounterRow = Encounter & {
  patient: Pick<Patient, 'id' | 'full_name'> | null;
  appointment: Pick<Appointment, 'id' | 'start_at'> | null;
};

/**
 * The time to show against a treatment.
 *
 * The appointment's time, not the moment the record was opened. Those are
 * different facts and the first is the useful one: a record is often written up
 * after the patient has left, so `started_at` says when the typing began.
 *
 * `fallback` covers records made before treatments were linked to their
 * appointment — the diary still knows what time that patient was booked for
 * that day, so the answer is recoverable rather than lost. A genuine walk-in has
 * neither, and then when the record was opened is the only time there is.
 */
function treatmentTime(encounter: EncounterRow, fallback: Map<string, string>): string | null {
  return (
    encounter.appointment?.start_at ??
    fallback.get(`${encounter.patient_id}|${encounter.encounter_date}`) ??
    encounter.started_at ??
    null
  );
}

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
    .select('*, patient:patients(id, full_name), appointment:appointments(id, start_at)')
    .order('encounter_date', { ascending: false })
    .order('started_at', { ascending: false })
    .limit(500);

  if (range.from) query = query.gte('encounter_date', range.from);
  if (range.to) query = query.lte('encounter_date', range.to);

  const { data } = await query.returns<EncounterRow[]>();

  const encounters = data ?? [];

  /*
   * The booked time for treatments that carry no link to their appointment.
   *
   * One extra query rather than one per row: every appointment in the same span,
   * keyed by patient and day. A patient with two appointments on one day is
   * skipped rather than guessed at — the wrong time on a clinical record is
   * worse than none.
   */
  const bookedTimes = new Map<string, string>();
  const unlinked = encounters.filter((encounter) => !encounter.appointment);

  if (unlinked.length > 0) {
    const dates = unlinked.map((encounter) => encounter.encounter_date).sort();
    const first = new Date(`${dates[0]}T00:00:00`);
    const last = new Date(`${dates[dates.length - 1]}T00:00:00`);
    last.setDate(last.getDate() + 1);

    const { data: appointments } = await scope.supabase
      .from('appointments')
      .select('patient_id, start_at')
      .neq('status', 'cancelled')
      .gte('start_at', first.toISOString())
      .lt('start_at', last.toISOString())
      .limit(2000)
      .returns<{ patient_id: string; start_at: string }[]>();

    const seen = new Set<string>();
    for (const appointment of appointments ?? []) {
      const day = new Date(appointment.start_at);
      const key = `${appointment.patient_id}|${toDateKey(day)}`;
      // A second appointment for the same patient on the same day makes the
      // match ambiguous, so the key is dropped rather than resolved arbitrarily.
      if (seen.has(key)) {
        bookedTimes.delete(key);
        continue;
      }
      seen.add(key);
      bookedTimes.set(key, appointment.start_at);
    }
  }

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
                    date: new Date(
                      treatmentTime(encounter, bookedTimes) ?? encounter.encounter_date,
                    ).getTime(),
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
                    {treatmentTime(encounter, bookedTimes) ? (
                      <span dir="ltr" className="ms-6 text-xs tabular-nums text-ink-600">
                        {format.dateTime(new Date(treatmentTime(encounter, bookedTimes)!), 'time')}
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
