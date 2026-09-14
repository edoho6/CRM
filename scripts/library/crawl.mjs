// The listed websites, read politely and loaded like the files.
//
//   node scripts/library/crawl.mjs [--sites=scripts/library/sites.json] [--dry] [--limit=N]
//
// Each entry in sites.json names a start page, how deep to go (a path
// prefix pages must share with it), how many pages at most, and a note on
// the terms the practitioner checked. robots.txt is read first and obeyed,
// one request a second per site (or the crawl delay it asks for), our own
// user agent with a contact address, and pages are asked for conditionally
// so a re-run costs a site nothing for what has not changed. Each page
// becomes a source of kind 'website' with its URL; the passages are cut,
// embedded and loaded exactly as a file's are.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { args, cacheDir as medicineCache, env, log, readJson, sleep, writeJson } from '../medicine/lib.mjs';
import { chunkPages } from './lib/chunk.mjs';
import { pageLinks, pageText } from './lib/html.mjs';
import { isAllowed, parseRobots, rulesFor } from './lib/robots.mjs';
import { connectAsAdmin, uploadSource } from './lib/upload.mjs';
import { embedTexts } from './lib/voyage.mjs';

const AGENT_TOKEN = 'herbalist-library';
const UA = `${AGENT_TOKEN}/1.0 (professional library of a clinic app; contact edoho6@gmail.com)`;
const cacheDir = path.join(path.dirname(medicineCache), 'library');
const manifestPath = path.join(cacheDir, 'crawl-manifest.json');
const options = args();
const sitesFile = path.resolve(String(options.sites ?? path.join('scripts', 'library', 'sites.json')));
const dry = Boolean(options.dry);
const limit = Number(options.limit ?? 0) || Infinity;
/** Pages smaller than this are menus and stubs, not reading matter. */
const MIN_CHARS = 400;
const SKIP_EXT = /\.(png|jpe?g|gif|svg|webp|pdf|zip|mp[34]|css|js|ico|woff2?)$/i;

async function fetchPage(url, known) {
  const headers = { 'user-agent': UA, accept: 'text/html,application/xhtml+xml' };
  if (known?.etag) headers['if-none-match'] = known.etag;
  if (known?.lastModified) headers['if-modified-since'] = known.lastModified;
  const response = await fetch(url, { headers, redirect: 'follow', signal: AbortSignal.timeout(20_000) });
  if (response.status === 304) return { unchanged: true };
  if (!response.ok) return { error: `http ${response.status}` };
  const type = response.headers.get('content-type') ?? '';
  if (!/text\/html|application\/xhtml/.test(type)) return { error: `not html: ${type}` };
  const html = await response.text();
  return { html, etag: response.headers.get('etag'), lastModified: response.headers.get('last-modified'), finalUrl: response.url || url };
}

