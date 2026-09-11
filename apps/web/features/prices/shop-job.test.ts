import { describe, expect, it, vi } from 'vitest';
import { htmlCashcow } from '@shop/adapters/html-cashcow.ts';
import { htmlKala, productLinks } from '@shop/adapters/html-kala.ts';
import { htmlMagento1 } from '@shop/adapters/html-magento1.ts';
import { shopify } from '@shop/adapters/shopify.ts';
import { woocommerce } from '@shop/adapters/woocommerce.ts';
import { createDb } from '@shop/db.ts';
import { JobError } from '@shop/errors.ts';
import { createFetcher, parseRetryAfter } from '@shop/fetcher.ts';
import { isAllowed, loadRobots, parseRobots, robotsFrom, rulesFor } from '@shop/robots.ts';
import { runOnce, toOffers } from '@shop/run.ts';
import { BACKOFF_MS, CLAIM_STALE_MS, DAILY_MS, pickStore } from '@shop/schedule.ts';
import type { Adapter, AdapterContext, Db, FetchResult, Fetcher, Logger, RawItem, Robots, StoreRow } from '@shop/types.ts';

// The price job's plumbing: politeness, robots.txt, the schedule, one tick
// end to end, and the adapters against hand-written feeds and pages. No
// request leaves this file: every fetch is a fake keyed by URL.

const quiet: Logger = { info: () => {}, warn: () => {} };

interface Route {
  status?: number;
  body?: string;
  headers?: Record<string, string>;
}

function fakeFetcher(routes: Record<string, Route | ((url: string) => Route)>): Fetcher & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    get requests() {
      return calls.length;
    },
    async get(url): Promise<FetchResult> {
      calls.push(url);
      const key = Object.keys(routes).find((k) => url === k || url.startsWith(k));
      const route = key === undefined ? { status: 404, body: '' } : typeof routes[key] === 'function' ? (routes[key] as (u: string) => Route)(url) : routes[key];
      const status = route.status ?? 200;
      const headers = Object.fromEntries(Object.entries(route.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]));
      return {
        status,
        ok: status >= 200 && status < 300,
        notModified: status === 304,
        text: route.body ?? '',
        etag: headers.etag ?? null,
        lastModified: headers['last-modified'] ?? null,
        headers,
        url,
      };
    },
  };
}

function store(overrides: Partial<StoreRow> = {}): StoreRow {
  return {
    id: 'store-1',
    slug: 'medicinebom',
    name: 'Shop',
    base_url: 'https://shop.test',
    platform: 'woocommerce',
    status: 'active',
    config: {},
    crawl_delay_ms: 2000,
    bookmark: null,
    refresh_requested_at: null,
    last_started_at: null,
    last_completed_at: null,
    last_success_at: null,
    last_error_at: null,
    consecutive_failures: 0,
    ...overrides,
  };
}

const allowAll: Robots = { allows: () => true, crawlDelayMs: null };

function context(fetcher: Fetcher, s: StoreRow = store(), robots: Robots = allowAll): AdapterContext {
  return { store: s, fetcher, robots, log: quiet };
}

// ---------------------------------------------------------------------------

describe('robots.txt', () => {
  const text = `User-agent: *
Disallow: /wp-admin/
Allow: /wp-admin/admin-ajax.php
Disallow: /*?add-to-cart=

# START YOAST BLOCK
User-agent: *
Disallow:

User-agent: HerbalistPriceCheck
Disallow: /private/
Crawl-delay: 5
`;

  it('merges every group for an agent and lets the longest rule win', () => {
    const groups = parseRobots(text);
    expect(groups).toHaveLength(3);
    const star = rulesFor(groups, 'somebot');
    expect(isAllowed(star.rules, '/wp-admin/admin-ajax.php')).toBe(true);
    expect(isAllowed(star.rules, '/wp-admin/options.php')).toBe(false);
    expect(isAllowed(star.rules, '/product/x?add-to-cart=1')).toBe(false);
    expect(isAllowed(star.rules, '/wp-json/wc/store/v1/products')).toBe(true);
    expect(star.crawlDelay).toBeNull();
  });

  it('prefers the group that names our agent', () => {
    const robots = robotsFrom(text, 'HerbalistPriceCheck');
    expect(robots.allows('/private/x')).toBe(false);
    expect(robots.allows('/wp-admin/options.php')).toBe(true);
    expect(robots.crawlDelayMs).toBe(5000);
  });

  it('treats a missing file as permission and a broken server as a reason to wait', async () => {
    const missing = fakeFetcher({ 'https://shop.test/robots.txt': { status: 404 } });
    expect((await loadRobots(missing, 'https://shop.test', 'x')).allows('/anything')).toBe(true);
    const down = fakeFetcher({ 'https://shop.test/robots.txt': { status: 503 } });
    await expect(loadRobots(down, 'https://shop.test', 'x')).rejects.toMatchObject({ code: 'robots_unavailable' });
    expect(robotsFrom('', 'x').allows('/')).toBe(true);
  });
});

