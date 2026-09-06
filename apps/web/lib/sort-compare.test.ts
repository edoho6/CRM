import { describe, expect, it } from 'vitest';
import { compareSortValues, parseSortValues, sortCollator } from '@clinic/ui/sort-compare';

const collator = sortCollator('en');

/** Sorts a list the way a column header click does, so the assertions read as results. */
function order(values: (string | number | boolean | null | undefined)[], direction: 'asc' | 'desc' = 'asc') {
  return [...values].sort((a, b) => compareSortValues(a, b, direction, collator));
}

describe('compareSortValues', () => {
  it('sorts text alphabetically in both directions', () => {
    expect(order(['Gui Zhi', 'Bai Shao', 'Ma Huang'])).toEqual(['Bai Shao', 'Gui Zhi', 'Ma Huang']);
    expect(order(['Gui Zhi', 'Bai Shao', 'Ma Huang'], 'desc')).toEqual(['Ma Huang', 'Gui Zhi', 'Bai Shao']);
  });

  it('sorts numbers by magnitude, not by their spelling', () => {
    expect(order([9, 100, 30])).toEqual([9, 30, 100]);
    expect(order([9, 100, 30], 'desc')).toEqual([100, 30, 9]);
  });

  it('keeps empty cells at the bottom whichever way the column is sorted', () => {
    expect(order([3, null, 1])).toEqual([1, 3, null]);
    expect(order([3, null, 1], 'desc')).toEqual([3, 1, null]);
    expect(order(['b', '', 'a'], 'desc')).toEqual(['b', 'a', '']);
    expect(order(['b', undefined, 'a'])).toEqual(['a', 'b', undefined]);
  });

  it('treats false as lower than true', () => {
    expect(order([true, false, true])).toEqual([false, true, true]);
    expect(order([false, true], 'desc')).toEqual([true, false]);
  });

  it('ignores case and accents, the way a reader scanning a list does', () => {
    expect(compareSortValues('bai shao', 'Bai Shao', 'asc', collator)).toBe(0);
    expect(order(['Élan', 'Ebb'])).toEqual(['Ebb', 'Élan']);
  });

  it('orders embedded numbers naturally', () => {
    expect(order(['Batch 2', 'Batch 10', 'Batch 1'])).toEqual(['Batch 1', 'Batch 2', 'Batch 10']);
  });

  it('leaves equal values in their original order', () => {
    expect(compareSortValues('same', 'same', 'asc', collator)).toBe(0);
    expect(compareSortValues(null, undefined, 'desc', collator)).toBe(0);
  });
});

describe('parseSortValues', () => {
  it('reads the values a row carries', () => {
    expect(parseSortValues('{"name":"Ma Huang","dose":9}')).toEqual({ name: 'Ma Huang', dose: 9 });
  });

  it('returns nothing sortable rather than throwing on bad input', () => {
    expect(parseSortValues(undefined)).toEqual({});
    expect(parseSortValues('')).toEqual({});
    expect(parseSortValues('not json')).toEqual({});
    expect(parseSortValues('null')).toEqual({});
    expect(parseSortValues('"a string"')).toEqual({});
  });
});
