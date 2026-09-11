import type { SupabaseClient } from '@supabase/supabase-js';
import type { ShopOffer, ShopProductPrice, ShopStore } from '@clinic/db/types';
import type { SortState } from '@/lib/sort-params';
import { PAGE_SIZE, pageRange } from '@/components/pagination';
import { PRICE_SORT_COLUMNS, type PriceFilters, type PriceSortKey } from './price-filter-params';

/**
 * The price list's reads. Three queries, all through the reader's own
 * policies: the shops, a page of products from the view, and the offers of
 * the products on that page. Nothing here is per clinic — the tables are
 * shared — so nothing here filters by clinic.
 */

export type StoreSummary = Pick<ShopStore, 'id' | 'slug' | 'name' | 'name_en' | 'base_url' | 'status'>;

export async function listStores(supabase: SupabaseClient): Promise<Map<string, StoreSummary>> {
  const { data } = await supabase
    .from('shop_stores')
    .select('id, slug, name, name_en, base_url, status')
    .order('name', { ascending: true })
    .returns<StoreSummary[]>();
  return new Map((data ?? []).map((store) => [store.id, store]));
}

export async function listProducts(
  supabase: SupabaseClient,
  filters: PriceFilters,
  sort: SortState<PriceSortKey>,
  page: number,
): Promise<{ rows: ShopProductPrice[]; count: number | null }> {
  let query = supabase.from('shop_product_prices').select('*', { count: 'exact' });
  if (filters.q) {
    const escaped = filters.q.replace(/[%,()]/g, ' ');
    query = query.or(`canonical_name.ilike.%${escaped}%,search_text.ilike.%${escaped}%,brand.ilike.%${escaped}%`);
  }
  if (filters.cat.length) query = query.in('category', filters.cat);
  if (filters.compared) query = query.gte('store_count', 2);
  // A product no active shop lists any more sorts last, whichever way the
  // list is ordered: what it cost is still information, but not the headline.
  const result = await query
    .order(PRICE_SORT_COLUMNS[sort.key], { ascending: sort.dir === 'asc', nullsFirst: false })
    .order('canonical_name', { ascending: true })
    .range(...pageRange(page, PAGE_SIZE))
    .returns<ShopProductPrice[]>();
  return { rows: result.data ?? [], count: result.count };
}

/** The offers of the page's products from active shops, cheapest first, keyed by product. */
export async function listOffers(
  supabase: SupabaseClient,
  productIds: string[],
  activeStoreIds: string[],
): Promise<Map<string, ShopOffer[]>> {
  const byProduct = new Map<string, ShopOffer[]>();
  if (productIds.length === 0 || activeStoreIds.length === 0) return byProduct;
  const { data } = await supabase
    .from('shop_offers')
    .select('*')
    .in('product_id', productIds)
    .in('store_id', activeStoreIds)
    .order('is_available', { ascending: false })
    .order('price', { ascending: true })
    .returns<ShopOffer[]>();
  for (const offer of data ?? []) {
    const list = byProduct.get(offer.product_id) ?? [];
    list.push(offer);
    byProduct.set(offer.product_id, list);
  }
  return byProduct;
}
