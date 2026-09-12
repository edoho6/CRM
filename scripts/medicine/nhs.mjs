// Step 4 — the NHS website (Open Government Licence v3, through the NHS
// website content API). Conditions with their symptoms, causes, treatment and
// "when to get help"; medicines with what they are for, how to take them,
// side effects, who cannot take them, and what they interact with — each
// with the page's own review date, which the licence asks us to keep fresh
// and to show, with the NHS logo and a link, wherever the text appears.
//
//   node scripts/medicine/nhs.mjs
//
// Needs NHS_API_KEY in apps/web/.env.local (free registration on the NHS
// England developer hub, accepting the syndication terms). Without it the
// step is skipped and the corpus is compiled from the other sources.
// Output: .cache/medicine/nhs/<kind>-<slug>.json
import fs from 'node:fs';
import path from 'node:path';
import { cacheDir, env, fetchPolite, htmlToText, log, readJson, slugOf, sleep, writeJson } from './lib.mjs';

const API = 'https://api.service.nhs.uk/nhs-website-content';
const dir = path.join(cacheDir, 'nhs');

/** A page's parts, flattened to {headline, text}; the API answers in schema.org JSON. */
function parts(page) {
  const out = [];
  const walk = (node, headline) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (const child of node) walk(child, headline);
      return;
    }
    const own = node.headline ?? node.name ?? headline ?? null;
    if (typeof node.text === 'string' && node.text.trim()) out.push({ headline: own, text: htmlToText(node.text) });
    for (const key of ['hasPart', 'mainEntityOfPage', 'itemListElement']) if (node[key]) walk(node[key], own);
  };
  walk(page.hasPart ?? page.mainEntityOfPage ?? [], null);
  return out;
}

async function fetchPage(kind, slug, key) {
  const file = path.join(dir, `${kind}-${slug}.json`);
  const cached = readJson(file);
  if (cached) return cached;
  const response = await fetchPolite(`${API}/${kind}/${slug}`, { headers: { apikey: key }, minDelayMs: 1200 });
  if (response.status === 404) {
    writeJson(file, { found: false, kind, slug, retrieved_at: new Date().toISOString() });
    return null;
  }
  if (!response.ok) throw new Error(`NHS ${response.status} for ${kind}/${slug}`);
  const page = await response.json();
  const record = {
    found: true,
    kind,
    slug,
    url: page.url ?? `https://www.nhs.uk/${kind}/${slug}/`,
    name: page.name ?? null,
    description: page.description ?? null,
    last_reviewed: Array.isArray(page.lastReviewed) ? page.lastReviewed[0] ?? null : page.lastReviewed ?? null,
    date_modified: page.dateModified ?? null,
    parts: parts(page),
    retrieved_at: new Date().toISOString(),
  };
  writeJson(file, record);
  return record;
}

async function main() {
  const key = env('NHS_API_KEY');
  if (!key) {
    log('nhs: NHS_API_KEY is not set — skipped (the corpus is compiled from the other sources)');
    return;
  }
  const corpus = readJson(path.join(cacheDir, 'wikidata', 'corpus.json'));
  if (!corpus) throw new Error('run wikidata.mjs first');
  fs.mkdirSync(dir, { recursive: true });
  let found = 0;
  const jobs = [
    ...corpus.selected.condition.map((qid) => ({ qid, kind: 'conditions' })),
    ...corpus.selected.symptom.map((qid) => ({ qid, kind: 'conditions' })),
    ...corpus.selected.drug.map((qid) => ({ qid, kind: 'medicines' })),
  ];
  for (const { qid, kind } of jobs) {
    const record = corpus.entities[qid];
    // Wikidata's NHS id is the page's slug; otherwise the English name, slugged.
    const slugs = [...new Set([...(record.claims.nhs ?? []), slugOf(record.labels.en ?? ''), ...record.aliases.en.slice(0, 3).map(slugOf)])].filter(Boolean);
    let page = null;
    for (const slug of slugs) {
      page = await fetchPage(kind, slug, key);
      if (page?.found) break;
    }
    if (page?.found) {
      found += 1;
      writeJson(path.join(dir, `by-qid-${qid}.json`), { qid, kind, slug: page.slug });
    }
    await sleep(300);
  }
  log(`nhs: pages for ${found}/${jobs.length} entries → .cache/medicine/nhs/`);
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exitCode = 1;
});
