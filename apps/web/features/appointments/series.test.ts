import { describe, expect, it } from 'vitest';
import { zonedParts } from '@clinic/domain';
import { seriesDates } from './series';

const TZ = 'Asia/Jerusalem';

/** Local "HH:MM" of an instant in Israel. */
function clock(instant: Date): string {
  const p = zonedParts(instant, TZ);
  return `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`;
}

function localDay(instant: Date): string {
  const p = zonedParts(instant, TZ);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

describe('seriesDates', () => {
  it('keeps 10:00 at 10:00 across the end of summer time (25.10.2026)', () => {
    // Tuesday 20 October 2026, 10:00 in Israel (summer time, UTC+3) = 07:00 UTC.
    const first = new Date('2026-10-20T07:00:00Z');
    const dates = seriesDates(first, new Date('2026-10-20T08:00:00Z'), 1, 3, TZ);
    expect(dates.map((d) => clock(d.start))).toEqual(['10:00', '10:00', '10:00']);
    expect(dates.map((d) => localDay(d.start))).toEqual(['2026-10-20', '2026-10-27', '2026-11-03']);
    // After the change the same wall-clock hour is 08:00 UTC.
    expect(dates[1]!.start.toISOString()).toBe('2026-10-27T08:00:00.000Z');
  });

  it('keeps 10:00 at 10:00 across the start of summer time (27.3.2026)', () => {
    // Tuesday 24 March 2026, 10:00 winter time (UTC+2) = 08:00 UTC.
    const first = new Date('2026-03-24T08:00:00Z');
    const dates = seriesDates(first, new Date('2026-03-24T08:45:00Z'), 1, 2, TZ);
    expect(dates.map((d) => clock(d.start))).toEqual(['10:00', '10:00']);
    expect(dates[1]!.start.toISOString()).toBe('2026-03-31T07:00:00.000Z');
  });

  it('keeps the length of the appointment', () => {
    const first = new Date('2026-10-20T07:00:00Z');
    const dates = seriesDates(first, new Date('2026-10-20T07:45:00Z'), 2, 3, TZ);
    for (const { start, end } of dates) expect(end.getTime() - start.getTime()).toBe(45 * 60_000);
    expect(dates.map((d) => localDay(d.start))).toEqual(['2026-10-20', '2026-11-03', '2026-11-17']);
  });

  it('keeps a late evening appointment on its own day', () => {
    // 23:30 local on a Sunday is 20:30 UTC the same day in summer.
    const first = new Date('2026-10-18T20:30:00Z');
    const dates = seriesDates(first, new Date('2026-10-18T21:15:00Z'), 1, 2, TZ);
    expect(dates.map((d) => `${localDay(d.start)} ${clock(d.start)}`)).toEqual([
      '2026-10-18 23:30',
      '2026-10-25 23:30',
    ]);
  });
});
