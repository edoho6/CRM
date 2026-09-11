// One tick of the job, from "which store" to "what happened".
//
// claim → robots.txt → pages, until the catalogue ends or the time budget
// does → finish. Every page is written as soon as it is read, so a tick that
// stops at page 4 has lost nothing: the bookmark says "page 5", the next
// tick carries on, and only the pass that reaches the end marks what it did
// not see as unavailable. A failure anywhere ends the pass with a short code
// and no rethrow — the schedule decides when to try again, not this file.

import { classify } from './classify.ts';
import { errorCode, JobError } from './errors.ts';
import { normaliseGtin } from './gtin.ts';
import { identify } from './match.ts';
import { loadRobots } from './robots.ts';
import { pickStore } from './schedule.ts';
import type {
  Adapter,
  Bookmark,
  Db,
  Fetcher,
  Logger,
  OfferPayload,
  RawItem,
  RunOutcome,
  RunStats,
  RunTrigger,
  StorePlatform,
} from './types.ts';

export interface RunOptions {
  db: Db;
  fetcher: Fetcher & { setMinDelay?(host: string, ms: number): void };
  adapters: Partial<Record<StorePlatform, Adapter>>;
  log: Logger;
  trigger: RunTrigger;
  runId: string;
  /** The token the shops see in User-Agent, matched against robots.txt groups. */
  agentToken: string;
  /** Read this store rather than the scheduled one (a manual run). */
  storeSlug?: string;
  /** Stop starting new pages after this long; default 55 s, under the function's own limit. */
  budgetMs?: number;
  now?: () => number;
}

export function emptyStats(): RunStats {
  return { pages: 0, fetched: 0, in_scope: 0, new_products: 0, new_offers: 0, price_changes: 0 };
}

/** The items worth keeping, as the upsert function wants them. */
export function toOffers(
  items: RawItem[],
  storeSlug: string,
  storeConfig: Record<string, unknown> = {},
): OfferPayload[] {
  const offers: OfferPayload[] = [];
  const seen = new Set<string>();
  const dimsOrder = storeConfig.dims_order === 'length_first' ? 'length_first' : 'gauge_first';
  for (const item of items) {
    if (!item.name || !item.url || !Number.isFinite(item.price) || item.price <= 0) continue;
    if (seen.has(item.externalId)) continue;
    const category = classify({ name: item.name, categories: item.categories }, storeSlug);
    if (!category) continue;
    seen.add(item.externalId);
    const identity = identify(item.name, { category, dimsOrder });
    offers.push({
      external_id: item.externalId,
      raw_name: item.name.slice(0, 300),
      url: item.url,
      sku: item.sku || null,
      gtin: normaliseGtin(item.gtin),
      fingerprint: identity.fingerprint,
      price: Math.round(item.price * 100) / 100,
      currency: item.currency || 'ILS',
      available: item.available,
      product: {
        brand: identity.brand,
        display_item: identity.displayItem,
        item_key: identity.itemKey,
        size_kind: identity.sizeKind,
        size_a: identity.sizeA,
        size_b: identity.sizeB,
        size_unit: identity.sizeUnit,
        pack_count: identity.packCount,
        canonical_name: identity.canonicalName,
        category,
      },
    });
  }
  return offers;
}

export async function runOnce(options: RunOptions): Promise<RunOutcome> {
  const now = options.now ?? (() => Date.now());
  const budgetMs = options.budgetMs ?? 55_000;
  const stats = emptyStats();
  const stores = await options.db.listStores();
  const store = options.storeSlug
    ? (stores.find((s) => s.slug === options.storeSlug) ?? null)
    : pickStore(stores, now());
  if (!store) {
    options.log.info('nothing due');
    return { picked: null, claimed: false, ok: true, partial: false, error: null, stats };
  }

  const claimed = await options.db.claimStore(store.id, options.runId);
  if (!claimed) {
    options.log.info('store busy or not active', { store: store.slug });
    return { picked: store.slug, claimed: false, ok: true, partial: false, error: null, stats };
  }

  const passStart = claimed.bookmark ?? {};
  const base: Bookmark = { run_id: passStart.run_id ?? options.runId, started_at: passStart.started_at ?? new Date(now()).toISOString() };
  let position = (passStart.position as Bookmark | null | undefined) ?? null;
  let partial = false;

  try {
    const adapter = options.adapters[claimed.platform];
    if (!adapter) throw new JobError('no_adapter');

    const robots = await loadRobots(options.fetcher, claimed.base_url, options.agentToken);
    stats.pages += 1;
    for (const path of adapter.paths(claimed)) {
      if (!robots.allows(path)) throw new JobError('robots_disallow');
    }
    const host = new URL(claimed.base_url).host;
    options.fetcher.setMinDelay?.(host, Math.max(claimed.crawl_delay_ms, robots.crawlDelayMs ?? 0));

    const context = { store: claimed, fetcher: options.fetcher, robots, log: options.log };
    const started = now();
    let next: Bookmark | null = position;
    do {
      const page = await adapter.fetchPage(context, next);
      stats.pages += page.requests;
      stats.fetched += page.items.length;
      const offers = toOffers(page.items, claimed.slug, claimed.config);
      stats.in_scope += offers.length;
      if (offers.length > 0) {
        const result = await options.db.upsertOffers(claimed.id, options.runId, offers);
        stats.new_products += result.new_products;
        stats.new_offers += result.new_offers;
        stats.price_changes += result.price_changes;
      }
      next = page.next;
      position = next;
      if (next) await options.db.saveBookmark(claimed.id, { ...base, position: next });
      if (next && now() - started > budgetMs) break;
    } while (next);

    partial = position !== null;
    await options.db.finishRun({
      storeId: claimed.id,
      runId: options.runId,
      trigger: options.trigger,
      ok: true,
      partial,
      error: null,
      stats,
    });
    options.log.info(partial ? 'pass paused' : 'pass complete', { store: claimed.slug, ...stats });
    return { picked: claimed.slug, claimed: true, ok: true, partial, error: null, stats };
  } catch (error) {
    const code = errorCode(error);
    options.log.warn('pass failed', { store: claimed.slug, code, ...stats });
    try {
      await options.db.finishRun({
        storeId: claimed.id,
        runId: options.runId,
        trigger: options.trigger,
        ok: false,
        partial: false,
        error: code,
        stats,
      });
    } catch (finishError) {
      options.log.warn('finish failed', { store: claimed.slug, code: errorCode(finishError) });
    }
    return { picked: claimed.slug, claimed: true, ok: false, partial: false, error: code, stats };
  }
}
