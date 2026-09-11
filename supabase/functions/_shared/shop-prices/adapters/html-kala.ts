// Kala CRM shops (מטפלים שופ): category pages that link to product pages.
//
// The shop publishes no sitemap, so the store's config names the category
// pages to read (`category_urls`) and the shape of a product link
// (`product_pattern`, a regular expression on the href). Each tick reads one
// category page, keeps its product links in the bookmark, and reads a batch
// of them. Awaiting the shop's written agreement; see html-common.ts.

import { JobError } from '../errors.ts';
import { absoluteUrl, matchAll } from '../html.ts';
import type { Adapter, AdapterContext, AdapterPage, Bookmark } from '../types.ts';
import { BATCH, readProductPages } from './html-common.ts';

interface Position {
  category: number;
  links: string[] | null;
  index: number;
}

function positionOf(bookmark: Bookmark | null): Position {
  const category = bookmark && typeof bookmark.category === 'number' ? bookmark.category : 0;
  const links = bookmark && Array.isArray(bookmark.links) ? (bookmark.links as string[]) : null;
  const index = bookmark && typeof bookmark.index === 'number' ? bookmark.index : 0;
  return { category: Math.max(0, category), links, index: Math.max(0, index) };
}

function categoryUrls(config: Record<string, unknown>): string[] {
  const raw = config.category_urls;
  return Array.isArray(raw) ? raw.filter((u): u is string => typeof u === 'string' && u.length > 0) : [];
}

export function productLinks(html: string, pageUrl: string, pattern: RegExp): string[] {
  const hrefs = matchAll(html, /<a[^>]+href=["']([^"']+)["']/i);
  const links: string[] = [];
  const seen = new Set<string>();
  for (const href of hrefs) {
    const url = absoluteUrl(pageUrl, href).split('#')[0];
    if (!pattern.test(url) || seen.has(url)) continue;
    if (new URL(url).host !== new URL(pageUrl).host) continue;
    seen.add(url);
    links.push(url);
  }
  return links;
}

export const htmlKala: Adapter = {
  paths(store) {
    const urls = categoryUrls(store.config);
    return urls.map((u) => {
      try {
        return new URL(u, store.base_url).pathname;
      } catch {
        return '/';
      }
    });
  },
  async fetchPage(context: AdapterContext, bookmark: Bookmark | null): Promise<AdapterPage> {
    const config = context.store.config;
    const categories = categoryUrls(config);
    if (categories.length === 0) throw new JobError('no_category_urls');
    const pattern = new RegExp(typeof config.product_pattern === 'string' ? config.product_pattern : '/product/', 'i');
    const position = positionOf(bookmark);
    if (position.category >= categories.length) return { items: [], next: null, requests: 0 };

    const categoryUrl = new URL(categories[position.category], context.store.base_url).toString();
    let requests = 0;
    let links = position.links;
    if (!links) {
      const listing = await context.fetcher.get(categoryUrl, { accept: 'text/html' });
      requests += 1;
      if (!listing.ok) throw new JobError(`http_${listing.status}`);
      links = productLinks(listing.text, categoryUrl, pattern);
    }
    const categoryName = decodeURIComponent(new URL(categoryUrl).pathname.split('/').filter(Boolean).pop() ?? '');
    const batch = links.slice(position.index, position.index + BATCH);
    const read = await readProductPages(context, batch, () => (categoryName ? [categoryName] : []));
    requests += read.requests;

    let next: Bookmark | null = null;
    if (position.index + BATCH < links.length) next = { category: position.category, links, index: position.index + BATCH };
    else if (position.category + 1 < categories.length) next = { category: position.category + 1, links: null, index: 0 };
    return { items: read.items, next, requests };
  },
};
