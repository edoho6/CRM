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

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
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
