import { describe, expect, it } from 'vitest';
import {
  addDays,
  addMinutes,
  combineDateAndTime,
  differenceInMinutes,
  fromDateKey,
  isSameDay,
  minutesSinceMidnight,
  startOfWeek,
  toDateKey,
  toDateTimeLocalValue,
  toTimeValue,
} from './date-utils';

/**
 * Calendar maths, tested because the failure mode is subtle: an off-by-one here
 * shows an appointment on the wrong day rather than crashing.
 */
describe('week boundaries', () => {
  it('starts the week on Sunday, as the clinic does', () => {
    // 2026-09-09 is a Wednesday.
    const week = startOfWeek(new Date(2026, 8, 9));
    expect(week.getDay()).toBe(0);
    expect(toDateKey(week)).toBe('2026-09-06');
  });

  it('treats Sunday itself as the start of its own week', () => {
    const sunday = new Date(2026, 8, 6);
    expect(toDateKey(startOfWeek(sunday))).toBe('2026-09-06');
  });

  it('produces seven consecutive days', () => {
    const start = startOfWeek(new Date(2026, 8, 9));
    const keys = Array.from({ length: 7 }, (_, index) => toDateKey(addDays(start, index)));
    expect(keys).toEqual([
      '2026-09-06',
      '2026-09-07',
      '2026-09-08',
      '2026-09-09',
      '2026-09-10',
      '2026-09-11',
      '2026-09-12',
    ]);
  });
});

describe('date keys', () => {
  it('uses local time, not UTC', () => {
    // Late-evening local time is already the next day in UTC; toISOString() would
    // report tomorrow and put the appointment in the wrong column.
    const lateEvening = new Date(2026, 8, 6, 23, 30);
    expect(toDateKey(lateEvening)).toBe('2026-09-06');
  });

  it('round-trips through fromDateKey', () => {
    expect(toDateKey(fromDateKey('2026-02-28'))).toBe('2026-02-28');
  });

  it('survives a month boundary', () => {
    expect(toDateKey(addDays(fromDateKey('2026-01-31'), 1))).toBe('2026-02-01');
  });
});

describe('time helpers', () => {
  it('formats a zero-padded local time', () => {
    expect(toTimeValue(new Date(2026, 8, 6, 9, 5))).toBe('09:05');
  });

  it('builds a datetime-local value the browser accepts', () => {
    expect(toDateTimeLocalValue(new Date(2026, 8, 6, 14, 0))).toBe('2026-09-06T14:00');
  });

  it('combines a date key and a time into local wall-clock', () => {
    const combined = combineDateAndTime('2026-09-06', '08:45');
    expect(combined.getHours()).toBe(8);
    expect(combined.getMinutes()).toBe(45);
    expect(toDateKey(combined)).toBe('2026-09-06');
  });

  it('measures minutes since midnight for grid placement', () => {
    expect(minutesSinceMidnight(new Date(2026, 8, 6, 7, 30))).toBe(450);
  });

  it('adds minutes across an hour boundary', () => {
    expect(toTimeValue(addMinutes(new Date(2026, 8, 6, 9, 45), 30))).toBe('10:15');
  });

  it('computes appointment length', () => {
    expect(
      differenceInMinutes(new Date(2026, 8, 6, 10, 30), new Date(2026, 8, 6, 9, 0)),
    ).toBe(90);
  });
});

describe('isSameDay', () => {
  it('ignores the time of day', () => {
    expect(isSameDay(new Date(2026, 8, 6, 1, 0), new Date(2026, 8, 6, 23, 0))).toBe(true);
  });

  it('separates adjacent days', () => {
    expect(isSameDay(new Date(2026, 8, 6, 23, 59), new Date(2026, 8, 7, 0, 1))).toBe(false);
  });
});
