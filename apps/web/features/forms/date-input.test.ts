import { describe, expect, it } from 'vitest';
import { fromDisplayDate, maskDate, toDisplayDate } from '@clinic/ui';

describe('date field, day/month/year', () => {
  it('shows a stored date as dd/mm/yyyy and leaves anything else alone', () => {
    expect(toDisplayDate('1987-03-09')).toBe('09/03/1987');
    expect(toDisplayDate('')).toBe('');
    expect(toDisplayDate('not a date')).toBe('not a date');
  });

  it('reads dd/mm/yyyy back as a real calendar date only', () => {
    expect(fromDisplayDate('09/03/1987')).toBe('1987-03-09');
    expect(fromDisplayDate('31/02/2026')).toBeNull();
    expect(fromDisplayDate('03/09/26')).toBeNull();
    expect(fromDisplayDate('00/01/2026')).toBeNull();
    expect(fromDisplayDate('29/02/2024')).toBe('2024-02-29');
  });

  it('writes the slashes itself while digits are typed', () => {
    expect(maskDate('3')).toBe('3');
    expect(maskDate('0309')).toBe('03/09');
    expect(maskDate('03092026')).toBe('03/09/2026');
    expect(maskDate('03/')).toBe('03/');
    expect(maskDate('03/09/2026x')).toBe('03/09/2026');
    expect(maskDate('0309202699')).toBe('03/09/2026');
  });
});
