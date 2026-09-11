import { describe, expect, it } from 'vitest';
import {
  activePriceFilterCount,
  parsePriceFilters,
  priceFilterQuery,
  toggledCategory,
} from './price-filter-params';

describe('price filters in the URL', () => {
  it('keeps only known categories, and reads the two-shops switch', () => {
    const filters = parsePriceFilters({ q: '  seirin ', cat: 'needles,nonsense,moxa,needles', min: '2' });
    expect(filters).toEqual({ q: 'seirin', cat: ['needles', 'moxa'], compared: true });
    expect(activePriceFilterCount(filters)).toBe(3);
    expect(parsePriceFilters({})).toEqual({ q: '', cat: [], compared: false });
    expect(parsePriceFilters({ min: '3' }).compared).toBe(false);
  });

  it('writes nothing that is the default and toggles a category in place', () => {
    expect(priceFilterQuery({ q: '', cat: [], compared: false })).toEqual({});
    expect(priceFilterQuery({ q: 'x', cat: ['cupping'], compared: true })).toEqual({ q: 'x', cat: 'cupping', min: '2' });
    const filters = parsePriceFilters({ cat: 'needles' });
    expect(toggledCategory(filters, 'moxa')).toEqual({ cat: 'needles,moxa' });
    expect(toggledCategory(filters, 'needles')).toEqual({});
  });
});
