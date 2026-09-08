/**
 * What the diary knows about when the clinic is open.
 *
 * A plain module: the calendar page reads it on the server to shade the grid,
 * and the appointment dialog reads it in the browser to warn before saving. A
 * value exported from a `'use client'` module would reach the server as a client
 * reference and fail at runtime rather than in the build.
 *
 * Nothing here blocks anything. A practitioner does see someone at eight in the
 * evening, and a system that argues with them about their own diary is a system
 * they work around. Shading and a warning say what the schedule expects; the
 * decision stays with the person.
 */

import { toDateKey } from './date-utils';

/** `HH:MM` — Postgres returns `HH:MM:SS` and the inputs speak `HH:MM`. */
export type ClockTime = string;

export interface WorkingBlock {
  weekday: number;
  start_time: string;
  end_time: string;
}

export interface DayException {
  date: string;
  is_closed: boolean;
  start_time: string | null;
  end_time: string | null;
  reason: string | null;
}

export interface Availability {
  blocks: WorkingBlock[];
  exceptions: DayException[];
}

function toMinutes(time: string): number {
  const [hours, minutes] = time.slice(0, 5).split(':').map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

/**
 * The open intervals for one day, in minutes from midnight.
 *
 * An exception replaces the weekly pattern rather than adding to it: a day with
 * changed hours is open at those hours and no others, which is what "changed
 * hours" means. A closed day returns nothing.
 */
export function openIntervalsFor(
  day: Date,
  availability: Availability,
): { start: number; end: number }[] {
  const key = toDateKey(day);
  const exception = availability.exceptions.find((entry) => entry.date === key);

  if (exception) {
    if (exception.is_closed) return [];
    if (!exception.start_time || !exception.end_time) return [];
    return [{ start: toMinutes(exception.start_time), end: toMinutes(exception.end_time) }];
  }

  return availability.blocks
    .filter((block) => block.weekday === day.getDay())
    .map((block) => ({ start: toMinutes(block.start_time), end: toMinutes(block.end_time) }))
    .sort((a, b) => a.start - b.start);
}

/**
 * Whether a whole appointment falls inside working hours.
 *
 * "Inside" means inside one block, not spread across two: an appointment that
 * runs through the lunch break is outside working hours, and saying otherwise
 * would make the warning useless exactly when it is right.
 *
 * With no hours set at all — a practitioner who has not filled the screen in —
 * nothing is outside them. Warning about every booking because a setting is
 * empty teaches people to ignore the warning.
 */
export function isWithinWorkingHours(
  start: Date,
  end: Date,
  availability: Availability,
): boolean {
  if (availability.blocks.length === 0 && availability.exceptions.length === 0) return true;

  const intervals = openIntervalsFor(start, availability);
  if (intervals.length === 0) return false;

  const from = start.getHours() * 60 + start.getMinutes();
  // An appointment ending exactly at closing time is inside it.
  const to = end.getHours() * 60 + end.getMinutes();

  // Crossing midnight is not a clinic appointment; treat it as outside rather
  // than wrapping the arithmetic around and reporting something confident.
  if (to <= from) return false;

  return intervals.some((interval) => from >= interval.start && to <= interval.end);
}

/** The reason a day is closed, when there is one worth showing. */
export function closureFor(day: Date, availability: Availability): DayException | null {
  const key = toDateKey(day);
  const exception = availability.exceptions.find((entry) => entry.date === key);
  return exception?.is_closed ? exception : null;
}

/** True when the day has no open hours at all. */
export function isClosedDay(day: Date, availability: Availability): boolean {
  if (availability.blocks.length === 0 && availability.exceptions.length === 0) return false;
  return openIntervalsFor(day, availability).length === 0;
}
