// CashCow shops (ברטיפול): a paged sitemap of product pages.
//
// The shop's sitemap lives at `/crowlers/sitemap?page=N` and lists product
// pages under `/p/<slug>`. Each tick reads the sitemap page it is on (one
// request) and then a batch of product pages. Awaiting the shop's written
// agreement; see html-common.ts.

import { JobError } from '../errors.ts';
import { sitemapLocations } from '../html.ts';
import type { Adapter, AdapterContext, AdapterPage, Bookmark } from '../types.ts';
import { BATCH, readProductPages } from './html-common.ts';

interface Position {
  sitemapPage: number;
  index: number;
}

function positionOf(position: Bookmark | null): Position {
  const sitemapPage = position && typeof position.sitemapPage === 'number' ? position.sitemapPage : 1;
  const index = position && typeof position.index === 'number' ? position.index : 0;
  return { sitemapPage: Math.max(1, sitemapPage), index: Math.max(0, index) };
}

export const htmlCashcow: Adapter = {
  paths(store) {
    const sitemap = typeof store.config.sitemap === 'string' ? store.config.sitemap : '/crowlers/sitemap';
    return [sitemap, '/p/'];
  },
  async fetchPage(context: AdapterContext, bookmark: Bookmark | null): Promise<AdapterPage> {
    const config = context.store.config;
    const sitemap = typeof config.sitemap === 'string' ? config.sitemap : '/crowlers/sitemap';
    const maxPages = typeof config.sitemapPages === 'number' ? config.sitemapPages : 20;
    const { sitemapPage, index } = positionOf(bookmark);

    const sitemapUrl = new URL(`${sitemap}?page=${sitemapPage}`, context.store.base_url).toString();
    const listing = await context.fetcher.get(sitemapUrl, { accept: 'application/xml, text/xml, */*;q=0.5' });
    if (!listing.ok) throw new JobError(`http_${listing.status}`);
    const urls = sitemapLocations(listing.text).filter((url) => /\/p\//.test(url));
    if (urls.length === 0) return { items: [], next: null, requests: 1 };

    const batch = urls.slice(index, index + BATCH);
    const { items, requests } = await readProductPages(context, batch);
    let next: Bookmark | null = null;
    if (index + BATCH < urls.length) next = { sitemapPage, index: index + BATCH };
    else if (sitemapPage < maxPages) next = { sitemapPage: sitemapPage + 1, index: 0 };
    return { items, next, requests: requests + 1 };
  },
};
