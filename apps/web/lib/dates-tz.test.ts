import { describe, expect, it } from 'vitest';
import {
  addDaysIn,
  addMonthsIn,
  dateKeyIn,
  dayBoundsIn,
  monthStartIn,
  startOfWeekIn,
  zoneOffsetMinutes,
} from '@clinic/domain';

const TZ = 'Asia/Jerusalem';

describe('day boundaries in the clinic zone', () => {
  it('finds the clinic day from an instant that is still yesterday in UTC', () => {
    // 00:30 in Jerusalem on the 11th is 21:30 UTC on the 10th (summer, UTC+3).
    const instant = new Date('2026-09-10T21:30:00Z');
    expect(dateKeyIn(instant, TZ)).toBe('2026-09-11');
    const { start, end } = dayBoundsIn(instant, TZ);
    expect(start.toISOString()).toBe('2026-09-10T21:00:00.000Z');
    expect(end.toISOString()).toBe('2026-09-11T21:00:00.000Z');
  });

  it('keeps midnight at midnight across the end of daylight saving', () => {
    // Israel leaves summer time on 2026-10-25 at 02:00: that day has 25 hours.
    const before = dayBoundsIn(new Date('2026-10-24T10:00:00Z'), TZ);
    expect(before.start.toISOString()).toBe('2026-10-23T21:00:00.000Z');
    const changeDay = addDaysIn(before.start, 1, TZ);
    expect(changeDay.toISOString()).toBe('2026-10-24T21:00:00.000Z');
    const after = addDaysIn(changeDay, 1, TZ);
    expect(after.toISOString()).toBe('2026-10-25T22:00:00.000Z');
    expect(zoneOffsetMinutes(changeDay, TZ)).toBe(180);
    expect(zoneOffsetMinutes(after, TZ)).toBe(120);
  });

  it('steps weeks from Sunday and months from the first', () => {
    const friday = new Date('2026-09-11T08:00:00Z');
    expect(dateKeyIn(startOfWeekIn(friday, TZ), TZ)).toBe('2026-09-06');
    expect(dateKeyIn(monthStartIn(friday, TZ), TZ)).toBe('2026-09-01');
    expect(dateKeyIn(addMonthsIn(friday, -1, TZ), TZ)).toBe('2026-08-01');
    expect(dateKeyIn(addMonthsIn(friday, 4, TZ), TZ)).toBe('2027-01-01');
  });

  it('works for a zone west of Greenwich too', () => {
    const instant = new Date('2026-03-08T03:30:00Z'); // 22:30 on the 7th in New York
    expect(dateKeyIn(instant, 'America/New_York')).toBe('2026-03-07');
    const { start } = dayBoundsIn(instant, 'America/New_York');
    expect(start.toISOString()).toBe('2026-03-07T05:00:00.000Z');
  });
});
