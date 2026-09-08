import { describe, expect, it } from 'vitest';
import { formatDate, formatDateTime, formatTime } from '@clinic/i18n';

/**
 * The date format is a decision, so it is a test.
 *
 * `dd/MM/yyyy`, with slashes, in both languages. Left to the locale it would be
 * neither: `en` resolves to American order and would render the third of
 * September as `09/03/2026`, and `he` renders it with dots. Both are wrong here
 * and only one of them looks wrong, which is what makes it worth pinning.
 */
describe('formatDate', () => {
  it('is day-first with slashes', () => {
    expect(formatDate(new Date('2026-09-03T10:00:00+03:00'))).toBe('03/09/2026');
  });

  it('pads a single-digit day and month', () => {
    expect(formatDate(new Date('2026-01-05T10:00:00+02:00'))).toBe('05/01/2026');
  });

  it('is never the American order', () => {
    // The one that matters: on this date the two conventions disagree, and
    // reading it the wrong way round is a treatment recorded six months out.
    expect(formatDate(new Date('2026-09-03T10:00:00+03:00'))).not.toBe('09/03/2026');
  });

  it('accepts a plain date string from the database', () => {
    expect(formatDate('2026-12-31')).toBe('31/12/2026');
  });

  it('renders an unparseable value as a dash, not "Invalid Date"', () => {
    expect(formatDate('not a date')).toBe('—');
  });
});

describe('formatDateTime and formatTime', () => {
  it('uses a 24-hour clock', () => {
    const evening = new Date('2026-09-03T20:30:00+03:00');
    expect(formatDateTime(evening)).toContain('20:30');
    expect(formatTime(evening)).toBe('20:30');
  });

  it('never renders am or pm', () => {
    const morning = new Date('2026-09-03T08:05:00+03:00');
    expect(formatTime(morning)).toBe('08:05');
    expect(formatDateTime(morning).toLowerCase()).not.toMatch(/am|pm/);
  });

  it('is anchored to the clinic time zone, not the machine', () => {
    // 22:00 UTC is the next day in Jerusalem. A machine set to UTC must not
    // show the practitioner a different date from the one they booked.
    expect(formatDate('2026-09-03T22:00:00Z')).toBe('04/09/2026');
  });
});
