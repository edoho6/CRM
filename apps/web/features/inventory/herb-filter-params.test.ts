import { describe, expect, it } from 'vitest';
import {
  activeFilterCount,
  herbFilterQuery,
  parseHerbFilters,
  toggledQuery,
} from './herb-filter-params';

describe('herb filters in the URL', () => {
  it('keeps only known values, drops duplicates and reads the review flag', () => {
    const filters = parseHerbFilters({
      q: '  bai shao ',
      cat: 'tonify_qi,nonsense,tonify_blood,tonify_qi',
      temp: 'warm',
      review: '1',
    });
    expect(filters).toEqual({
      q: 'bai shao',
      cat: ['tonify_qi', 'tonify_blood'],
      temp: ['warm'],
      taste: [],
      chan: [],
      review: true,
    });
    expect(activeFilterCount(filters)).toBe(4);
    expect(parseHerbFilters({})).toEqual({
      q: '',
      cat: [],
      temp: [],
      taste: [],
      chan: [],
      review: false,
    });
  });

  it('writes nothing that is empty', () => {
    expect(
      herbFilterQuery({ q: '', cat: [], temp: [], taste: [], chan: [], review: false }),
    ).toEqual({});
  });

  /*
   * The two halves of the reader's complaint on 15.9: a chip that is already on
   * has to switch itself off, and "clear" has to reach the bare list. Both are
   * only ever an href, so both are testable without a browser.
   */
  it('switches a chip off when it is already on', () => {
    const filters = parseHerbFilters({ cat: 'tonify_qi,tonify_blood', temp: 'warm' });
    expect(toggledQuery(filters, 'cat', 'tonify_blood')).toEqual({
      cat: 'tonify_qi',
      temp: 'warm',
    });
    // The last value of a facet leaves the facet out altogether, not empty.
    expect(toggledQuery(parseHerbFilters({ cat: 'tonify_qi' }), 'cat', 'tonify_qi')).toEqual({});
  });

  it('switches a chip on without disturbing the others', () => {
    const filters = parseHerbFilters({ cat: 'tonify_qi', q: 'gui' });
    expect(toggledQuery(filters, 'taste', 'sweet')).toEqual({
      q: 'gui',
      cat: 'tonify_qi',
      taste: 'sweet',
    });
  });

  it('clears every facet but keeps the search', () => {
    const filters = parseHerbFilters({
      q: 'gui',
      cat: 'tonify_qi',
      temp: 'warm',
      taste: 'sweet',
      chan: 'SP',
      review: '1',
    });
    expect(
      herbFilterQuery({ ...filters, cat: [], temp: [], taste: [], chan: [], review: false }),
    ).toEqual({ q: 'gui' });
  });
});
