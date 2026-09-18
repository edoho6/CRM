import { getFormatter, getTranslations } from 'next-intl/server';
import { CalendarDays } from 'lucide-react';
import { Badge, Dash, EmptyState, Table, TableWrapper, Td, Th, Tr, cn } from '@clinic/ui';
import { ENCOUNTER_STATUS_TONES, dateKeyIn, statusTone } from '@clinic/domain';
import { formatDate } from '@clinic/i18n';
import { Link } from '@clinic/i18n/navigation';
import type { Appointment, Encounter, Patient } from '@clinic/db/types';
import { DateRangeFilter } from '@/components/date-range-filter';
import { Pagination } from '@/components/pagination';
import { PaymentAction } from '@/features/billing/payment-status';
import { toPaymentSummary, type PaymentStatusRow } from '@/features/billing/payment-summary';
import { ConfirmationBadge } from './confirmation-status';
import { ListDayToggle } from './list-day-toggle';

export type DiaryListRow = Pick<
  Appointment,
  'id' | 'start_at' | 'status' | 'reminder_sent_at' | 'confirmation_response'
> & {
  patient: Pick<Patient, 'id' | 'full_name'> | null;
  /*
   * One-to-one (`encounters.appointment_id` is unique), so PostgREST embeds it
   * as an object or null — but an older schema without the unique index sends
   * a list, and `row.encounter[0]` on null is what once took the treatment
   * page down. `encounterOf` reads both.
   */
  encounter: Pick<Encounter, 'id' | 'status'> | Pick<Encounter, 'id' | 'status'>[] | null;
};

function encounterOf(row: DiaryListRow): Pick<Encounter, 'id' | 'status'> | null {
  return Array.isArray(row.encounter) ? (row.encounter[0] ?? null) : row.encounter;
}

/**
 * The diary as a list: what the treatments page used to be.
 *
 * The treatments page and the diary answered the same question from two
 * menus — who came, when, whether the record is signed, whether they paid —
 * so the list moved here and the menu lost a line. It reads the diary's own
 * rows, the appointments, and the treatment record hangs off each one.
 *
 * Grouped by day: each day opens with its name and date, and a little air
 * before it rather than a rule — a line between every group was one more line
 * among the row lines. Opened with nothing chosen, it starts at today and runs
 * forward, today's group tinted and labelled, so the first thing on the page is
 * who is coming in now and the next thing is who comes after. The past is the
 * filter's other choices, latest first. Filtered and paged in the query, like
 * the page it replaces; a practice five years in has thousands of these.
 */
