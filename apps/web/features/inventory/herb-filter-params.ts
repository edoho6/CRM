import { CHANNELS, TASTES, TCM_CATEGORIES, TEMPERATURES } from '@clinic/domain';

/**
 * The herb catalogue's filter state lives entirely in the URL.
 *
 * That keeps the list a server component — no client state to hydrate before
 * the first row appears — and means a filtered view is a link: it can be
 * bookmarked, shared with a colleague, or kept open in a second tab while
 * working.
 */

export interface HerbFilters {
  q: string;
  cat: string[];
  temp: string[];
  taste: string[];
  chan: string[];
  review: boolean;
}

export type HerbFilterFacet = 'cat' | 'temp' | 'taste' | 'chan';

/** Allowed values per facet, so a hand-edited URL can never reach the query. */
const ALLOWED: Record<HerbFilterFacet, readonly string[]> = {
  cat: TCM_CATEGORIES,
  temp: TEMPERATURES,
  taste: TASTES,
  chan: CHANNELS,
};

export interface HerbSearchParams {
  q?: string;
  cat?: string;
  temp?: string;
  taste?: string;
  chan?: string;
  review?: string;
}

function parseList(raw: string | undefined, facet: HerbFilterFacet): string[] {
  if (!raw) return [];
  const allowed = ALLOWED[facet];
  const seen = new Set<string>();
  for (const value of raw.split(',')) {
    const trimmed = value.trim();
    if (trimmed && allowed.includes(trimmed)) seen.add(trimmed);
  }
  return [...seen];
}

export function parseHerbFilters(params: HerbSearchParams): HerbFilters {
  return {
    q: (params.q ?? '').trim(),
    cat: parseList(params.cat, 'cat'),
    temp: parseList(params.temp, 'temp'),
    taste: parseList(params.taste, 'taste'),
    chan: parseList(params.chan, 'chan'),
    review: params.review === '1',
  };
}

export function activeFilterCount(filters: HerbFilters): number {
  return (
    filters.cat.length +
    filters.temp.length +
    filters.taste.length +
    filters.chan.length +
    (filters.review ? 1 : 0)
  );
}

/** Serialises filters back to a query object, dropping everything empty. */
export function herbFilterQuery(filters: HerbFilters): Record<string, string> {
  const query: Record<string, string> = {};
  if (filters.q) query.q = filters.q;
  if (filters.cat.length) query.cat = filters.cat.join(',');
  if (filters.temp.length) query.temp = filters.temp.join(',');
  if (filters.taste.length) query.taste = filters.taste.join(',');
  if (filters.chan.length) query.chan = filters.chan.join(',');
  if (filters.review) query.review = '1';
  return query;
}

/** The query you land on when this one value is switched on or off. */
export function toggledQuery(
  filters: HerbFilters,
  facet: HerbFilterFacet,
  value: string,
): Record<string, string> {
  const current = filters[facet];
  const next = current.includes(value)
    ? current.filter((entry) => entry !== value)
    : [...current, value];
  return herbFilterQuery({ ...filters, [facet]: next });
}
