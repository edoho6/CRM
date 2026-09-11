/**
 * Day and month boundaries in a named time zone, without a date library.
 *
 * "Today" on the dashboard is the clinic's today, wherever the code runs: a
 * page computed on a server in Frankfurt at 23:30 must show the clinic's day
 * in Jerusalem, and the browser must arrive at the same numbers or React
 * will complain that the server and the client disagree. `Intl` knows a
 * zone's offset at any instant; these helpers use it to find local midnight
 * and to step whole days and months from there.
 *
 * Every function takes and returns instants (`Date`), so the callers keep
 * comparing timestamps; only the calendar arithmetic is zone-aware.
 */

export interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  let cached = formatters.get(timeZone);
  if (!cached) {
    cached = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatters.set(timeZone, cached);
  }
  return cached;
}

/** The wall-clock reading of an instant in the zone. */
export function zonedParts(instant: Date, timeZone: string): ZonedParts {
  const parts = formatter(timeZone).formatToParts(instant);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? '0');
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    // Some engines print midnight as "24" even under h23.
    hour: get('hour') % 24,
    minute: get('minute'),
    second: get('second'),
  };
}

/** Minutes the zone is ahead of UTC at that instant (positive east of Greenwich). */
export function zoneOffsetMinutes(instant: Date, timeZone: string): number {
  const p = zonedParts(instant, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - instant.getTime()) / 60_000);
}

/**
 * The instant at which the calendar day (year, month, day) begins in the zone.
 *
 * A first guess uses the offset in force at noon of that day; a second pass
 * re-reads the offset at the guess itself, which is what catches a day whose
 * clocks change at midnight.
 */
export function zonedMidnight(year: number, month: number, day: number, timeZone: string): Date {
  const utcMidnight = Date.UTC(year, month - 1, day);
  const noon = new Date(Date.UTC(year, month - 1, day, 12));
  const guess = utcMidnight - zoneOffsetMinutes(noon, timeZone) * 60_000;
  const offset = zoneOffsetMinutes(new Date(guess), timeZone);
  return new Date(utcMidnight - offset * 60_000);
}

export function startOfDayIn(instant: Date, timeZone: string): Date {
  const p = zonedParts(instant, timeZone);
  return zonedMidnight(p.year, p.month, p.day, timeZone);
}

/** Local midnight `days` calendar days after the day the instant falls on. */
export function addDaysIn(instant: Date, days: number, timeZone: string): Date {
  const p = zonedParts(instant, timeZone);
  const shifted = new Date(Date.UTC(p.year, p.month - 1, p.day + days));
  return zonedMidnight(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth() + 1,
    shifted.getUTCDate(),
    timeZone,
  );
}

/** `YYYY-MM-DD` of the local day the instant falls on. */
export function dateKeyIn(instant: Date, timeZone: string): string {
  const p = zonedParts(instant, timeZone);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

/** Start of the local day and start of the next one: `[start, end)`. */
export function dayBoundsIn(instant: Date, timeZone: string): { start: Date; end: Date } {
  const start = startOfDayIn(instant, timeZone);
  return { start, end: addDaysIn(start, 1, timeZone) };
}

/** Sunday-first, the Israeli working week. */
export function startOfWeekIn(instant: Date, timeZone: string): Date {
  const p = zonedParts(instant, timeZone);
  const weekday = new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay();
  return addDaysIn(zonedMidnight(p.year, p.month, p.day, timeZone), -weekday, timeZone);
}

export function monthStartIn(instant: Date, timeZone: string): Date {
  const p = zonedParts(instant, timeZone);
  return zonedMidnight(p.year, p.month, 1, timeZone);
}

/** The first day of the month `months` months away from the instant's month. */
export function addMonthsIn(instant: Date, months: number, timeZone: string): Date {
  const p = zonedParts(instant, timeZone);
  const shifted = new Date(Date.UTC(p.year, p.month - 1 + months, 1));
  return zonedMidnight(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, 1, timeZone);
}
