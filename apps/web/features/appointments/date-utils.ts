/**
 * Calendar date maths.
 *
 * The working week starts on Sunday, which is the Israeli convention and how the
 * clinic's own schedule is stored (`practitioner_schedules.weekday`, 0 = Sunday).
 */

export const WEEK_START_DAY = 0; // Sunday

export function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function startOfWeek(date: Date): Date {
  const result = startOfDay(date);
  const diff = (result.getDay() - WEEK_START_DAY + 7) % 7;
  return addDays(result, -diff);
}

export function startOfMonth(date: Date): Date {
  const result = startOfDay(date);
  result.setDate(1);
  return result;
}

export function endOfMonth(date: Date): Date {
  const result = startOfDay(date);
  // Day 0 of the next month is the last day of this one, and it handles
  // February and leap years without a table.
  result.setMonth(result.getMonth() + 1, 0);
  return result;
}

export function addMonths(date: Date, months: number): Date {
  const result = startOfDay(date);
  const targetDay = result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() + months);
  // Clamp: 31 January plus one month is 28 February, not 3 March.
  const lastDay = endOfMonth(result).getDate();
  result.setDate(Math.min(targetDay, lastDay));
  return result;
}

/**
 * The days a month grid draws: whole weeks, from the Sunday on or before the
 * first of the month to the Saturday on or after the last.
 *
 * Always whole weeks, so the grid is rectangular; between 28 and 42 days, so a
 * short February and a long May both come out right without a fixed six rows of
 * mostly-empty cells.
 */
export function monthGridDays(date: Date): Date[] {
  const first = startOfWeek(startOfMonth(date));
  const last = endOfMonth(date);
  const days: Date[] = [];
  for (let cursor = first; cursor <= last || days.length % 7 !== 0; cursor = addDays(cursor, 1)) {
    days.push(cursor);
    // A guard, not a condition: a bug in the loop above would otherwise hang
    // the browser rather than render a wrong calendar.
    if (days.length > 42) break;
  }
  return days;
}

/** Every day from `from` to `to` inclusive, for an agenda over a chosen range. */
export function daysBetween(from: Date, to: Date, limit = 120): Date[] {
  const days: Date[] = [];
  for (
    let cursor = startOfDay(from);
    cursor <= to && days.length < limit;
    cursor = addDays(cursor, 1)
  ) {
    days.push(cursor);
  }
  return days;
}

export function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** `YYYY-MM-DD` in local time — `toISOString()` would shift the date near midnight. */
export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function fromDateKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  if (!year || !month || !day) return startOfDay(new Date());
  return new Date(year, month - 1, day);
}

/** Minutes since midnight, used to place an event inside a day column. */
export function minutesSinceMidnight(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

/** Combines a date key and `HH:MM` into a local Date. */
export function combineDateAndTime(dateKey: string, time: string): Date {
  const base = fromDateKey(dateKey);
  const [hours, minutes] = time.split(':').map(Number);
  base.setHours(hours ?? 0, minutes ?? 0, 0, 0);
  return base;
}

/** `HH:MM` in local time, for `<input type="time">`. */
export function toTimeValue(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** Value for `<input type="datetime-local">`, which rejects a UTC string. */
export function toDateTimeLocalValue(date: Date): string {
  return `${toDateKey(date)}T${toTimeValue(date)}`;
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

export function differenceInMinutes(later: Date, earlier: Date): number {
  return Math.round((later.getTime() - earlier.getTime()) / 60_000);
}
