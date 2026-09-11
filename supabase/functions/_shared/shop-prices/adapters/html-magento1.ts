// Magento 1 shops (קלטבע): one sitemap, product pages in it.
//
// `/sitemap.xml` lists every page of the shop, product pages among them; a
// product page is one whose path ends in `.html` and is not a category
// listing (the config may narrow that with `product_pattern`). Each tick
// re-reads the sitemap (one request, so the bookmark stays a number) and
// reads a batch of product pages from where it stopped. Awaiting the shop's
// written agreement; see html-common.ts.

import { JobError } from '../errors.ts';
import { sitemapLocations } from '../html.ts';
import type { Adapter, AdapterContext, AdapterPage, Bookmark } from '../types.ts';
import { BATCH, readProductPages } from './html-common.ts';

export function productUrls(xml: string, pattern: RegExp): string[] {
  return sitemapLocations(xml).filter((url) => pattern.test(url));
}

export const htmlMagento1: Adapter = {
  paths(store) {
    const sitemap = typeof store.config.sitemap === 'string' ? store.config.sitemap : '/sitemap.xml';
    return [sitemap, '/'];
  },
  async fetchPage(context: AdapterContext, bookmark: Bookmark | null): Promise<AdapterPage> {
    const config = context.store.config;
    const sitemap = typeof config.sitemap === 'string' ? config.sitemap : '/sitemap.xml';
    const pattern = new RegExp(typeof config.product_pattern === 'string' ? config.product_pattern : '/[^/]+\\.html$', 'i');
    const index = bookmark && typeof bookmark.index === 'number' ? Math.max(0, bookmark.index) : 0;

    const listing = await context.fetcher.get(new URL(sitemap, context.store.base_url).toString(), {
      accept: 'application/xml, text/xml, */*;q=0.5',
    });
    if (!listing.ok) throw new JobError(`http_${listing.status}`);
    const urls = productUrls(listing.text, pattern);
    const batch = urls.slice(index, index + BATCH);
    const read = await readProductPages(context, batch);
    return {
      items: read.items,
      next: index + BATCH < urls.length ? { index: index + BATCH } : null,
      requests: read.requests + 1,
    };
  },
};
