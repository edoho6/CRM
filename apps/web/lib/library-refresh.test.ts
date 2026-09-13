import { describe, expect, it } from 'vitest';
import type { Fetcher, FetchResult, Logger } from '../../../supabase/functions/_shared/shop-prices/types';
import { refreshWebsites, sha256Hex, type ChunkPayload, type RefreshDb, type SourcePayload, type WebsiteSource } from '../../../supabase/functions/_shared/library/refresh';
import { VOYAGE_BATCH, batchTexts, embedAll } from '../../../supabase/functions/_shared/library/voyage';

/**
 * The scheduled refresh, with fakes for the site, the database and the
 * embeddings. What matters: an unchanged page is only touched, a changed
 * page is rewritten whole, a stub does not empty a source, robots.txt is
 * obeyed, and the clock stops the run between pages.
 */

const ARTICLE = `<html><head><title>Ginger for nausea</title></head><body><nav>menu</nav><main><h1>Ginger</h1>${'<p>Ginger has been studied for nausea in pregnancy and after surgery. The usual amount in trials was about one gram a day, taken in divided doses.</p>'.repeat(6)}</main></body></html>`;
const silent: Logger = { info: () => {}, warn: () => {} };

function answer(overrides: Partial<FetchResult>): FetchResult {
  return { status: 200, ok: true, notModified: false, text: '', etag: null, lastModified: null, headers: { 'content-type': 'text/html' }, url: '', ...overrides };
}

function site(pages: Record<string, FetchResult>, robots = 'User-agent: *\nDisallow: /private/\n'): Fetcher & { asked: string[] } {
  const asked: string[] = [];
  return {
    asked,
    requests: 0,
    async get(url, options) {
      asked.push(url + (options?.etag ? ` if-none-match ${options.etag}` : ''));
      if (url.endsWith('/robots.txt')) return answer({ text: robots, url });
      const page = pages[url];
      if (!page) return answer({ status: 404, ok: false, url });
      return { ...page, url };
    },
  };
}

function fakeDb(sources: WebsiteSource[]) {
  const calls: string[] = [];
  const upserts: SourcePayload[] = [];
  const chunks: ChunkPayload[] = [];
  const db: RefreshDb = {
    staleWebsites: async () => sources,
    upsertSource: async (source) => {
      calls.push(`upsert ${source.locator}`);
      upserts.push(source);
      return 'id-' + source.locator;
    },
    clearChunks: async (id) => {
      calls.push(`clear ${id}`);
    },
    addChunks: async (id, added) => {
      calls.push(`add ${id} ${added.length}`);
      chunks.push(...added);
      return added.length;
    },
    touchSource: async (id, etag) => {
      calls.push(`touch ${id} ${etag ?? '-'}`);
    },
  };
  return { db, calls, upserts, chunks };
}

const source = (url: string, extra: Partial<WebsiteSource> = {}): WebsiteSource => ({
  id: 'src-' + url,
  locator: 'url:' + url,
  url,
  title: 'old title',
  sha256: null,
  etag: null,
  last_modified: null,
  licence_note: 'checked',
  fetched_at: '2026-09-01T00:00:00Z',
  ...extra,
});

const embed = async (texts: string[]) => ({ vectors: texts.map(() => [0.1, 0.2]), tokens: texts.length * 10 });
const run = (db: RefreshDb, fetcher: Fetcher, extra: Partial<Parameters<typeof refreshWebsites>[0]> = {}) =>
  refreshWebsites({ db, fetcher, embed, sha256: sha256Hex, log: silent, agentToken: 'herbalist-library', budgetMs: 10_000, ...extra });

