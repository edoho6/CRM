import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import { Alert, Card, CardBody, Table, TableWrapper, Td, Th, Tr } from '@clinic/ui';
import { Link } from '@clinic/i18n/navigation';
import { PageHeader } from '@/components/app-shell';
import { getClinicScope } from '@/lib/session';
import { QUERY_BY_NAME, QueryFailedError, type QueryResult } from '@/features/assistant/queries';
import { BarChart } from '@/features/reports/bar-chart';
import { RankedBars } from '@/features/reports/ranked-bars';
import { ReportCard } from '@/features/reports/report-card';
import { DEFAULT_PERIOD, parsePeriod, PeriodFilter } from '@/features/reports/period-filter';
import { formatDate } from '@clinic/i18n';

/**
 * What the practice looks like from a distance.
 *
 * Every figure here comes from `features/assistant/queries.ts` — the same
 * functions the assistant calls. That is the point rather than an economy: two
 * separate definitions of "how many treatments in September" stay in step only
 * until someone fixes one of them, and then the report and the assistant answer
 * the same question differently and neither can be trusted.
 *
 * The queries are ordered: trends first (what is changing), then breakdowns
 * (what it is made of), then lists that can be acted on today. A report that
 * ends without anything to do is a report that gets opened once.
 */

const CHART_QUERIES = [
  'treatments_by_month',
  'revenue_by_month',
  'new_vs_returning_by_month',
  'appointment_outcomes_by_month',
  'bookings_by_weekday',
  'patient_counts',
  'top_herbs',
  'top_points',
  'inactive_patients',
  'unpaid_invoices',
  'low_stock',
] as const;

type QueryName = (typeof CHART_QUERIES)[number];