export async function DiaryList({
  rows,
  matching,
  page,
  payments,
  canBill,
  showRecords,
  showPayments,
  query,
  timeZone,
  todayKey,
}: {
  rows: DiaryListRow[];
  matching: number | null;
  page: number;
  /** Keyed by appointment; absent when this person does not see money. */
  payments: Map<string, PaymentStatusRow>;
  canBill: boolean;
  /** The treatment record's column — not for the front desk (migration 78). */
  showRecords: boolean;
  showPayments: boolean;
  /** The URL's filter, carried through the page links. */
  query: Record<string, string | undefined>;
  /** The clinic's, so a row's day is the clinic's day and not the server's. */
  timeZone: string;
  /** Today in the clinic's zone, as `YYYY-MM-DD`, for the tint and the label. */
  todayKey: string;
}) {
  const t = await getTranslations('appointments');
  const tc = await getTranslations('common');
  const tEncounters = await getTranslations('encounters');
  const tPatients = await getTranslations('patients');
  const tBilling = await getTranslations('billing');
  const tFilters = await getTranslations('filters');
  const format = await getFormatter();

  const filtered = Boolean(query.range) || Boolean(query.from || query.to);
  const columns = 3 + (showRecords ? 1 : 0) + (showPayments ? 1 : 0);

  // Rows arrive in order; consecutive rows of one day make a group.
  const days: { key: string; date: Date; rows: DiaryListRow[] }[] = [];
  for (const row of rows) {
    const date = new Date(row.start_at);
    const key = dateKeyIn(date, timeZone);
    const last = days.at(-1);
    if (last && last.key === key) last.rows.push(row);
    else days.push({ key, date, rows: [row] });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <DateRangeFilter upcoming />
        {matching !== null && matching > rows.length ? (
          <p className="text-xs text-ink-600">
            {tc('showingOf', { shown: rows.length, total: matching })}
          </p>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<CalendarDays className="h-8 w-8" />}
          title={filtered ? tFilters('noneInRange') : t('list.noneAhead')}
        />
      ) : (
        <TableWrapper responsive>
          <Table>
            <thead>
              <tr>
                <Th className="w-20 pe-1">{tc('time')}</Th>
                <Th>{tPatients('singular')}</Th>
                {showRecords ? <Th>{t('list.record')}</Th> : null}
                <Th>{t('confirmation.title')}</Th>
                {showPayments ? <Th>{tBilling('title')}</Th> : null}
              </tr>
            </thead>
            {days.map((day, dayIndex) => {
              const isToday = day.key === todayKey;
              const bodyId = `list-day-${day.key}`;
              const dayName = `${format.dateTime(day.date, { weekday: 'long' })} ${formatDate(day.date)}`;
              return (
                <tbody key={day.key} id={bodyId}>
                  {/* The day's own heading: its name beside its date, and the
                      way into that day in the diary. The space above it is
                      what separates the days. */}
                  <tr data-list-day className={cn(isToday && 'bg-sky-50')}>
                    <th
                      scope="colgroup"
                      colSpan={columns}
                      className={cn(
                        'border-b border-ink-200 px-3 pb-1.5 text-start text-sm font-semibold text-ink-900',
                        dayIndex === 0 ? 'pt-2' : 'pt-6',
                      )}
                    >
                      <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
                        <ListDayToggle
                          bodyId={bodyId}
                          label={{
                            fold: t('list.fold', { day: dayName }),
                            unfold: t('list.unfold', { day: dayName }),
                          }}
                        />
                        <Link
                          href={{ pathname: '/calendar', query: { view: 'day', date: day.key } }}
                          className="underline-offset-2 hover:underline"
                        >
                          {format.dateTime(day.date, { weekday: 'long' })}
                          {', '}
                          <span dir="ltr" className="tabular-nums">
                            {formatDate(day.date)}
                          </span>
                        </Link>
                        {isToday ? <Badge tone="info">{tc('today')}</Badge> : null}
                        <span className="text-xs font-normal text-ink-600">
                          {t('countInDay', { count: day.rows.length })}
                        </span>
                      </span>
                    </th>
                  </tr>
                  {day.rows.map((row) => {
                    const encounter = encounterOf(row);
                    const start = new Date(row.start_at);
                    const noShow = row.status === 'no_show';
                    return (
                      <Tr key={row.id} className={cn(isToday && 'bg-sky-50/50')}>
                        <Td className="w-20 pe-1">
                          <span dir="ltr" className="font-medium tabular-nums text-ink-800">
                            {format.dateTime(start, 'time')}
                          </span>
                        </Td>
                        <Td data-card-title>
                          {row.patient ? (
                            <Link
                              href={`/patients/${row.patient.id}`}
                              className="text-ink-900 underline-offset-2 hover:underline"
                            >
                              {row.patient.full_name}
                            </Link>
                          ) : (
                            <Dash />
                          )}
                          {noShow ? (
                            <Badge tone="warning" className="ms-2">
                              {t('status.no_show')}
                            </Badge>
                          ) : null}
                        </Td>
                        {showRecords ? (
                          <Td>
                            {encounter ? (
                              <Link
                                href={`/encounters/${encounter.id}`}
                                className="inline-flex rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                              >
                                <Badge tone={statusTone(ENCOUNTER_STATUS_TONES, encounter.status)}>
                                  {tEncounters(`status.${encounter.status}`)}
                                </Badge>
                              </Link>
                            ) : (
                              <Dash />
                            )}
                          </Td>
                        ) : null}
                        <Td>
                          <ConfirmationBadge appointment={row} />
                        </Td>
                        {showPayments ? (
                          <Td>
                            <PaymentAction
                              summary={toPaymentSummary(payments.get(row.id))}
                              encounterId={encounter?.id ?? null}
                              appointmentId={row.id}
                              canBill={canBill}
                            />
                          </Td>
                        ) : null}
                      </Tr>
                    );
                  })}
                </tbody>
              );
            })}
          </Table>
        </TableWrapper>
      )}

      <Pagination
        page={page}
        total={matching}
        shown={rows.length}
        pathname="/calendar"
        query={{ ...query, view: 'list' }}
      />
    </div>
  );
}
