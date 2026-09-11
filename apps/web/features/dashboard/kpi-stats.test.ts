import { describe, expect, it } from 'vitest';
import { computeStats } from './kpi-stats';

const row = (date: string, id = date) => ({
  id,
  encounter_date: date,
  created_at: `${date}T09:00:00Z`,
  status: 'draft',
  patient: null,
});

// Friday 11 September 2026, 11:00 in Jerusalem.
const now = new Date('2026-09-11T08:00:00Z');
const timeZone = 'Asia/Jerusalem';

describe('computeStats', () => {
  it('counts today, the week from Sunday and the calendar month, each against the period before', () => {
    const rows = [
      row('2026-09-11', 'a'),
      row('2026-09-11', 'b'),
      row('2026-09-10'),
      row('2026-09-06'), // Sunday: in this week
      row('2026-09-05'), // Saturday: last week
      row('2026-08-30'), // last week, last month
      row('2026-08-02'),
      row('2026-07-31'), // before the window; ignored
    ];
    const stats = computeStats(rows, { now, timeZone });
    expect(stats.today).toMatchObject({ current: 2, previous: 1 });
    expect(stats.week).toMatchObject({ current: 4, previous: 2 });
    expect(stats.month).toMatchObject({ current: 5, previous: 2 });
  });

  it('breaks the periods into days with today marked', () => {
    const stats = computeStats([row('2026-09-11')], { now, timeZone });
    expect(stats.today.days.map((day) => day.key)).toEqual([
      '2026-09-05',
      '2026-09-06',
      '2026-09-07',
      '2026-09-08',
      '2026-09-09',
      '2026-09-10',
      '2026-09-11',
    ]);
    expect(stats.today.days.at(-1)).toMatchObject({ count: 1, isToday: true });
    expect(stats.week.days).toHaveLength(7);
    expect(stats.week.days[0]?.key).toBe('2026-09-06');
    expect(stats.month.days).toHaveLength(30);
    expect(stats.month.days.filter((day) => day.isToday)).toHaveLength(1);
  });

  it('takes the day from the clinic zone, not from UTC', () => {
    // 23:30 UTC on the 10th is already the 11th in Jerusalem.
    const late = new Date('2026-09-10T23:30:00Z');
    const stats = computeStats([row('2026-09-11')], { now: late, timeZone });
    expect(stats.today.current).toBe(1);
    expect(computeStats([row('2026-09-11')], { now: late, timeZone: 'UTC' }).today.current).toBe(0);
  });
});