export default async function ReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ months?: string }>;
}) {
  const { locale } = await params;
  const { months: monthsParam } = await searchParams;
  setRequestLocale(locale);

  const months = parsePeriod(monthsParam);

  const t = await getTranslations('reports');
  const tStatus = await getTranslations('patients.status');
  const tAppointmentStatus = await getTranslations('appointments.status');
  const tWeekday = await getTranslations('schedule.weekday');
  const format = await getFormatter();

  const scope = await getClinicScope();
  if (!scope) return null;

  /*
   * All eleven at once.
   *
   * A failing query becomes null rather than taking the page with it: one broken
   * section on a report is a gap, and a blank screen because the invoice table
   * has a problem is a worse trade. The section says so where it would have been.
   */
  const entries = await Promise.all(
    CHART_QUERIES.map(async (name) => {
      const query = QUERY_BY_NAME.get(name);
      if (!query) return [name, null] as const;
      try {
        return [name, await query.run(scope.supabase, { months })] as const;
      } catch (error) {
        if (error instanceof QueryFailedError) return [name, null] as const;
        throw error;
      }
    }),
  );

  const results = new Map<QueryName, QueryResult | null>(entries as [QueryName, QueryResult | null][]);
  const get = (name: QueryName) => results.get(name) ?? null;

  const tracksInventory = scope.context.clinic.tracks_inventory !== false;

  /** A short month label — the axis has no room for "September 2026". */
  const monthLabel = (value: string) => {
    const [year, month] = value.split('-');
    return `${month}/${String(year).slice(2)}`;
  };

  const num = (value: unknown) => (typeof value === 'number' ? value : Number(value) || 0);

  return (
    <>
      <PageHeader title={t('title')} description={t('subtitle')} />

      <div className="mb-4">
        <PeriodFilter current={months} />
      </div>

      <div className="space-y-5">
        <section className="space-y-4">
          <h2 className="text-base font-semibold text-ink-900">{t('sections.trends')}</h2>

          <div className="grid gap-4 lg:grid-cols-2">
            <TreatmentsCard result={get('treatments_by_month')} monthLabel={monthLabel} />
            <RevenueCard result={get('revenue_by_month')} monthLabel={monthLabel} />
            <NewVsReturningCard result={get('new_vs_returning_by_month')} monthLabel={monthLabel} />
            <AppointmentOutcomesCard
              result={get('appointment_outcomes_by_month')}
              monthLabel={monthLabel}
              statusLabel={(status) => {
                try {
                  return tAppointmentStatus(status);
                } catch {
                  // A status the translations do not carry is shown as itself
                  // rather than crashing the page.
                  return status;
                }
              }}
            />
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-base font-semibold text-ink-900">{t('sections.breakdown')}</h2>

          <div className="grid gap-4 lg:grid-cols-3">
            <ReportCard
              title={t('weekdayLoad')}
              failed={get('bookings_by_weekday') === null}
              table={buildTable(get('bookings_by_weekday'), {
                weekday: t('columns.weekday'),
                bookings: t('columns.bookings'),
              })}
            >
              <RankedBars
                rows={(get('bookings_by_weekday')?.rows ?? []).map((row) => ({
                  label: tWeekday(String(num(row.weekday))),
                  value: num(row.bookings),
                }))}
              />
            </ReportCard>

            <ReportCard
              title={t('patientStatuses')}
              failed={get('patient_counts') === null}
              table={buildTable(get('patient_counts'), {
                status: t('columns.status'),
                count: t('columns.count'),
              })}
            >
              <RankedBars
                rows={(get('patient_counts')?.rows ?? []).map((row) => ({
                  label: safeStatus(String(row.status ?? ''), tStatus),
                  value: num(row.count),
                }))}
              />
            </ReportCard>

            <ReportCard
              title={t('topHerbs')}
              hint={t('topHerbsHint')}
              failed={get('top_herbs') === null}
              table={buildTable(get('top_herbs'), {
                herb: t('columns.herb'),
                times: t('columns.times'),
                total_quantity: t('columns.totalQuantity'),
              })}
            >
              <RankedBars
                rows={(get('top_herbs')?.rows ?? []).slice(0, 10).map((row) => ({
                  label: String(row.herb ?? '—'),
                  value: num(row.times),
                }))}
              />
            </ReportCard>

            <ReportCard
              title={t('topPoints')}
              failed={get('top_points') === null}
              table={buildTable(get('top_points'), {
                point: t('columns.point'),
                times: t('columns.times'),
              })}
            >
              <RankedBars
                rows={(get('top_points')?.rows ?? []).slice(0, 10).map((row) => ({
                  label: String(row.point ?? '—'),
                  value: num(row.times),
                }))}
              />
            </ReportCard>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-base font-semibold text-ink-900">{t('sections.actions')}</h2>

          <div className="grid gap-4 lg:grid-cols-2">
            <ListCard
              title={t('inactivePatients')}
              hint={t('inactivePatientsHint')}
              result={get('inactive_patients')}
              failed={get('inactive_patients') === null}
              unavailableLabel={t('unavailable')}
              headers={{
                patient: t('columns.patient'),
                last_treatment: t('columns.lastTreatment'),
                status: t('columns.status'),
              }}
              emptyLabel={t('noData')}
            />

            <ListCard
              title={t('unpaid')}
              result={get('unpaid_invoices')}
              failed={get('unpaid_invoices') === null}
              unavailableLabel={t('unavailable')}
              headers={{
                invoice: t('columns.invoice'),
                patient: t('columns.patient'),
                issued: t('columns.issued'),
                outstanding: t('columns.outstanding'),
              }}
              emptyLabel={t('nothingOutstanding')}
              footer={
                <Link
                  href="/billing"
                  className="text-xs font-medium text-jade-700 underline-offset-4 hover:underline"
                >
                  {t('toBilling')}
                </Link>
              }
            />

            {tracksInventory ? (
              <ListCard
                title={t('lowStock')}
                result={get('low_stock')}
                failed={get('low_stock') === null}
                unavailableLabel={t('unavailable')}
                headers={{
                  herb: t('columns.herb'),
                  remaining: t('columns.remaining'),
                  unit: t('columns.unit'),
                }}
                emptyLabel={t('stockFine')}
                footer={
                  <Link
                    href="/inventory"
                    className="text-xs font-medium text-jade-700 underline-offset-4 hover:underline"
                  >
                    {t('toInventory')}
                  </Link>
                }
              />
            ) : null}
          </div>
        </section>

        <p className="text-xs text-ink-600">
          {t('generatedOn', { date: formatDate(new Date()) })}
        </p>
      </div>
    </>
  );
}

