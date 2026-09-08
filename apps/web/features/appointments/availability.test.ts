import { describe, expect, it } from 'vitest';
import {
  closureFor,
  isClosedDay,
  isWithinWorkingHours,
  openIntervalsFor,
  type Availability,
} from './availability';

/* Sunday 0 … Saturday 6. 2026-09-06 is a Sunday. */
const SUNDAY = new Date(2026, 8, 6, 10, 0);
const MONDAY = new Date(2026, 8, 7, 10, 0);
const FRIDAY = new Date(2026, 8, 11, 10, 0);

const availability: Availability = {
  blocks: [
    // Sunday: a morning and an afternoon, with a break between them.
    { weekday: 0, start_time: '09:00:00', end_time: '13:00:00' },
    { weekday: 0, start_time: '16:00:00', end_time: '20:00:00' },
    { weekday: 1, start_time: '08:00:00', end_time: '17:00:00' },
    // Friday is absent: not a working day.
  ],
  exceptions: [
    { date: '2026-09-07', is_closed: true, start_time: null, end_time: null, reason: 'חג' },
    {
      date: '2026-09-13',
      is_closed: false,
      start_time: '10:00:00',
      end_time: '12:00:00',
      reason: 'יום קצר',
    },
  ],
};

describe('openIntervalsFor', () => {
  it('returns the blocks for that weekday, in order', () => {
    expect(openIntervalsFor(SUNDAY, availability)).toEqual([
      { start: 540, end: 780 },
      { start: 960, end: 1200 },
    ]);
  });

  it('returns nothing for a day with no blocks', () => {
    expect(openIntervalsFor(FRIDAY, availability)).toEqual([]);
  });

  it('returns nothing for a closed exception', () => {
    expect(openIntervalsFor(MONDAY, availability)).toEqual([]);
  });

  it('lets an exception replace the weekly pattern rather than add to it', () => {
    // 2026-09-13 is a Sunday, which normally has two blocks.
    const shortSunday = new Date(2026, 8, 13, 10, 0);
    expect(openIntervalsFor(shortSunday, availability)).toEqual([{ start: 600, end: 720 }]);
  });
});

describe('isWithinWorkingHours', () => {
  const on = (day: Date, from: string, to: string) => {
    const [fh, fm] = from.split(':').map(Number);
    const [th, tm] = to.split(':').map(Number);
    const start = new Date(day);
    start.setHours(fh!, fm!, 0, 0);
    const end = new Date(day);
    end.setHours(th!, tm!, 0, 0);
    return isWithinWorkingHours(start, end, availability);
  };

  it('accepts an appointment inside a block', () => {
    expect(on(SUNDAY, '10:00', '11:00')).toBe(true);
  });

  it('accepts one that ends exactly at closing time', () => {
    expect(on(SUNDAY, '12:00', '13:00')).toBe(true);
  });

  it('rejects one that starts before opening', () => {
    expect(on(SUNDAY, '08:00', '10:00')).toBe(false);
  });

  it('rejects one that runs past closing', () => {
    expect(on(SUNDAY, '19:00', '21:00')).toBe(false);
  });

  it('rejects one that spans the break between two blocks', () => {
    // 12:00–17:00 covers the end of the morning and the start of the evening,
    // and the two hours of lunch in between.
    expect(on(SUNDAY, '12:00', '17:00')).toBe(false);
  });

  it('rejects a day with no blocks at all', () => {
    expect(on(FRIDAY, '10:00', '11:00')).toBe(false);
  });

  it('rejects a closed exception', () => {
    expect(on(MONDAY, '10:00', '11:00')).toBe(false);
  });

  it('accepts everything when no hours have been set', () => {
    const empty: Availability = { blocks: [], exceptions: [] };
    const start = new Date(2026, 8, 6, 3, 0);
    const end = new Date(2026, 8, 6, 4, 0);
    // Warning about every booking because a setting is empty teaches people to
    // ignore the warning.
    expect(isWithinWorkingHours(start, end, empty)).toBe(true);
  });

  it('rejects an appointment that crosses midnight rather than wrapping', () => {
    const start = new Date(2026, 8, 6, 23, 0);
    const end = new Date(2026, 8, 7, 1, 0);
    expect(isWithinWorkingHours(start, end, availability)).toBe(false);
  });
});

describe('closed days', () => {
  it('reports a closure with its reason', () => {
    expect(closureFor(MONDAY, availability)?.reason).toBe('חג');
  });

  it('reports no closure for a working day', () => {
    expect(closureFor(SUNDAY, availability)).toBeNull();
  });

  it('treats a weekday with no blocks as closed', () => {
    expect(isClosedDay(FRIDAY, availability)).toBe(true);
    expect(isClosedDay(SUNDAY, availability)).toBe(false);
  });

  it('treats nothing as closed when no hours have been set', () => {
    expect(isClosedDay(FRIDAY, { blocks: [], exceptions: [] })).toBe(false);
  });
});