async function crawlSite(site, state) {
  const start = new URL(site.url);
  const prefix = site.include ?? start.pathname.replace(/[^/]*$/, '');
  const maxPages = Number(site.maxPages ?? 100);
  let robots = { groups: [] };
  try {
    const response = await fetch(`${start.origin}/robots.txt`, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(15_000) });
    if (response.ok) robots = parseRobots(await response.text());
    else if (response.status >= 500) throw new Error(`robots.txt ${response.status}`);
  } catch (error) {
    log(`crawl: ${start.host} — ${error.message}; skipping the site`);
    return;
  }
  const group = rulesFor(robots, AGENT_TOKEN);
  const delayMs = (group.crawlDelay ?? 1) * 1000;
  // A database site keeps its records behind query strings (`keepQuery`), and
  // `match` — a regular expression the whole address must satisfy — keeps the
  // crawl to one language or one kind of page (`lang=eng`, `detail\\.php`).
  const keepQuery = Boolean(site.keepQuery);
  const matcher = site.match ? new RegExp(site.match) : null;
  const wanted = (url) => {
    const { pathname } = new URL(url);
    return pathname.startsWith(prefix) && !SKIP_EXT.test(pathname) && (!matcher || matcher.test(url));
  };
  const queue = [start.href];
  const seen = new Set(queue);
  let read = 0;
  while (queue.length && read < maxPages && state.pages < limit) {
    const url = queue.shift();
    const pathname = new URL(url).pathname;
    if (!wanted(url)) continue;
    if (!isAllowed(group, pathname)) {
      state.summary.disallowed += 1;
      continue;
    }
    const known = state.manifest.pages[url];
    let page;
    try {
      page = await fetchPage(url, known);
    } catch (error) {
      state.summary.failed += 1;
      log(`crawl: ${url} — ${error.message}`);
      await sleep(delayMs);
      continue;
    }
    await sleep(delayMs);
    read += 1;
    state.pages += 1;
    if (page.unchanged) {
      state.summary.unchanged += 1;
      for (const link of known?.links ?? []) if (!seen.has(link)) { seen.add(link); queue.push(link); }
      continue;
    }
    if (page.error) {
      state.summary.failed += 1;
      log(`crawl: ${url} — ${page.error}`);
      continue;
    }
    const links = pageLinks(page.html, page.finalUrl, { keepQuery }).filter(wanted);
    for (const link of links) if (!seen.has(link)) { seen.add(link); queue.push(link); }
    const { title, text } = pageText(page.html, url);
    if (text.length < MIN_CHARS) {
      state.summary.thin += 1;
      state.manifest.pages[url] = { ...known, etag: page.etag, lastModified: page.lastModified, links, thin: true };
      continue;
    }
    const sha256 = crypto.createHash('sha256').update(text).digest('hex');
    if (known?.sha256 === sha256 && known.id) {
      state.summary.unchanged += 1;
      state.manifest.pages[url] = { ...known, etag: page.etag, lastModified: page.lastModified, links };
      continue;
    }
    const chunks = chunkPages([{ page: null, text }]);
    if (chunks.length === 0) {
      state.summary.thin += 1;
      continue;
    }
    const { embeddings, tokens } = await embedTexts(state.voyageKey, chunks.map((c) => (c.heading ? `${c.heading}\n${c.content}` : c.content)), {
      cacheDir: path.join(cacheDir, 'embeddings'),
    });
    state.summary.tokens += tokens;
    const source = {
      kind: 'website',
      locator: `url:${url}`,
      title: `${title} — ${start.host}`,
      url,
      sha256,
      bytes: text.length,
      pages: null,
      language: null,
      licence_note: site.note ?? null,
      fetched_at: new Date().toISOString(),
      etag: page.etag,
      last_modified: page.lastModified,
    };
    if (dry) {
      log(`crawl: ${url} — ${chunks.length} passage(s) (dry)`);
      continue;
    }
    const { id, added } = await uploadSource(await state.admin(), source, chunks.map((c, i) => ({ ...c, embedding: embeddings[i] })));
    state.manifest.pages[url] = { id, sha256, title: source.title, etag: page.etag, lastModified: page.lastModified, links, chunks: added, loadedAt: source.fetched_at };
    writeJson(manifestPath, state.manifest);
    state.summary.loaded += 1;
    state.summary.chunks += added;
    log(`crawl: ${url} — ${added} passage(s) loaded`);
  }
  log(`crawl: ${start.host} — ${read} page(s) read`);
}

async function main() {
  const voyageKey = env('VOYAGE_API_KEY');
  if (!voyageKey) throw new Error('VOYAGE_API_KEY is not set (apps/web/.env.local)');
  const sites = readJson(sitesFile);
  if (!Array.isArray(sites) || sites.length === 0) throw new Error(`no sites in ${sitesFile} — add {"url": "https://…", "maxPages": 100, "note": "…"} entries`);
  fs.mkdirSync(cacheDir, { recursive: true });
  const state = {
    voyageKey,
    manifest: readJson(manifestPath, { pages: {} }),
    pages: 0,
    summary: { loaded: 0, unchanged: 0, thin: 0, disallowed: 0, failed: 0, chunks: 0, tokens: 0 },
    supabase: null,
    admin: async () => (state.supabase ??= await connectAsAdmin()),
  };
  for (const site of sites) {
    if (!site?.url) continue;
    await crawlSite(site, state);
  }
  writeJson(manifestPath, state.manifest);
  if (state.supabase) await state.supabase.auth.signOut({ scope: 'local' });
  log(`crawl: done — ${JSON.stringify(state.summary)}`);
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exitCode = 1;
});
