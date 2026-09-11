import {
  addDaysIn,
  addMonthsIn,
  dateKeyIn,
  monthStartIn,
  startOfDayIn,
  startOfWeekIn,
} from '@clinic/domain';
import type { EncounterRow } from './queries/encounters';

/**
 * The treatment tiles' arithmetic: today, this week, this month, each with
 * the period before it and a day-by-day breakdown for the chart.
 *
 * In the clinic's zone, on the server and in the browser alike — the page
 * renders these numbers before the first paint, and the browser must arrive
 * at the same ones or React reports a mismatch. `now` is a parameter so the
 * rule can be tested on a fixed day.
 */
export type Period = 'today' | 'week' | 'month';

export interface PeriodStats {
  current: number;
  previous: number;
  /** Day buckets for the chart, oldest first. */
  days: { key: string; date: Date; count: number; isToday: boolean }[];
}

function countBetween(rows: readonly EncounterRow[], fromKey: string, toKey: string): number {
  return rows.filter((row) => row.encounter_date >= fromKey && row.encounter_date < toKey).length;
}

function buildDays(
  rows: readonly EncounterRow[],
  from: Date,
  to: Date,
  todayKey: string,
  timeZone: string,
): PeriodStats['days'] {
  const days: PeriodStats['days'] = [];
  for (let cursor = from; cursor < to; cursor = addDaysIn(cursor, 1, timeZone)) {
    const key = dateKeyIn(cursor, timeZone);
    days.push({
      key,
      date: cursor,
      count: rows.filter((row) => row.encounter_date === key).length,
      isToday: key === todayKey,
    });
  }
  return days;
}

export function computeStats(
  rows: readonly EncounterRow[],
  { now = new Date(), timeZone }: { now?: Date; timeZone: string },
): Record<Period, PeriodStats> {
  const key = (instant: Date) => dateKeyIn(instant, timeZone);
  const today = startOfDayIn(now, timeZone);
  const tomorrow = addDaysIn(today, 1, timeZone);
  const yesterday = addDaysIn(today, -1, timeZone);

  const weekStart = startOfWeekIn(now, timeZone);
  const weekEnd = addDaysIn(weekStart, 7, timeZone);
  const lastWeekStart = addDaysIn(weekStart, -7, timeZone);

  const monthStart = monthStartIn(now, timeZone);
  const monthEnd = addMonthsIn(now, 1, timeZone);
  const lastMonthStart = addMonthsIn(now, -1, timeZone);

  const todayKey = key(today);
  return {
    today: {
      current: countBetween(rows, todayKey, key(tomorrow)),
      previous: countBetween(rows, key(yesterday), todayKey),
      days: buildDays(rows, addDaysIn(today, -6, timeZone), tomorrow, todayKey, timeZone),
    },
    week: {
      current: countBetween(rows, key(weekStart), key(weekEnd)),
      previous: countBetween(rows, key(lastWeekStart), key(weekStart)),
      days: buildDays(rows, weekStart, weekEnd, todayKey, timeZone),
    },
    month: {
      current: countBetween(rows, key(monthStart), key(monthEnd)),
      previous: countBetween(rows, key(lastMonthStart), key(monthStart)),
      days: buildDays(rows, monthStart, monthEnd, todayKey, timeZone),
    },
  };
}