/* -------------------------------------------------------------------------
 * Sections
 *
 * Each one knows the shape of the query it draws. Keeping that here rather than
 * inside the chart components is what lets the charts stay dumb enough to reuse.
 * ---------------------------------------------------------------------- */

function buildTable(
  result: QueryResult | null,
  headers: Record<string, string>,
): { columns: string[]; rows: Record<string, string | number | null>[]; headers: Record<string, string> } {
  return { columns: result?.columns ?? [], rows: result?.rows ?? [], headers };
}

/** A status the translation file does not carry is shown as itself. */
function safeStatus(status: string, translate: (key: string) => string): string {
  try {
    return translate(status);
  } catch {
    return status;
  }
}

async function TreatmentsCard({
  result,
  monthLabel,
}: {
  result: QueryResult | null;
  monthLabel: (value: string) => string;
}) {
  const t = await getTranslations('reports');
  const rows = result?.rows ?? [];
  const total = rows.reduce((sum, row) => sum + (Number(row.count) || 0), 0);

  return (
    <ReportCard
      title={t('treatments')}
      failed={result === null}
      headline={String(total)}
      hint={t('treatmentsHint')}
      table={buildTable(result, { month: t('columns.month'), count: t('columns.count') })}
    >
      <BarChart
        labels={rows.map((row) => monthLabel(String(row.month)))}
        series={[{ label: t('treatments'), values: rows.map((row) => Number(row.count) || 0) }]}
      />
    </ReportCard>
  );
}

async function RevenueCard({
  result,
  monthLabel,
}: {
  result: QueryResult | null;
  monthLabel: (value: string) => string;
}) {
  const t = await getTranslations('reports');
  const format = await getFormatter();
  const rows = result?.rows ?? [];

  const billed = rows.reduce((sum, row) => sum + (Number(row.billed) || 0), 0);
  const outstanding = rows.reduce((sum, row) => sum + (Number(row.outstanding) || 0), 0);

  const money = (value: number) => format.number(value, 'currency');

  return (
    <ReportCard
      title={t('revenue')}
      failed={result === null}
      headline={money(billed)}
      // Outstanding is stated rather than drawn: it is the gap between the two
      // bars, and a third bar for a difference is a bar that double-counts.
      hint={outstanding > 0 ? t('outstandingTotal', { amount: money(outstanding) }) : undefined}
      table={buildTable(result, {
        month: t('columns.month'),
        billed: t('columns.billed'),
        paid: t('columns.paid'),
        outstanding: t('columns.outstanding'),
      })}
    >
      <BarChart
        labels={rows.map((row) => monthLabel(String(row.month)))}
        series={[
          { label: t('columns.billed'), values: rows.map((row) => Number(row.billed) || 0) },
          { label: t('columns.paid'), values: rows.map((row) => Number(row.paid) || 0) },
        ]}
        unit="currency"
      />
    </ReportCard>
  );
}

