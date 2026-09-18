import { addDaysIn, zoneOffsetMinutes, zonedParts } from '@clinic/domain';

/**
 * The dates of a weekly series, on the clinic's clock.
 *
 * A series is "Tuesdays at 10:00", not "every 168 hours". Adding seven days to
 * an instant on the server — which runs in UTC — kept the UTC time fixed, so a
 * series that crossed the end of summer time (25 October 2026 in Israel) moved
 * from 10:00 to 09:00 for every session after it. Each date is built here from
 * the wall-clock time of the first one, in the clinic's zone, and the length
 * of the appointment is kept as it was.
 */
export function seriesDates(
  firstStart: Date,
  firstEnd: Date,
  everyWeeks: number,
  occurrences: number,
  timeZone: string,
): { start: Date; end: Date }[] {
  const clock = zonedParts(firstStart, timeZone);
  const length = firstEnd.getTime() - firstStart.getTime();
  return Array.from({ length: occurrences }, (_, index) => {
    const day = zonedParts(addDaysIn(firstStart, index * everyWeeks * 7, timeZone), timeZone);
    const start = zonedTime(day.year, day.month, day.day, clock.hour, clock.minute, timeZone);
    return { start, end: new Date(start.getTime() + length) };
  });
}

/**
 * The instant a wall-clock time falls on in the zone. A first guess with the
 * offset of that day's noon, and a second read of the offset at the guess —
 * the same two steps as `zonedMidnight`, for an hour other than midnight.
 */
export function zonedTime(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const asUtc = Date.UTC(year, month - 1, day, hour, minute);
  const noon = new Date(Date.UTC(year, month - 1, day, 12));
  const guess = asUtc - zoneOffsetMinutes(noon, timeZone) * 60_000;
  const offset = zoneOffsetMinutes(new Date(guess), timeZone);
  return new Date(asUtc - offset * 60_000);
}
