'use client';

import { useMemo, useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { ChevronDown, ChevronUp, Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '@clinic/ui';
import { defineWidget, type WidgetProps } from '@clinic/domain/widgets';
import { Link } from '@clinic/i18n/navigation';
import { useAsyncData } from '@/lib/use-supabase';
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

type Period = 'today' | 'week' | 'month';

interface EncounterRow {
  id: string;
  encounter_date: string;
  created_at: string;
  status: string;
  patient: { id: string; full_name: string } | null;
}

interface PeriodStats {
  current: number;
  previous: number;
  /** Day buckets for the chart, oldest first. */
  days: { key: string; date: Date; count: number; isToday: boolean }[];
}

function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/** Sunday-first week, the Israeli working week. */
function startOfWeek(date: Date): Date {
  const day = startOfDay(date);
  return addDays(day, -day.getDay());
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function dateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function countBetween(rows: EncounterRow[], from: Date, to: Date): number {
  const fromKey = dateKey(from);
  const toKey = dateKey(to);
  return rows.filter((row) => row.encounter_date >= fromKey && row.encounter_date < toKey).length;
}

function buildDays(rows: EncounterRow[], from: Date, to: Date, today: Date) {
  const days: PeriodStats['days'] = [];
  const todayKey = dateKey(today);
  for (let cursor = from; cursor < to; cursor = addDays(cursor, 1)) {
    const key = dateKey(cursor);
    days.push({
      key,
      date: cursor,
      count: rows.filter((row) => row.encounter_date === key).length,
      isToday: key === todayKey,
    });
  }
  return days;
}

function computeStats(rows: EncounterRow[]): Record<Period, PeriodStats> {
  const now = new Date();
  const today = startOfDay(now);
  const tomorrow = addDays(today, 1);
  const yesterday = addDays(today, -1);

  const weekStart = startOfWeek(now);
  const weekEnd = addDays(weekStart, 7);
  const lastWeekStart = addDays(weekStart, -7);

  const monthStart = startOfMonth(now);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  return {
    today: {
      current: countBetween(rows, today, tomorrow),
      previous: countBetween(rows, yesterday, today),
      days: buildDays(rows, addDays(today, -6), tomorrow, today),
    },
    week: {
      current: countBetween(rows, weekStart, weekEnd),
      previous: countBetween(rows, lastWeekStart, weekStart),
      days: buildDays(rows, weekStart, weekEnd, today),
    },
    month: {
      current: countBetween(rows, monthStart, monthEnd),
      previous: countBetween(rows, lastMonthStart, monthStart),
      days: buildDays(rows, monthStart, monthEnd, today),
    },
  };
}

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
                    day.isToday ? 'bg-jade-600' : 'bg-jade-300',
                    isHover && (day.isToday ? 'bg-jade-700' : 'bg-jade-400'),
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
                    <span dir="ltr">{format.dateTime(day.date, { day: 'numeric', month: 'short' })}</span>
                    {' · '}
                    {t('treatmentCount', { count: day.count })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-1 flex text-[10px] text-ink-400">
        {days.map((day, index) => (
          <div key={day.key} className="text-center" style={{ width: `${columnWidth}%` }}>
            {index % labelEvery === 0 || day.isToday ? (
              <span dir="ltr" className={cn(day.isToday && 'font-semibold text-jade-800')}>
                {format.dateTime(day.date, labelEvery === 1 ? { weekday: 'short' } : { day: 'numeric' })}
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function Delta({ current, previous, periodLabel }: { current: number; previous: number; periodLabel: string }) {
  const t = useTranslations('widgets.treatmentKpis');
  const delta = current - previous;
  const Icon = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;
  // More treatments is good, so up is jade and down is muted rather than red:
  // a quieter week is information, not an alarm.
  const tone = delta > 0 ? 'text-jade-700' : delta < 0 ? 'text-ink-500' : 'text-ink-400';

  return (
    <span className={cn('inline-flex items-center gap-1 text-xs', tone)}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      <span dir="ltr">{delta > 0 ? `+${delta}` : delta}</span>
      <span className="text-ink-400">{t('vsPrevious', { period: periodLabel })}</span>
    </span>
  );
}

function TreatmentKpisWidget({ size }: WidgetProps<Record<string, never>>) {
  const t = useTranslations('widgets.treatmentKpis');
  const format = useFormatter();
  const [openPeriod, setOpenPeriod] = useState<Period | null>(null);

  const fromKey = useMemo(() => {
    const now = new Date();
    // Two months back covers "last month" for the month delta and everything
    // shorter.
    return dateKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  }, []);

  const { data, loading } = useAsyncData<EncounterRow[]>(
    async (supabase) => {
      const { data: rows, error } = await supabase
        .from('encounters')
        .select('id, encounter_date, created_at, status, patient:patients(id, full_name)')
        .gte('encounter_date', fromKey)
        .order('encounter_date', { ascending: true });
      if (error) throw new Error(error.message);
      return (rows ?? []) as unknown as EncounterRow[];
    },
    [fromKey],
  );

  const stats = useMemo(() => computeStats(data ?? []), [data]);

  if (loading) return <WidgetLoading />;

  const periods: { key: Period; label: string; previousLabel: string }[] = [
    { key: 'today', label: t('today'), previousLabel: t('yesterday') },
    { key: 'week', label: t('week'), previousLabel: t('lastWeek') },
    { key: 'month', label: t('month'), previousLabel: t('lastMonth') },
  ];

  const todayKey = dateKey(new Date());
  const todaysRows = (data ?? []).filter((row) => row.encounter_date === todayKey);
  const compact = size === 'sm' || size === 'md';

  return (
    <div className="flex h-full flex-col">
      <div className={cn('grid gap-3', compact ? 'grid-cols-1' : 'grid-cols-3')}>
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
                <Delta current={stat.current} previous={stat.previous} periodLabel={period.previousLabel} />
              </span>
            </button>
          );
        })}
      </div>

      {openPeriod ? (
        <div className="mt-4 border-t border-ink-100 pt-3">
          {openPeriod === 'today' ? (
            todaysRows.length === 0 ? (
              <p className="py-3 text-center text-sm text-ink-400">{t('noTreatmentsToday')}</p>
            ) : (
              <ul className="divide-y divide-ink-100">
                {todaysRows.map((row) => (
                  <li key={row.id}>
                    <Link
                      href={`/encounters/${row.id}`}
                      className="flex items-center justify-between gap-2 py-2 text-sm transition-colors hover:bg-ink-50"
                    >
                      <span className="truncate text-ink-900">{row.patient?.full_name ?? '—'}</span>
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
              <DayColumns days={stats[openPeriod].days} labelEvery={openPeriod === 'week' ? 1 : 5} />
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
    displayName: { he: 'טיפולים — היום, השבוע, החודש', en: 'Treatments — today, week, month' },
    description: {
      he: 'שלושה מספרים במבט אחד, עם שינוי מול התקופה הקודמת ופירוט בלחיצה.',
      en: 'Three numbers at a glance, with change against the previous period and detail on click.',
    },
    icon: 'Activity',
    defaultSize: 'xl',
    allowedSizes: ['lg', 'xl'],
    defaultConfig: {},
    component: TreatmentKpisWidget,
    singleton: true,
  }),
);
