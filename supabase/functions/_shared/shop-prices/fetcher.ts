// The one place the job talks to a shop.
//
// Politeness is not a setting on the adapters, it is built into the only
// function that can make a request: a pause between requests to the same
// host (the store's crawl_delay_ms, or the robots.txt Crawl-delay, whichever
// is longer), a User-Agent that names the service and a contact address, a
// timeout on every request, conditional requests when the shop gave an ETag
// or a Last-Modified, and a short back-off on 429 and 503 instead of a retry
// storm. One request fails → the pass fails; nothing loops.

import { JobError } from './errors.ts';
import type { FetchOptions, FetchResult, Fetcher } from './types.ts';

export interface FetcherOptions {
  userAgent: string;
  /** Pause between two requests to the same host. Raised per host by setMinDelay(). */
  minDelayMs: number;
  timeoutMs?: number;
  maxRetries?: number;
  fetchImpl?: (url: string, init: RequestInit) => Promise<Response>;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

export interface PoliteFetcher extends Fetcher {
  /** Lengthen the pause for one host, never shorten it: a shop's Crawl-delay is a floor. */
  setMinDelay(host: string, ms: number): void;
}

export function createFetcher(options: FetcherOptions): PoliteFetcher {
  const timeoutMs = options.timeoutMs ?? 20_000;
  const maxRetries = options.maxRetries ?? 2;
  const fetchImpl = options.fetchImpl ?? ((url, init) => fetch(url, init));
  const sleep = options.sleep ?? ((ms) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const now = options.now ?? (() => Date.now());
  const lastFinished = new Map<string, number>();
  const delays = new Map<string, number>();
  let requests = 0;

  function delayFor(host: string): number {
    return Math.max(options.minDelayMs, delays.get(host) ?? 0);
  }

  async function waitTurn(host: string): Promise<void> {
    const previous = lastFinished.get(host);
    if (previous === undefined) return;
    const wait = previous + delayFor(host) - now();
    if (wait > 0) await sleep(wait);
  }

  async function get(url: string, fetchOptions: FetchOptions = {}): Promise<FetchResult> {
    const host = new URL(url).host;
    const headers: Record<string, string> = {
      'user-agent': options.userAgent,
      accept: fetchOptions.accept ?? 'application/json, text/html;q=0.9, */*;q=0.5',
      'accept-language': 'he-IL, he;q=0.9, en;q=0.5',
    };
    if (fetchOptions.etag) headers['if-none-match'] = fetchOptions.etag;
    if (fetchOptions.lastModified) headers['if-modified-since'] = fetchOptions.lastModified;

    for (let attempt = 0; ; attempt++) {
      await waitTurn(host);
      requests += 1;
      let response: Response;
      try {
        response = await fetchImpl(url, {
          headers,
          redirect: 'follow',
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (error) {
        lastFinished.set(host, now());
        const timedOut = error instanceof Error && error.name === 'TimeoutError';
        if (attempt < maxRetries) {
          await sleep(2_000 * (attempt + 1));
          continue;
        }
        throw new JobError(timedOut ? 'timeout' : 'network');
      }
      lastFinished.set(host, now());

      if ((response.status === 429 || response.status === 503) && attempt < maxRetries) {
        const retryAfter = parseRetryAfter(response.headers.get('retry-after'), now());
        await response.text().catch(() => '');
        await sleep(Math.min(retryAfter ?? 5_000 * (attempt + 1), 30_000));
        continue;
      }

      const collected: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        collected[key.toLowerCase()] = value;
      });
      const notModified = response.status === 304;
      const text = notModified ? '' : await response.text();
      return {
        status: response.status,
        ok: response.ok,
        notModified,
        text,
        etag: collected['etag'] ?? null,
        lastModified: collected['last-modified'] ?? null,
        headers: collected,
        url: response.url || url,
      };
    }
  }

  return {
    get,
    get requests() {
      return requests;
    },
    setMinDelay(host, ms) {
      delays.set(host, Math.max(delays.get(host) ?? 0, ms));
    },
  };
}

/** Retry-After as milliseconds: a number of seconds, or an HTTP date. */
export function parseRetryAfter(header: string | null, nowMs: number): number | null {
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  const at = Date.parse(header);
  if (Number.isFinite(at)) return Math.max(0, at - nowMs);
  return null;
}
