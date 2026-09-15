#!/usr/bin/env node
// The American Dragon pages, saved as served, so the facts can be read from
// their tables rather than from the search passages the library keeps.
//
//   node scripts/catalogue/fetch-americandragon.mjs [--family=herbs,formulas,points] [--limit=N] [--refresh] [--delay=1100]
//
// Which pages: the index pages of the site (herbs by pinyin and by Latin,
// the four formula index pages, the points index) plus every address the
// library crawl walked on 14.9 (.cache/library/crawl-manifest.json), so a
// page the indexes do not link is still read. Formula pages whose name ends
// in a number ("CervicalCancer28") are the numbered protocol variants under
// the conditions and are left out — the practitioner's decision of 15.9.
//
// Politeness: one request at a time, a pause between them, our own user
// agent with a contact address, and a page already on disk is not asked for
// again unless --refresh. A run that stopped resumes where it was.
//
// Output: .cache/catalogue/americandragon/<family>/<slug>.html and index.json
// (slug → url, status, bytes, title, fetchedAt); a log line per page.
import fs from 'node:fs';
import path from 'node:path';
import {
  DRAGON_FAMILIES,
  DRAGON_ORIGIN,
  UA,
  args,
  crawlManifest,
  dragonDir,
  ensureDir,
  log,
  readJson,
  sleep,
  writeJson,
} from './lib.mjs';

const options = args();
const families = String(options.family ?? 'herbs,formulas,points')
  .split(',')
  .map((s) => s.trim())
  .filter((s) => s in DRAGON_FAMILIES);
const limit = Number(options.limit ?? 0) || Infinity;
const refresh = Boolean(options.refresh);
const delay = Math.max(300, Number(options.delay ?? 1100));

const INDEX_PAGES = {
  herbs: ['IndividualHerbsIndex2.html', 'LatinIndividualHerbIndex2.html'],
  formulas: [
    'HerbFormulaIndexA-G.html',
    'HerbFormulaIndexH-N.html',
    'HerbFormulaIndexO-T.html',
    'HerbFormulaIndexU-Z.html',
  ],
  points: ['PointsIndex2.html'],
};

async function fetchPage(url) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml' },
        redirect: 'follow',
        signal: AbortSignal.timeout(25_000),
      });
      if ([429, 502, 503, 504].includes(response.status) && attempt < 3) {
        const wait = Number(response.headers.get('retry-after')) || 15;
        await sleep(wait * 1000);
        continue;
      }
      return { status: response.status, html: response.ok ? await response.text() : '' };
    } catch (error) {
      if (attempt >= 3) return { status: 0, html: '', error: error.message };
      await sleep(3000 * (attempt + 1));
    }
  }
}

/** "Individualherbsupdate/HuangQi.html" → { family, slug, url }, or null when it is not a catalogue page. */
function classify(href) {
  let url;
  try {
    url = new URL(href, DRAGON_ORIGIN + '/');
  } catch {
    return null;
  }
  if (url.origin !== DRAGON_ORIGIN) return null;
  const pathname = decodeURIComponent(url.pathname);
  for (const [family, folder] of Object.entries(DRAGON_FAMILIES)) {
    const prefix = `/${folder}/`;
    if (!pathname.startsWith(prefix)) continue;
    const slug = pathname.slice(prefix.length).replace(/\.html?$/i, '');
    if (!slug || slug.includes('/')) return null;
    if (family === 'formulas' && /\d$/.test(slug)) return null;
    return {
      family,
      slug,
      url: `${DRAGON_ORIGIN}${prefix.replace(/ /g, '%20')}${encodeURIComponent(slug)}.html`,
    };
  }
  return null;
}

function linksIn(html) {
  return [...html.matchAll(/href\s*=\s*["']([^"'#]+)["']/gi)].map((m) => m[1]);
}

async function collectTargets() {
  const targets = new Map();
  const add = (href) => {
    const hit = classify(href);
    if (hit && families.includes(hit.family))
      targets.set(`${hit.family}/${hit.slug.toLowerCase()}`, hit);
  };
  // 1. The library crawl's list of addresses.
  const manifest = readJson(crawlManifest);
  for (const url of Object.keys(manifest?.pages ?? {})) add(url);
  // 2. The site's own index pages, in case the crawl missed a corner.
  for (const family of families) {
    for (const page of INDEX_PAGES[family]) {
      const file = path.join(dragonDir, '_index', page);
      let html = fs.existsSync(file) && !refresh ? fs.readFileSync(file, 'utf8') : '';
      if (!html) {
        const result = await fetchPage(`${DRAGON_ORIGIN}/${page}`);
        html = result.html;
        if (html) {
          ensureDir(path.dirname(file));
          fs.writeFileSync(file, html);
        }
        log(`index ${page}: ${result.status} ${html.length} chars`);
        await sleep(delay);
      }
      for (const href of linksIn(html)) add(href);
    }
  }
  return [...targets.values()].sort(
    (a, b) => a.family.localeCompare(b.family) || a.slug.localeCompare(b.slug),
  );
}

async function main() {
  ensureDir(dragonDir);
  const targets = await collectTargets();
  const byFamily = {};
  for (const t of targets) byFamily[t.family] = (byFamily[t.family] ?? 0) + 1;
  log(`americandragon: ${targets.length} page(s) to hold — ${JSON.stringify(byFamily)}`);

  const indexFile = path.join(dragonDir, 'index.json');
  const index = readJson(indexFile, {});
  let fetched = 0;
  let kept = 0;
  let failed = 0;
  let done = 0;
  for (const target of targets) {
    const file = path.join(dragonDir, target.family, `${target.slug}.html`);
    const key = `${target.family}/${target.slug}`;
    if (
      !refresh &&
      fs.existsSync(file) &&
      fs.statSync(file).size > 0 &&
      index[key]?.status === 200
    ) {
      kept += 1;
      continue;
    }
    if (fetched >= limit) break;
    const result = await fetchPage(target.url);
    fetched += 1;
    if (result.status === 200 && result.html) {
      ensureDir(path.dirname(file));
      fs.writeFileSync(file, result.html);
      const title = (result.html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '')
        .replace(/\s+/g, ' ')
        .trim();
      index[key] = {
        url: target.url,
        status: 200,
        bytes: result.html.length,
        title,
        fetchedAt: new Date().toISOString(),
      };
    } else {
      failed += 1;
      index[key] = {
        url: target.url,
        status: result.status,
        error: result.error ?? null,
        fetchedAt: new Date().toISOString(),
      };
      log(`  ${key}: ${result.status || result.error}`);
    }
    done += 1;
    if (done % 25 === 0) {
      writeJson(indexFile, index);
      log(`  ${done} fetched (${failed} failed), ${targets.length - kept - done} to go`);
    }
    await sleep(delay);
  }
  writeJson(indexFile, index);
  log(
    `americandragon: ${fetched} fetched now, ${kept} already on disk, ${failed} failed → ${dragonDir}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