// ---------------------------------------------------------------------------

describe('fetcher', () => {
  function harness(responses: (() => Response | Promise<Response>)[]) {
    let clock = 0;
    const sleeps: number[] = [];
    const fetchImpl = vi.fn(async () => {
      const next = responses.shift();
      if (!next) throw new Error('no response scripted');
      return next();
    });
    const fetcher = createFetcher({
      userAgent: 'HerbalistPriceCheck/1.0 (test)',
      minDelayMs: 2000,
      fetchImpl,
      sleep: async (ms) => {
        sleeps.push(ms);
        clock += ms;
      },
      now: () => clock,
      maxRetries: 2,
    });
    return { fetcher, fetchImpl, sleeps, tick: (ms: number) => (clock += ms) };
  }

  it('waits between two requests to the same host but not between hosts', async () => {
    const h = harness([() => new Response('a'), () => new Response('b'), () => new Response('c')]);
    await h.fetcher.get('https://one.test/a');
    h.tick(500);
    await h.fetcher.get('https://one.test/b');
    expect(h.sleeps).toEqual([1500]);
    await h.fetcher.get('https://two.test/c');
    expect(h.sleeps).toEqual([1500]);
    expect(h.fetcher.requests).toBe(3);
    const headers = (h.fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].headers as Record<string, string>;
    expect(headers['user-agent']).toContain('HerbalistPriceCheck');
  });

  it('honours a longer per-host delay and sends conditional headers', async () => {
    const h = harness([() => new Response('a'), () => new Response(null, { status: 304 })]);
    h.fetcher.setMinDelay('one.test', 10_000);
    h.fetcher.setMinDelay('one.test', 3_000);
    await h.fetcher.get('https://one.test/a');
    const result = await h.fetcher.get('https://one.test/a', { etag: '"e1"', lastModified: 'Mon, 01 Jan 2026 00:00:00 GMT' });
    expect(h.sleeps).toEqual([10_000]);
    expect(result.notModified).toBe(true);
    const headers = (h.fetchImpl.mock.calls[1] as unknown as [string, RequestInit])[1].headers as Record<string, string>;
    expect(headers['if-none-match']).toBe('"e1"');
    expect(headers['if-modified-since']).toContain('2026');
  });

  it('backs off on 429 with Retry-After and gives a short code after the last retry', async () => {
    const h = harness([
      () => new Response('slow down', { status: 429, headers: { 'retry-after': '1' } }),
      () => new Response('[]', { status: 200, headers: { etag: '"z"' } }),
    ]);
    const result = await h.fetcher.get('https://one.test/a');
    expect(result.ok).toBe(true);
    expect(result.etag).toBe('"z"');
    expect(h.sleeps).toContain(1000);

    const failing = harness([
      () => {
        throw new Error('boom');
      },
      () => {
        throw new Error('boom');
      },
      () => {
        throw new Error('boom');
      },
    ]);
    await expect(failing.fetcher.get('https://one.test/a')).rejects.toMatchObject({ code: 'network' });
    expect(failing.fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('reads Retry-After as seconds or as a date', () => {
    expect(parseRetryAfter('7', 0)).toBe(7000);
    expect(parseRetryAfter('Thu, 01 Jan 1970 00:00:05 GMT', 2000)).toBe(3000);
    expect(parseRetryAfter('nonsense', 0)).toBeNull();
    expect(parseRetryAfter(null, 0)).toBeNull();
  });
});

// ---------------------------------------------------------------------------

describe('pickStore', () => {
  const now = Date.parse('2026-09-11T10:00:00Z');
  const ago = (ms: number) => new Date(now - ms).toISOString();

  it('takes a requested store first, then an unfinished pass, then the longest unread', () => {
    const requested = store({ slug: 'requested', refresh_requested_at: ago(60_000), last_success_at: ago(1000) });
    const unfinished = store({ slug: 'unfinished', bookmark: { page: 3 }, last_completed_at: ago(600_000) });
    const stale = store({ slug: 'stale', last_success_at: ago(DAILY_MS + 1) });
    const fresh = store({ slug: 'fresh', last_success_at: ago(60_000) });
    const never = store({ slug: 'never' });
    expect(pickStore([fresh, stale, unfinished, requested], now)?.slug).toBe('requested');
    expect(pickStore([fresh, stale, unfinished], now)?.slug).toBe('unfinished');
    expect(pickStore([fresh, stale, never], now)?.slug).toBe('never');
    expect(pickStore([fresh, stale], now)?.slug).toBe('stale');
    expect(pickStore([fresh], now)).toBeNull();
  });

  it('skips a store another tick holds, one in backoff, and anything not active', () => {
    const held = store({ slug: 'held', last_started_at: ago(CLAIM_STALE_MS - 1000), last_completed_at: null });
    const abandoned = store({ slug: 'abandoned', last_started_at: ago(CLAIM_STALE_MS + 1000), last_completed_at: null });
    const failing = store({ slug: 'failing', consecutive_failures: 3, last_error_at: ago(BACKOFF_MS - 1000) });
    const recovered = store({ slug: 'recovered', consecutive_failures: 3, last_error_at: ago(BACKOFF_MS + 1000) });
    const paused = store({ slug: 'paused', status: 'paused' });
    const waiting = store({ slug: 'waiting', status: 'awaiting_permission' });
    expect(pickStore([held, paused, waiting, failing], now)).toBeNull();
    expect(pickStore([abandoned], now)?.slug).toBe('abandoned');
    expect(pickStore([recovered], now)?.slug).toBe('recovered');
  });
});

// ---------------------------------------------------------------------------

function fakeDb(rows: StoreRow[], claimable = true) {
  const calls: { name: string; args: unknown[] }[] = [];
  const db: Db = {
    async listStores() {
      calls.push({ name: 'listStores', args: [] });
      return rows;
    },
    async claimStore(storeId, runId) {
      calls.push({ name: 'claimStore', args: [storeId, runId] });
      const row = rows.find((r) => r.id === storeId);
      if (!row || !claimable || row.status !== 'active') return null;
      return { ...row, bookmark: row.bookmark ?? { run_id: runId, started_at: '2026-09-11T10:00:00Z' } };
    },
    async saveBookmark(storeId, bookmark) {
      calls.push({ name: 'saveBookmark', args: [storeId, bookmark] });
    },
    async upsertOffers(storeId, runId, offers) {
      calls.push({ name: 'upsertOffers', args: [storeId, runId, offers] });
      return { new_products: offers.length, new_offers: offers.length, updated: 0, price_changes: 0 };
    },
    async finishRun(input) {
      calls.push({ name: 'finishRun', args: [input] });
      return 0;
    },
  };
  return { db, calls };
}

function pagedAdapter(pages: RawItem[][]): Adapter {
  return {
    paths: () => ['/feed'],
    async fetchPage(_context, position) {
      const index = position && typeof position.page === 'number' ? position.page : 0;
      return { items: pages[index] ?? [], next: index + 1 < pages.length ? { page: index + 1 } : null, requests: 1 };
    },
  };
}

function item(overrides: Partial<RawItem>): RawItem {
  return {
    externalId: '1',
    name: "מחטי Seirin 0.20x30 100 יח'",
    url: 'https://shop.test/p/1',
    price: 86,
    currency: 'ILS',
    sku: null,
    gtin: null,
    available: true,
    categories: [],
    ...overrides,
  };
}

describe('toOffers', () => {
  it('keeps what the classifier places, drops the rest and duplicates, and rounds the price', () => {
    const offers = toOffers(
      [
        item({ externalId: '1', price: 86.129 }),
        item({ externalId: '1', name: 'duplicate id' }),
        item({ externalId: '2', name: 'שמן לבנדר 10 מ"ל', price: 30 }),
        item({ externalId: '3', name: 'מוקסה גסה 250 גרם', price: 0 }),
        item({ externalId: '4', name: 'אלכוהול 70% 1 ליטר', price: 31, gtin: '4006381333931' }),
      ],
      'medicinebom',
    );
    expect(offers.map((o) => o.external_id)).toEqual(['1', '4']);
    expect(offers[0]).toMatchObject({ price: 86.13, fingerprint: 'seirin|needles:|dims:0.2x30mm|100', product: { category: 'needles', brand: 'seirin' } });
    expect(offers[1]).toMatchObject({ gtin: '04006381333931', product: { category: 'consumables', canonical_name: 'אלכוהול · 1 ליטר, 70%' } });
  });

  it("reads needle sizes the shop's way", () => {
    const [offer] = toOffers([item({ name: 'מחט סיליקון 30*16 100' })], 'tevadirect', { dims_order: 'length_first' });
    expect(offer.product).toMatchObject({ size_a: 0.16, size_b: 30 });
  });
});

describe('runOnce', () => {
  const robotsFetcher = () => fakeFetcher({ 'https://shop.test/robots.txt': { body: 'User-agent: *\nDisallow: /private/\n' } });
  const base = (overrides: Partial<Parameters<typeof runOnce>[0]> = {}) => ({
    fetcher: robotsFetcher(),
    adapters: { woocommerce: pagedAdapter([[item({ externalId: '1' })], [item({ externalId: '2', name: 'מוקסה גסה 250 גרם' })]]) },
    log: quiet,
    trigger: 'cron' as const,
    runId: 'run-1',
    agentToken: 'HerbalistPriceCheck',
    ...overrides,
  });

  it('reads every page, writes each as it goes, and finishes complete', async () => {
    const { db, calls } = fakeDb([store()]);
    const outcome = await runOnce({ ...base(), db });
    expect(outcome).toMatchObject({ picked: 'medicinebom', claimed: true, ok: true, partial: false, error: null });
    expect(outcome.stats).toMatchObject({ pages: 3, fetched: 2, in_scope: 2, new_offers: 2 });
    expect(calls.map((c) => c.name)).toEqual(['listStores', 'claimStore', 'upsertOffers', 'saveBookmark', 'upsertOffers', 'finishRun']);
    const bookmark = calls[3].args[1] as Record<string, unknown>;
    expect(bookmark).toEqual({ run_id: 'run-1', started_at: '2026-09-11T10:00:00Z', position: { page: 1 } });
    expect(calls[5].args[0]).toMatchObject({ ok: true, partial: false, trigger: 'cron', error: null });
  });

  it('stops at the budget and resumes from the bookmark next time', async () => {
    let clock = 0;
    const { db, calls } = fakeDb([store()]);
    const first = await runOnce({ ...base(), db, budgetMs: 0, now: () => (clock += 1000) });
    expect(first).toMatchObject({ ok: true, partial: true });
    expect(calls.filter((c) => c.name === 'upsertOffers')).toHaveLength(1);
    expect(calls.at(-1)?.args[0]).toMatchObject({ partial: true });

    const resumed = fakeDb([store({ bookmark: { run_id: 'run-0', started_at: '2026-09-11T09:00:00Z', position: { page: 1 } } })]);
    const second = await runOnce({ ...base(), db: resumed.db, runId: 'run-2' });
    expect(second).toMatchObject({ ok: true, partial: false });
    expect(resumed.calls.filter((c) => c.name === 'upsertOffers')).toHaveLength(1);
    expect((resumed.calls.find((c) => c.name === 'upsertOffers')?.args[2] as { external_id: string }[])[0].external_id).toBe('2');
  });

  it('does nothing when nothing is due or the store is taken', async () => {
    const idle = fakeDb([store({ last_success_at: new Date().toISOString() })]);
    expect(await runOnce({ ...base(), db: idle.db })).toMatchObject({ picked: null, claimed: false, ok: true });
    expect(idle.calls.map((c) => c.name)).toEqual(['listStores']);

    const taken = fakeDb([store()], false);
    expect(await runOnce({ ...base(), db: taken.db })).toMatchObject({ picked: 'medicinebom', claimed: false });
    expect(taken.calls.map((c) => c.name)).toEqual(['listStores', 'claimStore']);
  });

  it('ends a pass with a short code when robots.txt refuses, the adapter is missing, or a page fails', async () => {
    const refused = fakeDb([store()]);
    const outcome = await runOnce({
      ...base(),
      db: refused.db,
      fetcher: fakeFetcher({ 'https://shop.test/robots.txt': { body: 'User-agent: *\nDisallow: /feed\n' } }),
    });
    expect(outcome).toMatchObject({ ok: false, error: 'robots_disallow' });
    expect(refused.calls.at(-1)?.args[0]).toMatchObject({ ok: false, error: 'robots_disallow' });

    const unsupported = fakeDb([store({ platform: 'unsupported' })]);
    expect(await runOnce({ ...base(), db: unsupported.db })).toMatchObject({ ok: false, error: 'no_adapter' });

    const broken: Adapter = {
      paths: () => ['/feed'],
      fetchPage: async () => {
        throw new JobError('http_503');
      },
    };
    const failing = fakeDb([store()]);
    expect(await runOnce({ ...base(), db: failing.db, adapters: { woocommerce: broken } })).toMatchObject({ ok: false, error: 'http_503' });
  });

  it('reads the store named by a manual run even when it is not due', async () => {
    const { db } = fakeDb([store({ last_success_at: new Date().toISOString() })]);
    expect(await runOnce({ ...base(), db, trigger: 'manual', storeSlug: 'medicinebom' })).toMatchObject({ picked: 'medicinebom', claimed: true, ok: true });
  });
});

// ---------------------------------------------------------------------------

describe('woocommerce adapter', () => {
  const product = (id: number, name: string, extra: Record<string, unknown> = {}) => ({
    id,
    name,
    permalink: `https://shop.test/product/${id}`,
    sku: `S${id}`,
    is_purchasable: true,
    is_in_stock: true,
    prices: { price: '86', currency_code: 'ILS', currency_minor_unit: 0 },
    categories: [{ name: 'מחטים' }],
    ...extra,
  });

  it('reads a page of the Store API and knows when there is another', async () => {
    const fetcher = fakeFetcher({
      'https://shop.test/wp-json/wc/store/v1/products?per_page=100&page=1': {
        body: JSON.stringify([
          product(1, 'מחטי Seirin &#8211; מקוריות'),
          product(2, 'לא למכירה', { is_purchasable: false }),
          product(3, 'אזל', { is_in_stock: false, prices: { price: '2500', currency_code: 'ILS', currency_minor_unit: 2 } }),
          product(4, 'בלי מחיר', { prices: { price: '', currency_minor_unit: 0 } }),
        ]),
        headers: { 'X-WP-TotalPages': '2' },
      },
      'https://shop.test/wp-json/wc/store/v1/products?per_page=100&page=2': { body: '[]', headers: { 'X-WP-TotalPages': '2' } },
    });
    const first = await woocommerce.fetchPage(context(fetcher), null);
    expect(first.items.map((i) => [i.externalId, i.name, i.price, i.available])).toEqual([
      ['1', 'מחטי Seirin – מקוריות', 86, true],
      ['3', 'אזל', 25, false],
    ]);
    expect(first.items[0]).toMatchObject({ sku: 'S1', categories: ['מחטים'], url: 'https://shop.test/product/1' });
    expect(first.next).toEqual({ page: 2 });
    const second = await woocommerce.fetchPage(context(fetcher), first.next);
    expect(second.next).toBeNull();
    expect(woocommerce.paths(store())).toEqual(['/wp-json/wc/store/v1/products']);
  });

  it('fails the pass on a bad status or a body that is not JSON', async () => {
    const fetcher = fakeFetcher({
      'https://shop.test/wp-json/wc/store/v1/products?per_page=100&page=1': { status: 500 },
      'https://shop.test/wp-json/wc/store/v1/products?per_page=100&page=2': { body: '<html>' },
    });
    await expect(woocommerce.fetchPage(context(fetcher), null)).rejects.toMatchObject({ code: 'http_500' });
    await expect(woocommerce.fetchPage(context(fetcher), { page: 2 })).rejects.toMatchObject({ code: 'bad_json' });
  });
});

describe('shopify adapter', () => {
  const feed = JSON.stringify({
    products: [
      {
        id: 10,
        title: 'בקבוק זכוכית',
        handle: 'bottle',
        product_type: '',
        tags: ['בקבוק'],
        variants: [
          { id: 101, title: '10 מ"ל', sku: '', barcode: '4006381333931', price: '4.00', available: true },
          { id: 102, title: '100 מ"ל', sku: 'B100', barcode: null, price: '5.00', available: false },
        ],
      },
      { id: 11, title: 'אלכוהול 70% 1 ליטר', handle: 'alcohol', tags: 'קליניקה, רפואה סינית', variants: [{ id: 111, title: 'Default Title', price: '32.00', available: true }] },
    ],
  });

  it('reads the named collections, one listing per variant', async () => {
    const s = store({ platform: 'shopify', config: { collections: ['ציוד-למטפלים', 'second'] } });
    const fetcher = fakeFetcher({
      'https://shop.test/collections/%D7%A6%D7%99%D7%95%D7%93-%D7%9C%D7%9E%D7%98%D7%A4%D7%9C%D7%99%D7%9D/products.json?limit=250&page=1': { body: feed },
      'https://shop.test/collections/second/products.json?limit=250&page=1': { body: '{"products":[]}' },
    });
    const first = await shopify.fetchPage(context(fetcher, s), null);
    expect(first.items.map((i) => [i.externalId, i.name, i.price, i.gtin, i.available])).toEqual([
      ['10:101', 'בקבוק זכוכית 10 מ"ל', 4, '4006381333931', true],
      ['10:102', 'בקבוק זכוכית 100 מ"ל', 5, null, false],
      ['11:111', 'אלכוהול 70% 1 ליטר', 32, null, true],
    ]);
    expect(first.items[0].url).toBe('https://shop.test/products/bottle?variant=101');
    expect(first.items[2]).toMatchObject({ url: 'https://shop.test/products/alcohol', categories: ['קליניקה', 'רפואה סינית'] });
    expect(first.next).toEqual({ collection: 1, page: 1 });
    const second = await shopify.fetchPage(context(fetcher, s), first.next);
    expect(second.next).toBeNull();
    expect(shopify.paths(s)).toEqual(['/collections/%D7%A6%D7%99%D7%95%D7%93-%D7%9C%D7%9E%D7%98%D7%A4%D7%9C%D7%99%D7%9D/products.json', '/collections/second/products.json']);
    expect(shopify.paths(store({ platform: 'shopify' }))).toEqual(['/products.json']);
  });
});

const productPage = (name: string, price: number) =>
  `<html><head><script type="application/ld+json">${JSON.stringify({ '@type': 'Product', name, offers: { price: String(price), priceCurrency: 'ILS' } })}</script></head><body></body></html>`;

describe('page-reading adapters', () => {
  it('cashcow: walks the paged sitemap in batches and remembers where it stopped', async () => {
    const s = store({ platform: 'html_cashcow', config: { sitemap: '/crowlers/sitemap', sitemapPages: 2 } });
    const locs = Array.from({ length: 10 }, (_, i) => `<url><loc>https://shop.test/p/item-${i}</loc></url>`).join('');
    const routes: Record<string, Route> = {
      'https://shop.test/crowlers/sitemap?page=1': { body: `<urlset>${locs}<url><loc>https://shop.test/about</loc></url></urlset>` },
      'https://shop.test/crowlers/sitemap?page=2': { body: '<urlset></urlset>' },
    };
    for (let i = 0; i < 10; i++) routes[`https://shop.test/p/item-${i}`] = { body: productPage(`מוקסה ${i} 10 יח`, 20 + i) };
    const fetcher = fakeFetcher(routes);
    const first = await htmlCashcow.fetchPage(context(fetcher, s), null);
    expect(first.items).toHaveLength(8);
    expect(first.items[0]).toMatchObject({ name: 'מוקסה 0 10 יח', price: 20, url: 'https://shop.test/p/item-0', externalId: '/p/item-0' });
    expect(first.requests).toBe(9);
    expect(first.next).toEqual({ sitemapPage: 1, index: 8 });
    const second = await htmlCashcow.fetchPage(context(fetcher, s), first.next);
    expect(second.items).toHaveLength(2);
    expect(second.next).toEqual({ sitemapPage: 2, index: 0 });
    const third = await htmlCashcow.fetchPage(context(fetcher, s), second.next);
    expect(third.items).toHaveLength(0);
    expect(third.next).toBeNull();
  });

  it('magento: reads product pages out of one sitemap and skips a robots-blocked page', async () => {
    const s = store({ platform: 'html_magento1' });
    const fetcher = fakeFetcher({
      'https://shop.test/sitemap.xml': { body: '<urlset><url><loc>https://shop.test/a.html</loc></url><url><loc>https://shop.test/blocked.html</loc></url><url><loc>https://shop.test/category/</loc></url></urlset>' },
      'https://shop.test/a.html': { body: productPage('כוסות רוח סט', 99) },
      'https://shop.test/blocked.html': { body: productPage('never read', 1) },
    });
    const robots = robotsFrom('User-agent: *\nDisallow: /blocked', 'x');
    const page = await htmlMagento1.fetchPage(context(fetcher, s, robots), null);
    expect(page.items.map((i) => i.name)).toEqual(['כוסות רוח סט']);
    expect(fetcher.calls).not.toContain('https://shop.test/blocked.html');
    expect(page.next).toBeNull();
  });

  it('kala: needs category pages in its config, collects product links, reads a batch', async () => {
    const empty = store({ platform: 'html_kala', config: { category_urls: [] } });
    await expect(htmlKala.fetchPage(context(fakeFetcher({}), empty), null)).rejects.toMatchObject({ code: 'no_category_urls' });

    const s = store({ platform: 'html_kala', config: { category_urls: ['/category/needles'], product_pattern: '/product/' } });
    const listing = `<a href="/product/one">1</a> <a href="https://shop.test/product/two#x">2</a> <a href="/product/one">dup</a> <a href="https://other.test/product/three">x</a> <a href="/cart">cart</a>`;
    const fetcher = fakeFetcher({
      'https://shop.test/category/needles': { body: listing },
      'https://shop.test/product/one': { body: productPage('מחטים א', 10) },
      'https://shop.test/product/two': { status: 404 },
    });
    expect(productLinks(listing, 'https://shop.test/category/needles', /\/product\//)).toEqual(['https://shop.test/product/one', 'https://shop.test/product/two']);
    const page = await htmlKala.fetchPage(context(fetcher, s), null);
    expect(page.items.map((i) => [i.name, i.categories])).toEqual([['מחטים א', ['needles']]]);
    expect(page.next).toBeNull();
    expect(htmlKala.paths(s)).toEqual(['/category/needles']);
  });
});

// ---------------------------------------------------------------------------

describe('createDb', () => {
  it('maps the job onto the migration functions and turns an error into a short code', async () => {
    const rpc = vi.fn(async (fn: string) => (fn === 'shop_claim_store' ? { data: store(), error: null } : { data: { new_products: 1 }, error: null }));
    const select = vi.fn(async (_columns: string) => ({ data: [store()], error: null }));
    const db = createDb({ rpc, from: () => ({ select }) });
    expect(await db.listStores()).toHaveLength(1);
    expect(select.mock.calls[0][0]).toContain('bookmark');
    expect((await db.claimStore('store-1', 'run-1'))?.slug).toBe('medicinebom');
    expect(rpc).toHaveBeenCalledWith('shop_claim_store', { p_store: 'store-1', p_run: 'run-1' });
    expect(await db.upsertOffers('store-1', 'run-1', [])).toEqual({ new_products: 1, new_offers: 0, updated: 0, price_changes: 0 });
    await db.finishRun({ storeId: 'store-1', runId: 'run-1', trigger: 'cron', ok: true, partial: false, error: null, stats: { pages: 1, fetched: 1, in_scope: 1, new_products: 0, new_offers: 0, price_changes: 0 } });
    expect(rpc).toHaveBeenLastCalledWith('shop_finish_run', expect.objectContaining({ p_ok: true, p_partial: false, p_trigger: 'cron' }));

    const failing = createDb({ rpc: async () => ({ data: null, error: { message: 'boom' } }), from: () => ({ select }) });
    await expect(failing.claimStore('s', 'r')).rejects.toMatchObject({ code: 'db_claim' });
  });
});
