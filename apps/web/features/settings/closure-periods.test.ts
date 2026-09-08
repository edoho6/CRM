import { describe, expect, it } from 'vitest';
import { groupClosures, type ClosureDay } from './closure-periods';

const day = (
  date: string,
  reason: string | null = 'חופשה',
  extra: Partial<ClosureDay> = {},
): ClosureDay => ({
  id: date,
  date,
  reason,
  isClosed: true,
  startTime: null,
  endTime: null,
  ...extra,
});

describe('groupClosures', () => {
  it('joins consecutive days into one period', () => {
    const periods = groupClosures([
      day('2026-09-01'),
      day('2026-09-02'),
      day('2026-09-03'),
    ]);

    expect(periods).toEqual([
      { from: '2026-09-01', to: '2026-09-03', reason: 'חופשה', isClosed: true, startTime: null, endTime: null, days: 3 },
    ]);
  });

  it('keeps a gap as two periods', () => {
    const periods = groupClosures([day('2026-09-01'), day('2026-09-03')]);
    expect(periods).toHaveLength(2);
  });

  it('does not merge across a different reason', () => {
    // Two facts that happen to touch. Merging would put one reason on both.
    const periods = groupClosures([
      day('2026-09-01', 'קורס'),
      day('2026-09-02', 'הלוויה'),
    ]);

    expect(periods.map((period) => period.reason)).toEqual(['קורס', 'הלוויה']);
  });

  it('crosses a month boundary', () => {
    const periods = groupClosures([day('2026-09-30'), day('2026-10-01')]);
    expect(periods).toEqual([
      { from: '2026-09-30', to: '2026-10-01', reason: 'חופשה', isClosed: true, startTime: null, endTime: null, days: 2 },
    ]);
  });

  it('crosses a year boundary', () => {
    const periods = groupClosures([day('2026-12-31'), day('2027-01-01')]);
    expect(periods[0]!.days).toBe(2);
  });

  it('crosses a daylight-saving change without losing a day', () => {
    // Israel moves its clocks in late March. Stepping in local time would land
    // on the same day twice and the run would come out short.
    const periods = groupClosures([
      day('2026-03-26'),
      day('2026-03-27'),
      day('2026-03-28'),
      day('2026-03-29'),
      day('2026-03-30'),
    ]);

    expect(periods).toHaveLength(1);
    expect(periods[0]!.days).toBe(5);
  });

  it('sorts input that arrives out of order', () => {
    const periods = groupClosures([day('2026-09-03'), day('2026-09-01'), day('2026-09-02')]);
    expect(periods).toEqual([
      { from: '2026-09-01', to: '2026-09-03', reason: 'חופשה', isClosed: true, startTime: null, endTime: null, days: 3 },
    ]);
  });

  it('ignores a duplicate date rather than counting it twice', () => {
    const periods = groupClosures([day('2026-09-01'), day('2026-09-01'), day('2026-09-02')]);
    expect(periods[0]!.days).toBe(2);
  });

  it('treats a null reason and an empty one as the same', () => {
    const periods = groupClosures([day('2026-09-01', null), day('2026-09-02', null)]);
    expect(periods).toHaveLength(1);
  });

  it('returns nothing for no closures', () => {
    expect(groupClosures([])).toEqual([]);
  });

  it('joins a run of identically shortened days', () => {
    const short = { isClosed: false, startTime: '14:00', endTime: '18:00' };
    const periods = groupClosures([
      day('2026-09-01', 'קורס', short),
      day('2026-09-02', 'קורס', short),
    ]);

    expect(periods).toHaveLength(1);
    expect(periods[0]).toMatchObject({ isClosed: false, startTime: '14:00', days: 2 });
  });

  it('does not merge a shortened day into a closed one', () => {
    // A week off then a week of afternoons is two facts. Merged, one set of
    // hours would be printed over days that do not have them.
    const periods = groupClosures([
      day('2026-09-01', 'חופשה'),
      day('2026-09-02', 'חופשה', { isClosed: false, startTime: '14:00', endTime: '18:00' }),
    ]);

    expect(periods).toHaveLength(2);
  });

  it('does not merge two runs with different hours', () => {
    const periods = groupClosures([
      day('2026-09-01', 'קורס', { isClosed: false, startTime: '14:00', endTime: '18:00' }),
      day('2026-09-02', 'קורס', { isClosed: false, startTime: '09:00', endTime: '12:00' }),
    ]);

    expect(periods).toHaveLength(2);
  });
});