async function NewVsReturningCard({
  result,
  monthLabel,
}: {
  result: QueryResult | null;
  monthLabel: (value: string) => string;
}) {
  const t = await getTranslations('reports');
  const rows = result?.rows ?? [];
  const first = rows.reduce((sum, row) => sum + (Number(row.first_visit) || 0), 0);

  return (
    <ReportCard
      title={t('newVsReturning')}
      failed={result === null}
      headline={String(first)}
      hint={t('newVsReturningHint')}
      table={buildTable(result, {
        month: t('columns.month'),
        first_visit: t('columns.firstVisit'),
        returning: t('columns.returning'),
      })}
    >
      <BarChart
        labels={rows.map((row) => monthLabel(String(row.month)))}
        series={[
          { label: t('columns.firstVisit'), values: rows.map((row) => Number(row.first_visit) || 0) },
          { label: t('columns.returning'), values: rows.map((row) => Number(row.returning) || 0) },
        ]}
      />
    </ReportCard>
  );
}

async function AppointmentOutcomesCard({
  result,
  monthLabel,
  statusLabel,
}: {
  result: QueryResult | null;
  monthLabel: (value: string) => string;
  statusLabel: (status: string) => string;
}) {
  const t = await getTranslations('reports');
  const rows = result?.rows ?? [];

  /*
   * Two series out of however many statuses occurred: what went ahead, and what
   * did not. The chart takes two colours, and "completed against everything that
   * fell through" is the question anyone actually asks of this — a bar per
   * status would be five colours saying less.
   */
  const columns = (result?.columns ?? []).filter((column) => column !== 'month');
  const lost = columns.filter((column) => column === 'cancelled' || column === 'no_show');

  const completed = rows.map((row) => Number(row.completed) || 0);
  const missed = rows.map((row) =>
    lost.reduce((sum, column) => sum + (Number(row[column]) || 0), 0),
  );

  const missedTotal = missed.reduce((sum, value) => sum + value, 0);
  const allTotal = completed.reduce((sum, value) => sum + value, 0) + missedTotal;

  return (
    <ReportCard
      title={t('appointmentOutcomes')}
      failed={result === null}
      headline={allTotal > 0 ? `${Math.round((missedTotal / allTotal) * 100)}%` : undefined}
      hint={t('appointmentOutcomesHint')}
      table={buildTable(result, {
        month: t('columns.month'),
        ...Object.fromEntries(columns.map((column) => [column, statusLabel(column)])),
      })}
    >
      <BarChart
        labels={rows.map((row) => monthLabel(String(row.month)))}
        series={[
          { label: statusLabel('completed'), values: completed },
          { label: t('missed'), values: missed },
        ]}
      />
    </ReportCard>
  );
}

function ListCard({
  title,
  hint,
  result,
  headers,
  emptyLabel,
  unavailableLabel,
  failed,
  footer,
}: {
  title: string;
  hint?: string;
  result: QueryResult | null;
  headers: Record<string, string>;
  emptyLabel: string;
  unavailableLabel: string;
  failed?: boolean;
  footer?: React.ReactNode;
}) {
  const rows = result?.rows ?? [];
  const columns = result?.columns ?? [];

  return (
    <Card>
      <CardBody className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-ink-900">{title}</h3>
          {hint ? <p className="mt-0.5 text-xs text-ink-600">{hint}</p> : null}
        </div>

        {/* Same distinction as ReportCard: a query that failed is not a clinic
            with nothing to show. */}
        {failed ? (
          <Alert tone="warning">{unavailableLabel}</Alert>
        ) : rows.length === 0 ? (
          <p className="py-4 text-sm text-ink-600">{emptyLabel}</p>
        ) : (
          <TableWrapper>
            <Table>
              <thead>
                <tr>
                  {columns.map((column) => (
                    <Th key={column}>{headers[column] ?? column}</Th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <Tr key={index}>
                    {columns.map((column) => {
                      const value = row[column];
                      const isNumber = typeof value === 'number';
                      return (
                        <Td
                          key={column}
                          dir={isNumber ? 'ltr' : 'auto'}
                          className={isNumber ? 'tabular-nums' : undefined}
                        >
                          {value === null || value === '' ? '—' : String(value)}
                        </Td>
                      );
                    })}
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrapper>
        )}

        {footer ? <div className="no-print">{footer}</div> : null}
      </CardBody>
    </Card>
  );
}
