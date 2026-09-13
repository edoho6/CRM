// The library's websites, read again on a schedule.
//
// A page that was loaded into the library is asked for once more when it
// has gone a week without a look: conditionally, so a page that has not
// changed costs its site a 304 and nothing else; and when the site does
// answer with the page, its text is hashed the way the crawl hashed it, so
// only a page whose reading matter actually changed is cut, embedded and
// written again. New pages are the crawl's job (scripts/library/crawl.mjs,
// run by hand with the site list); this keeps what is there true.
//
// Everything that touches the network or the database comes in through
// the options, so the web app's tests can run this with fakes.

import type { Fetcher, Logger, Robots } from '../shop-prices/types.ts';
import type { PoliteFetcher } from '../shop-prices/fetcher.ts';
import { loadRobots } from '../shop-prices/robots.ts';
import { chunkPages } from './chunk.ts';
import { pageText } from './html.ts';

/** Pages smaller than this are menus and stubs, not reading matter. */
export const MIN_PAGE_CHARS = 400;

export interface WebsiteSource {
  id: string;
  locator: string;
  url: string;
  title: string;
  sha256: string | null;
  etag: string | null;
  last_modified: string | null;
  licence_note: string | null;
  fetched_at: string | null;
}

export interface SourcePayload {
  kind: 'website';
  locator: string;
  title: string;
  url: string;
  sha256: string;
  bytes: number;
  pages: null;
  language: null;
  licence_note: string | null;
  fetched_at: string;
  etag: string | null;
  last_modified: string | null;
}

export interface ChunkPayload {
  ordinal: number;
  page: number | null;
  heading: string | null;
  content: string;
  tokens: number;
  embedding: number[];
}

export interface RefreshDb {
  /** Active website sources not fetched for `olderThanDays`, oldest first, at most `limit`. */
  staleWebsites(limit: number, olderThanDays: number): Promise<WebsiteSource[]>;
  /** The source row rewritten (title, hash, size, validators, time); returns its id. */
  upsertSource(source: SourcePayload): Promise<string>;
  clearChunks(sourceId: string): Promise<void>;
  addChunks(sourceId: string, chunks: ChunkPayload[]): Promise<number>;
  /** Only the time and the validators, when the page has not changed. */
  touchSource(sourceId: string, etag: string | null, lastModified: string | null): Promise<void>;
}

export interface RefreshOptions {
  db: RefreshDb;
  fetcher: Fetcher | PoliteFetcher;
  embed: (texts: string[]) => Promise<{ vectors: number[][]; tokens: number }>;
  sha256: (text: string) => Promise<string>;
  log: Logger;
  agentToken: string;
  /** Wall-clock budget: the run stops between pages once it is spent. */
  budgetMs: number;
  /** Sources per run. */
  limit?: number;
  /** A page is looked at again after this many days. */
  olderThanDays?: number;
  now?: () => number;
}

export interface RefreshOutcome {
  checked: number;
  unchanged: number;
  updated: number;
  thin: number;
  disallowed: number;
  failed: number;
  tokens: number;
  stoppedForTime: boolean;
}

export async function refreshWebsites(options: RefreshOptions): Promise<RefreshOutcome> {
  const { db, fetcher, log } = options;
  const now = options.now ?? (() => Date.now());
  const started = now();
  const outcome: RefreshOutcome = { checked: 0, unchanged: 0, updated: 0, thin: 0, disallowed: 0, failed: 0, tokens: 0, stoppedForTime: false };
  const sources = await db.staleWebsites(options.limit ?? 40, options.olderThanDays ?? 7);
  // robots.txt once per site, for the whole run; a site whose robots.txt
  // cannot be read is left alone this run rather than read without leave.
  const robotsByOrigin = new Map<string, Robots | null>();

  for (const source of sources) {
    if (now() - started > options.budgetMs) {
      outcome.stoppedForTime = true;
      break;
    }
    let url: URL;
    try {
      url = new URL(source.url);
    } catch {
      outcome.failed += 1;
      continue;
    }
    outcome.checked += 1;

    let robots = robotsByOrigin.get(url.origin);
    if (robots === undefined) {
      try {
        robots = await loadRobots(fetcher, url.origin, options.agentToken);
        if (robots.crawlDelayMs && 'setMinDelay' in fetcher) fetcher.setMinDelay(url.host, robots.crawlDelayMs);
      } catch (error) {
        robots = null;
        log.warn('library refresh: robots.txt unavailable', { host: url.host, error: String(error) });
      }
      robotsByOrigin.set(url.origin, robots);
    }
    if (robots === null) {
      outcome.failed += 1;
      continue;
    }
    if (!robots.allows(url.pathname)) {
      outcome.disallowed += 1;
      continue;
    }

    try {
      const result = await fetcher.get(url.href, {
        accept: 'text/html,application/xhtml+xml',
        etag: source.etag,
        lastModified: source.last_modified,
      });
      if (result.notModified) {
        outcome.unchanged += 1;
        await db.touchSource(source.id, source.etag, source.last_modified);
        continue;
      }
      if (!result.ok) {
        outcome.failed += 1;
        log.warn('library refresh: page not answered', { url: url.href, status: result.status });
        continue;
      }
      const type = result.headers['content-type'] ?? '';
      if (type && !/text\/html|application\/xhtml/.test(type)) {
        outcome.failed += 1;
        log.warn('library refresh: not a page', { url: url.href, type });
        continue;
      }
      const { title, text } = pageText(result.text, url.href);
      if (text.length < MIN_PAGE_CHARS) {
        // A page that shrank to a stub keeps its old passages: a site's
        // outage page must not empty a source that read well last week.
        outcome.thin += 1;
        await db.touchSource(source.id, result.etag, result.lastModified);
        continue;
      }
      const sha256 = await options.sha256(text);
      if (sha256 === source.sha256) {
        outcome.unchanged += 1;
        await db.touchSource(source.id, result.etag, result.lastModified);
        continue;
      }
      const chunks = chunkPages([{ page: null, text }]);
      const { vectors, tokens } = await options.embed(chunks.map((c) => (c.heading ? `${c.heading}\n${c.content}` : c.content)));
      outcome.tokens += tokens;
      const id = await db.upsertSource({
        kind: 'website',
        locator: source.locator,
        title: `${title} — ${url.host}`,
        url: url.href,
        sha256,
        bytes: text.length,
        pages: null,
        language: null,
        licence_note: source.licence_note,
        fetched_at: new Date(now()).toISOString(),
        etag: result.etag,
        last_modified: result.lastModified,
      });
      await db.clearChunks(id);
      await db.addChunks(
        id,
        chunks.map((chunk, index) => ({ ...chunk, embedding: vectors[index]! })),
      );
      outcome.updated += 1;
      log.info('library refresh: page rewritten', { url: url.href, passages: chunks.length });
    } catch (error) {
      outcome.failed += 1;
      log.warn('library refresh: page failed', { url: url.href, error: String(error) });
    }
  }
  return outcome;
}

/** SHA-256 of a text as lower-case hex, with the platform's own crypto — the same digest the crawl writes. */
export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
