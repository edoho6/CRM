/**
 * Date-range filtering, shared by the treatment list and the calendar.
 *
 * A plain module, not a `'use client'` one: the server pages read the resolved
 * range to build their query, and a value exported from a client module would
 * reach them as a client reference and fail at runtime rather than in the build.
 *
 * The range lives in the URL rather than in component state, so a filtered view
 * can be bookmarked, reloaded and linked — and so the server can do the
 * filtering in the query instead of shipping a year of records to the browser
 * and hiding most of them.
 *
 * Boundaries are local dates, not UTC instants. "Today" has to mean the
 * practitioner's today; computing it in UTC puts the first two hours of an
 * Israeli evening into tomorrow.
 */

export const RANGE_PRESETS = ['today', 'week', 'month', 'all', 'custom'] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number];

export interface ResolvedRange {
  preset: RangePreset;
  /** Inclusive start, as `YYYY-MM-DD`. Null means unbounded. */
  from: string | null;
  /** Inclusive end, as `YYYY-MM-DD`. Null means unbounded. */
  to: string | null;
}

function isPreset(value: unknown): value is RangePreset {
  return typeof value === 'string' && (RANGE_PRESETS as readonly string[]).includes(value);
}

/** `YYYY-MM-DD` in local time — `toISOString()` would convert to UTC first. */
export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function shiftDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Turns the query string into a range.
 *
 * "Last week" and "last month" are the trailing seven and thirty days rather
 * than the previous calendar week or month, because the question being asked is
 * "what have I done lately", not "what happened in a named period".
 */
export function resolveRange(
  params: { range?: string | string[]; from?: string | string[]; to?: string | string[] },
  today: Date = new Date(),
): ResolvedRange {
  const raw = Array.isArray(params.range) ? params.range[0] : params.range;
  const rawFrom = Array.isArray(params.from) ? params.from[0] : params.from;
  const rawTo = Array.isArray(params.to) ? params.to[0] : params.to;

  const from = rawFrom && DATE_PATTERN.test(rawFrom) ? rawFrom : null;
  const to = rawTo && DATE_PATTERN.test(rawTo) ? rawTo : null;

  // Explicit dates win over the preset, so editing one of the two date fields
  // takes effect without also having to press "custom".
  if (from || to) return { preset: 'custom', from, to };

  const preset: RangePreset = isPreset(raw) ? raw : 'all';
  const todayKey = toDateKey(today);

  switch (preset) {
    case 'today':
      return { preset, from: todayKey, to: todayKey };
    case 'week':
      return { preset, from: toDateKey(shiftDays(today, -6)), to: todayKey };
    case 'month':
      return { preset, from: toDateKey(shiftDays(today, -29)), to: todayKey };
    case 'custom':
      // Chosen but nothing filled in yet: show everything rather than nothing.
      return { preset, from: null, to: null };
    default:
      return { preset: 'all', from: null, to: null };
  }
}

/**
 * The same range as timestamps, for columns that store an instant rather than a
 * date. The end is pushed to the last millisecond of its day so a record made at
 * five in the afternoon is inside "today".
 */
export function toInstantBounds(range: ResolvedRange): { fromIso: string | null; toIso: string | null } {
  return {
    fromIso: range.from ? new Date(`${range.from}T00:00:00`).toISOString() : null,
    toIso: range.to ? new Date(`${range.to}T23:59:59.999`).toISOString() : null,
  };
}