describe('refreshWebsites', () => {
  it('rewrites a page whose text changed, passages and all, with the validators kept', async () => {
    const url = 'https://example.org/herbs/ginger';
    const { db, calls, upserts, chunks } = fakeDb([source(url)]);
    const fetcher = site({ [url]: answer({ text: ARTICLE, etag: '"v2"', lastModified: 'Mon, 01 Sep 2026 00:00:00 GMT' }) });
    const outcome = await run(db, fetcher);
    expect(outcome).toMatchObject({ checked: 1, updated: 1, unchanged: 0, failed: 0, stoppedForTime: false });
    expect(calls).toEqual(['upsert url:' + url, 'clear id-url:' + url, `add id-url:${url} ${chunks.length}`]);
    expect(upserts[0]).toMatchObject({ kind: 'website', url, etag: '"v2"', last_modified: 'Mon, 01 Sep 2026 00:00:00 GMT', licence_note: 'checked', title: 'Ginger for nausea — example.org' });
    expect(upserts[0]!.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0]!.embedding).toEqual([0.1, 0.2]);
    expect(outcome.tokens).toBe(chunks.length * 10);
  });

  it('asks conditionally and only touches a page the site says is unchanged', async () => {
    const url = 'https://example.org/herbs/ginger';
    const { db, calls } = fakeDb([source(url, { etag: '"v1"', sha256: 'abc' })]);
    const fetcher = site({ [url]: answer({ status: 304, ok: false, notModified: true }) });
    const outcome = await run(db, fetcher);
    expect(outcome).toMatchObject({ unchanged: 1, updated: 0, failed: 0 });
    expect(fetcher.asked).toContain(`${url} if-none-match "v1"`);
    expect(calls).toEqual([`touch src-${url} "v1"`]);
  });

  it('touches, with the new validators, a page whose text is the same as before', async () => {
    const url = 'https://example.org/herbs/ginger';
    const text = ARTICLE;
    const { db: probe, upserts } = fakeDb([source(url)]);
    await run(probe, site({ [url]: answer({ text }) }));
    const known = upserts[0]!.sha256;
    const { db, calls } = fakeDb([source(url, { sha256: known })]);
    const outcome = await run(db, site({ [url]: answer({ text, etag: '"v3"' }) }));
    expect(outcome).toMatchObject({ unchanged: 1, updated: 0 });
    expect(calls).toEqual([`touch src-${url} "v3"`]);
  });

  it('keeps the old passages when a page shrinks to a stub, and obeys robots.txt', async () => {
    const stub = 'https://example.org/herbs/stub';
    const closed = 'https://example.org/private/notes';
    const { db, calls } = fakeDb([source(stub), source(closed)]);
    const outcome = await run(db, site({ [stub]: answer({ text: '<html><body><main>Down for maintenance.</main></body></html>' }), [closed]: answer({ text: ARTICLE }) }));
    expect(outcome).toMatchObject({ thin: 1, disallowed: 1, updated: 0 });
    expect(calls).toEqual([`touch src-${stub} -`]);
  });

  it('counts a page the site did not answer as failed, and stops between pages when the budget is spent', async () => {
    const gone = 'https://example.org/herbs/gone';
    const late = 'https://example.org/herbs/late';
    const { db, calls } = fakeDb([source(gone), source(late)]);
    let tick = 0;
    const outcome = await run(db, site({ [late]: answer({ text: ARTICLE }) }), { budgetMs: 5, now: () => (tick += 4) });
    expect(outcome).toMatchObject({ failed: 1, stoppedForTime: true, checked: 1 });
    expect(calls).toEqual([]);
  });

  it('hashes with SHA-256 as hex, the digest the crawl script writes', async () => {
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});

describe('embedAll', () => {
  it('sends the texts in batches, keeps their order, and waits when the service asks', async () => {
    const calls: string[][] = [];
    const waits: number[] = [];
    let first = true;
    const fetchImpl = async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as { input: string[] };
      if (first) {
        first = false;
        return new Response('slow down', { status: 429, headers: { 'retry-after': '2' } });
      }
      calls.push(body.input);
      // Each vector is [the text's own number]; the list comes back in
      // reverse on purpose, because the caller must sort by index.
      const data = body.input.map((text, index) => ({ index, embedding: [Number(text.slice(1))] })).reverse();
      return Response.json({ data, usage: { total_tokens: body.input.length } });
    };
    const texts = Array.from({ length: VOYAGE_BATCH + 6 }, (_, i) => `t${i}`);
    const result = await embedAll('key', texts, { fetchImpl, sleep: async (ms) => { waits.push(ms); } });
    expect(calls.map((batch) => batch.length)).toEqual([VOYAGE_BATCH, 6]);
    expect(waits).toEqual([2000]);
    expect(result.tokens).toBe(texts.length);
    expect(result.vectors.map((v) => v[0])).toEqual(texts.map((_, i) => i));
  });

  it('keeps a batch under the token ceiling, and halves one the service still finds too large', async () => {
    // Forty texts of 10,000 characters: 4,000 tokens each by the estimate, so twenty to a batch.
    const long = Array.from({ length: 40 }, (_, i) => `t${i}` + '.'.repeat(9_996));
    expect(batchTexts(long).map((b) => b.length)).toEqual([20, 20]);
    expect(batchTexts(['a', 'b', 'c'], 2).map((b) => b.length)).toEqual([2, 1]);

    const calls: number[] = [];
    const fetchImpl = async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as { input: string[] };
      calls.push(body.input.length);
      // Anything above three texts is "too large" — the caller must halve until it fits.
      if (body.input.length > 3) return new Response(JSON.stringify({ detail: 'The max allowed tokens per submitted batch is 120000.' }), { status: 400 });
      return Response.json({ data: body.input.map((text, index) => ({ index, embedding: [Number(text.slice(1))] })), usage: { total_tokens: body.input.length } });
    };
    const texts = Array.from({ length: 10 }, (_, i) => `t${i}`);
    const result = await embedAll('key', texts, { fetchImpl, sleep: async () => {} });
    expect(result.vectors.map((v) => v[0])).toEqual(texts.map((_, i) => i));
    expect(result.tokens).toBe(10);
    // 10 → refused; 5 + 5 → refused; 3 + 2 + 3 + 2 → accepted.
    expect(calls).toEqual([10, 5, 3, 2, 5, 3, 2]);
  });
});
