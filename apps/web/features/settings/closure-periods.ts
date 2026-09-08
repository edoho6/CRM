/**
 * Consecutive closed days, gathered back into the periods they were entered as.
 *
 * The database stores one row per closed day, because that is the shape every
 * reader wants — "is this day closed" is the only question the calendar, the
 * booking dialog and the series generator ever ask. But a fortnight in Greece is
 * one decision, and a list showing it as fourteen identical rows is a list
 * nobody can find next week's holiday in.
 *
 * So the rows are regrouped for display. Two days join a run when they are
 * calendar-adjacent *and* carry the same reason: closing Monday for a course and
 * Tuesday for a funeral is two facts that happen to touch, and merging them
 * would put one reason on both.
 */

export interface ClosureDay {
  id: string;
  date: string;
  reason: string | null;
  /** False for a shortened day: open, but at different hours. */
  isClosed: boolean;
  startTime: string | null;
  endTime: string | null;
}

export interface ClosurePeriod {
  from: string;
  to: string;
  reason: string | null;
  isClosed: boolean;
  startTime: string | null;
  endTime: string | null;
  /** How many days the run covers, so the row can say "14 days". */
  days: number;
}

/** The day after `date`, as `YYYY-MM-DD`. UTC, so a clock change cannot skip one. */
function nextDay(date: string): string {
  const day = new Date(`${date}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() + 1);
  return day.toISOString().slice(0, 10);
}

export function groupClosures(days: ClosureDay[]): ClosurePeriod[] {
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
  const periods: ClosurePeriod[] = [];

  for (const day of sorted) {
    const open = periods[periods.length - 1];

    // A duplicate date cannot extend a run, and must not inflate the count.
    if (open && day.date === open.to) continue;

    /*
     * A run continues only while every day of it says the same thing.
     *
     * The hours are part of that, not just the reason: a week off followed by a
     * week of afternoons-only is two entries, and merging them would print one
     * set of hours over days that do not have them.
     */
    const sameAsOpen =
      open !== undefined &&
      day.date === nextDay(open.to) &&
      (day.reason ?? '') === (open.reason ?? '') &&
      day.isClosed === open.isClosed &&
      (day.startTime ?? '') === (open.startTime ?? '') &&
      (day.endTime ?? '') === (open.endTime ?? '');

    if (sameAsOpen) {
      open!.to = day.date;
      open!.days += 1;
      continue;
    }

    periods.push({
      from: day.date,
      to: day.date,
      reason: day.reason,
      isClosed: day.isClosed,
      startTime: day.startTime,
      endTime: day.endTime,
      days: 1,
    });
  }

  return periods;
}
