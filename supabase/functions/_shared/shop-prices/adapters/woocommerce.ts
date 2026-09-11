// WooCommerce, through the Store API the shop's own pages use.
//
// `/wp-json/wc/store/v1/products` is public, documented, paged and JSON —
// one request per hundred products, with the name, the price, the link, the
// SKU and the shop's categories in it. The response also carries the
// description and the pictures; they are not read. A variable product (four
// needle sizes under one name) is one listing at its lowest price and the
// shop's own page picks the size.

import { decodeEntities } from '../html.ts';
import { JobError } from '../errors.ts';
import type { Adapter, AdapterContext, AdapterPage, Bookmark, RawItem, StoreRow } from '../types.ts';

interface WooProduct {
  id: number;
  name: string;
  permalink: string;
  sku?: string | null;
  global_unique_id?: string | null;
  is_purchasable?: boolean;
  is_in_stock?: boolean;
  prices?: {
    price?: string | null;
    currency_code?: string;
    currency_minor_unit?: number;
  };
  categories?: { name: string }[];
}

export const PER_PAGE = 100;

function pageOf(position: Bookmark | null): number {
  const page = position && typeof position.page === 'number' ? position.page : 1;
  return page >= 1 ? page : 1;
}

export function parseWooPage(text: string): WooProduct[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new JobError('bad_json');
  }
  if (!Array.isArray(parsed)) throw new JobError('bad_json');
  return parsed as WooProduct[];
}

export function wooItems(products: WooProduct[]): RawItem[] {
  const items: RawItem[] = [];
  for (const product of products) {
    if (!product || typeof product.id !== 'number' || !product.name || !product.permalink) continue;
    if (product.is_purchasable === false) continue;
    const raw = product.prices?.price;
    if (raw === null || raw === undefined || raw === '') continue;
    const minor = product.prices?.currency_minor_unit ?? 2;
    const price = Number(raw) / 10 ** minor;
    if (!Number.isFinite(price)) continue;
    items.push({
      externalId: String(product.id),
      name: decodeEntities(product.name).replace(/\s+/g, ' ').trim(),
      url: product.permalink,
      price,
      currency: product.prices?.currency_code || 'ILS',
      sku: product.sku ? String(product.sku) : null,
      gtin: product.global_unique_id ? String(product.global_unique_id) : null,
      available: product.is_in_stock !== false,
      categories: (product.categories ?? []).map((c) => decodeEntities(c.name)),
    });
  }
  return items;
}

export const woocommerce: Adapter = {
  paths() {
    return ['/wp-json/wc/store/v1/products'];
  },
  async fetchPage(context: AdapterContext, position: Bookmark | null): Promise<AdapterPage> {
    const page = pageOf(position);
    const url = new URL(`/wp-json/wc/store/v1/products?per_page=${PER_PAGE}&page=${page}`, context.store.base_url).toString();
    const result = await context.fetcher.get(url, { accept: 'application/json' });
    if (!result.ok) throw new JobError(`http_${result.status}`);
    const products = parseWooPage(result.text);
    const totalPages = Number(result.headers['x-wp-totalpages'] ?? '1');
    const last = Number.isFinite(totalPages) && totalPages >= 1 ? totalPages : 1;
    return {
      items: wooItems(products),
      next: page < last && products.length > 0 ? { page: page + 1 } : null,
      requests: 1,
    };
  },
};

export function storeConfigNote(_store: StoreRow): string {
  return 'WooCommerce Store API';
}
