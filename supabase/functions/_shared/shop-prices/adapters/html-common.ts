// What the page-reading adapters share.
//
// These adapters exist for shops that publish no product feed, and they run
// only for a store whose status an admin set to active after the shop
// agreed in writing (SECURITY.md, "Shared tables"). Until then they are
// exercised by tests against hand-written pages, never against the shops.
// A product page is asked for its name and its price, through JSON-LD when
// the page has it and through the ordinary meta tags when it does not; the
// rest of the page is discarded unread.

import { JobError } from '../errors.ts';
import { nameFromPage, priceFromPage } from '../html.ts';
import type { AdapterContext, RawItem } from '../types.ts';

/** Product pages read per tick of a page-reading adapter, so a tick stays inside its minute. */
export const BATCH = 8;

/** A last resort for a page with no structured price: the first shekel amount on it. */
export function shekelPrice(html: string): number | null {
  const m = html.match(/(?:₪|&#8362;|&#x20aa;|ils)\s*([\d,]+(?:\.\d{1,2})?)/i) ?? html.match(/([\d,]+(?:\.\d{1,2})?)\s*(?:₪|&#8362;|&#x20aa;|ils)/i);
  if (!m) return null;
  const price = parseFloat(m[1].replace(/,/g, ''));
  return Number.isFinite(price) && price > 0 ? price : null;
}

export function itemFromPage(html: string, url: string, externalId: string, categories: string[]): RawItem | null {
  const name = nameFromPage(html);
  if (!name) return null;
  const structured = priceFromPage(html);
  const price = structured?.price ?? shekelPrice(html);
  if (price === null || !Number.isFinite(price) || price <= 0) return null;
  const unavailable = /(?:אזל|לא במלאי|out of stock|sold out|schema\.org\/OutOfStock)/i.test(html);
  return {
    externalId,
    name,
    url,
    price,
    currency: structured?.currency ?? 'ILS',
    sku: null,
    gtin: null,
    available: !unavailable,
    categories,
  };
}

/** Reads one batch of product pages, in order, honouring the pause between them through the fetcher. */
export async function readProductPages(
  context: AdapterContext,
  urls: string[],
  categoriesFor: (url: string) => string[] = () => [],
): Promise<{ items: RawItem[]; requests: number }> {
  const items: RawItem[] = [];
  let requests = 0;
  for (const url of urls) {
    const path = new URL(url).pathname;
    if (!context.robots.allows(path)) continue;
    const result = await context.fetcher.get(url, { accept: 'text/html' });
    requests += 1;
    if (result.status === 404 || result.status === 410) continue;
    if (!result.ok) throw new JobError(`http_${result.status}`);
    const item = itemFromPage(result.text, result.url || url, path, categoriesFor(url));
    if (item) items.push(item);
  }
  return { items, requests };
}
