import { SHOP_CATEGORIES, type ShopCategory } from '@clinic/domain';
import type { SortState } from '@/lib/sort-params';

/**
 * The price list's state lives entirely in the URL, the way the catalogues'
 * does: a filtered, sorted page is a link, comes back with the browser's
 * back button, and is remembered by RememberQuery for the next visit.
 */

export interface PriceFilters {
  q: string;
  cat: ShopCategory[];
  /** Only products that at least two shops list — the ones there is a comparison for. */
  compared: boolean;
}

export interface PriceSearchParams {
  q?: string;
  cat?: string;
  min?: string;
  sort?: string;
  dir?: string;
  page?: string;
}

export const PRICE_SORT_KEYS = ['price', 'name', 'stores', 'updated'] as const;
export type PriceSortKey = (typeof PRICE_SORT_KEYS)[number];
export const PRICE_DEFAULT_SORT: SortState<PriceSortKey> = { key: 'price', dir: 'asc' };

/** The view column behind each sort key. */
export const PRICE_SORT_COLUMNS: Record<PriceSortKey, string> = {
  price: 'min_price',
  name: 'canonical_name',
  stores: 'store_count',
  updated: 'last_seen_at',
};

export function parsePriceFilters(params: PriceSearchParams): PriceFilters {
  const seen = new Set<ShopCategory>();
  for (const value of (params.cat ?? '').split(',')) {
    const trimmed = value.trim() as ShopCategory;
    if (trimmed && SHOP_CATEGORIES.includes(trimmed)) seen.add(trimmed);
  }
  return {
    q: (params.q ?? '').trim().slice(0, 80),
    cat: [...seen],
    compared: params.min === '2',
  };
}

/** The query for a URL, with nothing in it that is the default. */
export function priceFilterQuery(filters: PriceFilters): Record<string, string> {
  const query: Record<string, string> = {};
  if (filters.q) query.q = filters.q;
  if (filters.cat.length) query.cat = filters.cat.join(',');
  if (filters.compared) query.min = '2';
  return query;
}

export function toggledCategory(filters: PriceFilters, value: ShopCategory): Record<string, string> {
  const cat = filters.cat.includes(value) ? filters.cat.filter((c) => c !== value) : [...filters.cat, value];
  return priceFilterQuery({ ...filters, cat });
}

export function activePriceFilterCount(filters: PriceFilters): number {
  return filters.cat.length + (filters.compared ? 1 : 0);
}
