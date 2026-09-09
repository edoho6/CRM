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
 *
 * Three layers, applied in order: the weekly pattern, a day's exception (which
 * replaces the pattern for that day), and blocked hours (which are cut out of
 * whatever is left — a course in the afternoon, an hour at the dentist).
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

/** Hours away on one day, with a reason. Several may sit on one day. */
export interface BlockedWindow {
  id: string;
  start_at: string;
  end_at: string;
  reason: string | null;
}

export interface Availability {
  blocks: WorkingBlock[];
  exceptions: DayException[];
  /** Absent in the few callers that only ask about whole days. */
  blocked?: BlockedWindow[];
}

export interface Interval {
  start: number;
  end: number;
}

function toMinutes(time: string): number {
  const [hours, minutes] = time.slice(0, 5).split(':').map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

function minutesOf(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

/** Blocked hours on one day, in minutes from midnight, clipped to the day. */
export function blockedWindowsFor(
  day: Date,
  availability: Availability,
): (Interval & { id: string; reason: string | null })[] {
  const key = toDateKey(day);
  return (availability.blocked ?? [])
    .map((window) => {
      const start = new Date(window.start_at);
      const end = new Date(window.end_at);
      const startsToday = toDateKey(start) === key;
      const endsToday = toDateKey(end) === key;
      if (!startsToday && !endsToday && !(start < day && end > day)) return null;
      return {
        id: window.id,
        reason: window.reason,
        start: startsToday ? minutesOf(start) : 0,
        end: endsToday ? minutesOf(end) : 24 * 60,
      };
    })
    .filter((window): window is Interval & { id: string; reason: string | null } => window !== null)
    .sort((a, b) => a.start - b.start);
}

/** Cuts the blocked windows out of a list of open intervals. */
function subtract(open: Interval[], blocked: Interval[]): Interval[] {
  let result = open;
  for (const cut of blocked) {
    result = result.flatMap((interval) => {
      if (cut.end <= interval.start || cut.start >= interval.end) return [interval];
      const pieces: Interval[] = [];
      if (cut.start > interval.start) pieces.push({ start: interval.start, end: cut.start });
      if (cut.end < interval.end) pieces.push({ start: cut.end, end: interval.end });
      return pieces;
    });
  }
  return result;
}

/**
 * The open intervals for one day, in minutes from midnight.
 *
 * An exception replaces the weekly pattern rather than adding to it: a day with
 * changed hours is open at those hours and no others, which is what "changed
 * hours" means. A closed day returns nothing. Blocked hours are then cut out of
 * whatever remains.
 */
export function openIntervalsFor(day: Date, availability: Availability): Interval[] {
  const key = toDateKey(day);
  const exception = availability.exceptions.find((entry) => entry.date === key);

  let open: Interval[];
  if (exception) {
    if (exception.is_closed) return [];
    if (!exception.start_time || !exception.end_time) return [];
    open = [{ start: toMinutes(exception.start_time), end: toMinutes(exception.end_time) }];
  } else {
    open = availability.blocks
      .filter((block) => block.weekday === day.getDay())
      .map((block) => ({ start: toMinutes(block.start_time), end: toMinutes(block.end_time) }))
      .sort((a, b) => a.start - b.start);
  }

  return subtract(open, blockedWindowsFor(day, availability));
}

/** True when nothing about the schedule has been set at all. */
function nothingSet(availability: Availability): boolean {
  return (
    availability.blocks.length === 0 &&
    availability.exceptions.length === 0 &&
    (availability.blocked?.length ?? 0) === 0
  );
}

/**
 * Whether a whole appointment falls inside working hours.
 *
 * "Inside" means inside one block, not spread across two: an appointment that
 * runs through the lunch break is outside working hours, and saying otherwise
 * would make the warning useless exactly when it is right.
 *
 * With no hours set at all — a practitioner who has not filled the screen in —
 * nothing is outside them, except a blocked window, which was set on purpose.
 * Warning about every booking because a setting is empty teaches people to
 * ignore the warning.
 */
export function isWithinWorkingHours(
  start: Date,
  end: Date,
  availability: Availability,
): boolean {
  if (nothingSet(availability)) return true;

  const from = minutesOf(start);
  // An appointment ending exactly at closing time is inside it.
  const to = minutesOf(end);

  // Crossing midnight is not a clinic appointment; treat it as outside rather
  // than wrapping the arithmetic around and reporting something confident.
  if (to <= from) return false;

  // Only blocks are set: the day is open except for them.
  if (availability.blocks.length === 0 && availability.exceptions.length === 0) {
    return !blockedWindowsFor(start, availability).some(
      (window) => from < window.end && to > window.start,
    );
  }

  const intervals = openIntervalsFor(start, availability);
  if (intervals.length === 0) return false;
  return intervals.some((interval) => from >= interval.start && to <= interval.end);
}

/** The blocked window an appointment runs into, if any — for the warning's wording. */
export function blockedWindowFor(
  start: Date,
  end: Date,
  availability: Availability,
): (Interval & { id: string; reason: string | null }) | null {
  const from = minutesOf(start);
  const to = minutesOf(end);
  return (
    blockedWindowsFor(start, availability).find(
      (window) => from < window.end && to > window.start,
    ) ?? null
  );
}

/** The reason a day is closed, when there is one worth showing. */
export function closureFor(day: Date, availability: Availability): DayException | null {
  const key = toDateKey(day);
  const exception = availability.exceptions.find((entry) => entry.date === key);
  return exception?.is_closed ? exception : null;
}

/** True when the day has no open hours at all. */
export function isClosedDay(day: Date, availability: Availability): boolean {
  if (nothingSet(availability)) return false;
  if (availability.blocks.length === 0 && availability.exceptions.length === 0) return false;
  return openIntervalsFor(day, availability).length === 0;
}
