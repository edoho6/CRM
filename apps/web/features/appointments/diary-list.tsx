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
 * Latest first, the future included, and it opens on the page that holds
 * today (the page decides that): the page before it is further ahead, the
 * one after it further back. Filtered and paged in the query, like the page it
 * replaces; a practice five years in has thousands of these. A darker line
 * closes each day, so a day's rows read as one group.
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
}) {
  const t = await getTranslations('appointments');
  const tc = await getTranslations('common');
  const tEncounters = await getTranslations('encounters');
  const tPatients = await getTranslations('patients');
  const tBilling = await getTranslations('billing');
  const tFilters = await getTranslations('filters');
  const format = await getFormatter();

  const filtered = Boolean(query.range && query.range !== 'all') || Boolean(query.from || query.to);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <DateRangeFilter />
        <p className="text-xs text-ink-600">
          {matching !== null && matching > rows.length
            ? tc('showingOf', { shown: rows.length, total: matching })
            : t('list.order')}
        </p>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<CalendarDays className="h-8 w-8" />}
          title={filtered ? tFilters('noneInRange') : t('list.empty')}
        />
      ) : (
        <TableWrapper responsive>
          <Table>
            <thead>
              <tr>
                <Th className="w-28 pe-1">{tc('date')}</Th>
                <Th className="w-20 px-1">{tc('time')}</Th>
                <Th>{tPatients('singular')}</Th>
                {showRecords ? <Th>{t('list.record')}</Th> : null}
                <Th>{t('confirmation.title')}</Th>
                {showPayments ? <Th>{tBilling('title')}</Th> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const encounter = encounterOf(row);
                const start = new Date(row.start_at);
                const next = rows[index + 1];
                const lastOfDay =
                  next !== undefined &&
                  dateKeyIn(new Date(next.start_at), timeZone) !== dateKeyIn(start, timeZone);
                const noShow = row.status === 'no_show';
                return (
                  <Tr key={row.id} className={cn(lastOfDay && '[&>td]:border-b-ink-300')}>
                    <Td className="w-28 pe-1" data-card-title>
                      {/* The day in the diary: the row's own place in the week. */}
                      <Link
                        href={{
                          pathname: '/calendar',
                          query: { view: 'day', date: dateKeyIn(start, timeZone) },
                        }}
                        className="font-medium text-jade-800 underline-offset-2 hover:underline"
                        dir="ltr"
                      >
                        {formatDate(start)}
                      </Link>
                    </Td>
                    <Td className="w-20 px-1">
                      <span dir="ltr" className="tabular-nums text-ink-700">
                        {format.dateTime(start, 'time')}
                      </span>
                    </Td>
                    <Td>
                      {row.patient ? (
                        <Link
                          href={`/patients/${row.patient.id}`}
                          className="text-ink-800 underline-offset-2 hover:underline"
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
