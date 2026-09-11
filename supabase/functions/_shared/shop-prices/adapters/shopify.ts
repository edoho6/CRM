// Shopify, through `/products.json`.
//
// Every Shopify shop publishes its catalogue at `/products.json` and each
// collection at `/collections/<handle>/products.json`, 250 products a page.
// A shop whose config names collections is read collection by collection —
// Rosamix sells far more than clinic supplies, and only its "ציוד למטפלים"
// collection is the comparison's business. Each variant is its own listing,
// because "בקבוק 10 מ"ל" and "בקבוק 100 מ"ל" are two prices under one title.

import { decodeEntities } from '../html.ts';
import { JobError } from '../errors.ts';
import type { Adapter, AdapterContext, AdapterPage, Bookmark, RawItem, StoreRow } from '../types.ts';

interface ShopifyVariant {
  id: number;
  title?: string;
  sku?: string | null;
  barcode?: string | null;
  price?: string;
  available?: boolean;
}

interface ShopifyProduct {
  id: number;
  title: string;
  handle: string;
  product_type?: string;
  tags?: string[] | string;
  variants?: ShopifyVariant[];
}

export const LIMIT = 250;

export function collectionsOf(store: StoreRow): string[] {
  const raw = store.config.collections;
  return Array.isArray(raw) ? raw.filter((c): c is string => typeof c === 'string' && c.length > 0) : [];
}

function feedPath(collection: string | null): string {
  return collection ? `/collections/${encodeURIComponent(collection)}/products.json` : '/products.json';
}

export function parseShopifyPage(text: string): ShopifyProduct[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new JobError('bad_json');
  }
  const products = (parsed as { products?: unknown })?.products;
  if (!Array.isArray(products)) throw new JobError('bad_json');
  return products as ShopifyProduct[];
}

export function shopifyItems(products: ShopifyProduct[], baseUrl: string): RawItem[] {
  const items: RawItem[] = [];
  for (const product of products) {
    if (!product || typeof product.id !== 'number' || !product.title || !product.handle) continue;
    const variants = product.variants ?? [];
    const tags = Array.isArray(product.tags)
      ? product.tags
      : typeof product.tags === 'string'
        ? product.tags.split(',').map((t) => t.trim())
        : [];
    const categories = [product.product_type ?? '', ...tags].filter((c) => c.length > 0);
    const title = decodeEntities(product.title).replace(/\s+/g, ' ').trim();
    for (const variant of variants) {
      const price = Number(variant.price);
      if (!Number.isFinite(price)) continue;
      const variantTitle = variant.title && variant.title !== 'Default Title' ? decodeEntities(variant.title).trim() : '';
      const url = new URL(`/products/${product.handle}${variants.length > 1 ? `?variant=${variant.id}` : ''}`, baseUrl).toString();
      items.push({
        externalId: `${product.id}:${variant.id}`,
        name: variantTitle ? `${title} ${variantTitle}` : title,
        url,
        price,
        currency: 'ILS',
        sku: variant.sku ? String(variant.sku) : null,
        gtin: variant.barcode ? String(variant.barcode) : null,
        available: variant.available !== false,
        categories,
      });
    }
  }
  return items;
}

export const shopify: Adapter = {
  paths(store) {
    const collections = collectionsOf(store);
    return collections.length > 0 ? collections.map(feedPath) : [feedPath(null)];
  },
  async fetchPage(context: AdapterContext, position: Bookmark | null): Promise<AdapterPage> {
    const collections = collectionsOf(context.store);
    const collectionIndex = position && typeof position.collection === 'number' ? position.collection : 0;
    const page = position && typeof position.page === 'number' && position.page >= 1 ? position.page : 1;
    const collection = collections[collectionIndex] ?? null;
    const url = new URL(`${feedPath(collection)}?limit=${LIMIT}&page=${page}`, context.store.base_url).toString();
    const result = await context.fetcher.get(url, { accept: 'application/json' });
    if (!result.ok) throw new JobError(`http_${result.status}`);
    const products = parseShopifyPage(result.text);
    let next: Bookmark | null = null;
    if (products.length >= LIMIT) next = { collection: collectionIndex, page: page + 1 };
    else if (collectionIndex + 1 < collections.length) next = { collection: collectionIndex + 1, page: 1 };
    return { items: shopifyItems(products, context.store.base_url), next, requests: 1 };
  },
};
