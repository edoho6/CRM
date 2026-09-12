'use client';

import { useMemo, useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { ChevronDown, ChevronUp, Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { cn, Dash } from '@clinic/ui';
import { defineWidget, type WidgetProps } from '@clinic/domain/widgets';
import { Link } from '@clinic/i18n/navigation';
import { addMonthsIn, dateKeyIn } from '@clinic/domain';
import { useAsyncData } from '@/lib/use-supabase';
import { useDashboardContext, useRenderedAt, useWidgetInitialData } from '../dashboard-context';
import { computeStats, type Period, type PeriodStats } from '../kpi-stats';
import { fetchEncountersSince, type EncounterRow } from '../queries/encounters';
import { registerWidget } from '../registry';
import { WidgetLoading } from '../widget-frame';

/**
 * Treatment KPIs: today, this week, this month.
 *
 * All three tiles are always visible so the day, the week and the month can be
 * read in one glance; each shows its change against the previous period. Opening
 * a tile reveals the detail underneath — a daily column chart for the week and
 * month, the actual list for today — so the headline number is never the end of
 * the story.
 *
 * One query fetches two months of encounter dates and everything is derived
 * client-side: six counts and three breakdowns from a single round trip.
 */

// The arithmetic lives in ../kpi-stats, in the clinic's zone and under test.

/**
 * Column chart, drawn to the mark spec: columns capped at 24px, 4px rounded
 * data-end and a square baseline, a 2px surface gap between neighbours, a
 * single hue so no legend is needed. Today's column takes the accent; the rest
 * sit one step lighter so the eye lands on now.
 */
function DayColumns({ days, labelEvery }: { days: PeriodStats['days']; labelEvery: number }) {
  const format = useFormatter();
  const t = useTranslations('widgets.treatmentKpis');
  const [hover, setHover] = useState<string | null>(null);

  const max = Math.max(1, ...days.map((day) => day.count));
  const height = 96;
  const columnWidth = 100 / days.length;

  return (
    <div className="mt-3">
      <div className="relative" style={{ height }}>
        {/* Hairline gridlines, recessive, at the top and the midpoint. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-ink-100" />
        <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-ink-100" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-ink-200" />

        <div className="absolute inset-0 flex items-end">
          {days.map((day) => {
            const ratio = day.count / max;
            const isHover = hover === day.key;
            return (
              <div
                key={day.key}
                className="group relative flex h-full items-end justify-center"
                style={{ width: `${columnWidth}%` }}
                onMouseEnter={() => setHover(day.key)}
                onMouseLeave={() => setHover(null)}
              >
                <div
                  className={cn(
                    'w-full max-w-6 rounded-t transition-colors',
                    day.isToday ? 'bg-accent' : 'bg-[var(--color-series-1)]',
                    isHover && (day.isToday ? 'bg-accent' : 'bg-[var(--color-series-2)]'),
                  )}
                  // 2px surface gap between neighbours; a zero day keeps a 2px
                  // stub so the baseline reads as continuous.
                  style={{
                    height: `${Math.max(ratio * 100, 2)}%`,
                    marginInline: 1,
                  }}
                />
                {isHover ? (
                  <div
                    role="tooltip"
                    className="pointer-events-none absolute bottom-full z-10 mb-1 rounded-md border border-ink-200 bg-white px-2 py-1 text-xs whitespace-nowrap text-ink-800 shadow-md"
                  >
                    <span dir="ltr">
                      {format.dateTime(day.date, { day: 'numeric', month: 'short' })}
                    </span>
                    {' · '}
                    {t('treatmentCount', { count: day.count })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-1 flex text-xs text-ink-600">
        {days.map((day, index) => (
          <div key={day.key} className="text-center" style={{ width: `${columnWidth}%` }}>
            {index % labelEvery === 0 || day.isToday ? (
              <span dir="ltr" className={cn(day.isToday && 'font-semibold text-jade-800')}>
                {format.dateTime(
                  day.date,
                  labelEvery === 1 ? { weekday: 'short' } : { day: 'numeric' },
                )}
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function Delta({
  current,
  previous,
  periodLabel,
}: {
  current: number;
  previous: number;
  periodLabel: string;
}) {
  const t = useTranslations('widgets.treatmentKpis');
  const delta = current - previous;
  const Icon = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;
  // More treatments is good, so up is jade and down is muted rather than red:
  // a quieter week is information, not an alarm.
  const tone = delta > 0 ? 'text-jade-700' : delta < 0 ? 'text-ink-500' : 'text-ink-500';

  return (
    <span className={cn('inline-flex items-center gap-1 text-xs', tone)}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      <span dir="ltr">{delta > 0 ? `+${delta}` : delta}</span>
      <span className="text-ink-500">{t('vsPrevious', { period: periodLabel })}</span>
    </span>
  );
}

function TreatmentKpisWidget({ size }: WidgetProps<Record<string, never>>) {
  const t = useTranslations('widgets.treatmentKpis');
  const format = useFormatter();
  const [openPeriod, setOpenPeriod] = useState<Period | null>(null);

  const { timeZone } = useDashboardContext();
  // The page's clock (see DashboardContextValue.renderedAt): the same "today"
  // on the server and in the browser, so the tile hydrates as it was drawn.
  const renderedAt = useRenderedAt();
  const fromKey = useMemo(
    // Two months back covers "last month" for the month delta and everything
    // shorter — in the clinic's zone, like every date on this tile.
    () => dateKeyIn(addMonthsIn(renderedAt, -1, timeZone), timeZone),
    [renderedAt, timeZone],
  );

  const initial = useWidgetInitialData<EncounterRow[]>('treatment-kpis');
  const { data, loading } = useAsyncData<EncounterRow[]>(
    (supabase) => fetchEncountersSince(supabase, fromKey),
    [fromKey],
    { initial },
  );

  const stats = useMemo(() => computeStats(data ?? [], { timeZone }), [data, timeZone]);

  if (loading) return <WidgetLoading />;

  const periods: { key: Period; label: string; previousLabel: string }[] = [
    { key: 'today', label: t('today'), previousLabel: t('yesterday') },
    { key: 'week', label: t('week'), previousLabel: t('lastWeek') },
    { key: 'month', label: t('month'), previousLabel: t('lastMonth') },
  ];

  const todayKey = dateKeyIn(renderedAt, timeZone);
  const todaysRows = (data ?? []).filter((row) => row.encounter_date === todayKey);
  const compact = size === 'sm' || size === 'md';

  return (
    <div className="flex h-full flex-col">
      <div className={cn('grid gap-3', compact ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-3')}>
        {periods.map((period) => {
          const stat = stats[period.key];
          const isOpen = openPeriod === period.key;
          return (
            <button
              key={period.key}
              type="button"
              onClick={() => setOpenPeriod(isOpen ? null : period.key)}
              aria-expanded={isOpen}
              className={cn(
                'rounded-xl border px-4 py-3 text-start transition-all duration-150',
                'hover:-translate-y-px hover:shadow-md',
                isOpen
                  ? 'border-jade-400 bg-jade-50 shadow-sm'
                  : 'border-ink-200 bg-white hover:border-jade-300',
              )}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-ink-500">{period.label}</span>
                {isOpen ? (
                  <ChevronUp className="h-3.5 w-3.5 text-jade-700" aria-hidden />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5 text-ink-300" aria-hidden />
                )}
              </span>
              {/* Proportional figures at display size; tabular would look loose. */}
              <span className="mt-1 block text-3xl font-semibold text-ink-900">
                {format.number(stat.current)}
              </span>
              <span className="mt-1 block">
                <Delta
                  current={stat.current}
                  previous={stat.previous}
                  periodLabel={period.previousLabel}
                />
              </span>
            </button>
          );
        })}
      </div>

      {openPeriod ? (
        <div className="mt-4 border-t border-ink-100 pt-3">
          {openPeriod === 'today' ? (
            todaysRows.length === 0 ? (
              <p className="py-3 text-center text-sm text-ink-500">{t('noTreatmentsToday')}</p>
            ) : (
              <ul className="divide-y divide-ink-100">
                {todaysRows.map((row) => (
                  <li key={row.id}>
                    <Link
                      href={`/encounters/${row.id}`}
                      className="flex items-center justify-between gap-2 py-2 text-sm transition-colors hover:bg-ink-50"
                    >
                      <span className="truncate text-ink-900">{row.patient?.full_name ?? <Dash />}</span>
                      <span className="shrink-0 text-xs text-ink-500" dir="ltr">
                        {format.dateTime(new Date(row.created_at), 'time')}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )
          ) : (
            <>
              <p className="text-xs font-medium text-ink-500">
                {openPeriod === 'week' ? t('byDayThisWeek') : t('byDayThisMonth')}
              </p>
              <DayColumns
                days={stats[openPeriod].days}
                labelEvery={openPeriod === 'week' ? 1 : 5}
              />
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

registerWidget(
  defineWidget<Record<string, never>>({
    type: 'treatment-kpis',
    icon: 'Activity',
    defaultSize: 'xl',
    allowedSizes: ['lg', 'xl'],
    defaultConfig: {},
    component: TreatmentKpisWidget,
    singleton: true,
  }),
);
