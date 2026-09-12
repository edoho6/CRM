// Step 5b — the lab tests themselves: MedlinePlus Medical Tests (US
// National Library of Medicine, public domain) for what a test is, why it
// is done, how to prepare and what the results mean, joined to the LOINC
// codes through MedlinePlus Connect — the service that answers "which page
// explains this code".
//
//   node scripts/medicine/labtests.mjs
//
// No key, no registration. Connect asks to be called gently and not to be
// presented as an endorsement; both are kept.
//
// Reference ranges are deliberately not collected: they belong to the
// laboratory that ran the test and vary by method, age and sex. The entry
// says to read the range printed on the report.
// Output: .cache/medicine/labtests/tests.json
import fs from 'node:fs';
import path from 'node:path';
import { cacheDir, ensureDir, fetchPolite, htmlToText, log, readJson, sleep, writeJson } from './lib.mjs';

const SITE = 'https://medlineplus.gov';
const CONNECT = 'https://connect.medlineplus.gov/service';
const LOINC_SYSTEM = '2.16.840.1.113883.6.1';
const dir = path.join(cacheDir, 'labtests');

/** The page's headings, mapped to the entry's sections. */
const HEADINGS = [
  ['overview', /^what (is|are)\b/i],
  ['what_for', /what is it used for|why do i need/i],
  ['procedure', /what happens during|how is the test/i],
  ['preparation', /prepare for the test|anything to prepare/i],
  ['risks', /any risks/i],
  ['results', /what do the results mean/i],
  ['more', /anything else i need to know/i],
];
const STOP = /^(references|related (health topics|medical tests|issues)|learn more)/i;

/** Every lab test page the index lists. */
async function listSlugs() {
  const cached = readJson(path.join(dir, 'slugs.json'));
  if (cached?.slugs?.length) return cached.slugs;
  const response = await fetchPolite(`${SITE}/lab-tests/`);
  if (!response.ok) throw new Error(`MedlinePlus lab tests index: ${response.status}`);
  const html = await response.text();
  const slugs = [...new Set([...html.matchAll(/href="(?:https:\/\/medlineplus\.gov)?\/lab-tests\/([a-z0-9-]+)\/?"/g)].map((m) => m[1]))];
  writeJson(path.join(dir, 'slugs.json'), { retrieved_at: new Date().toISOString(), slugs });
  return slugs;
}

/** One page to a title and the sections under its headings. */
function parsePage(slug, html) {
  const title = (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) ?? [])[1]?.replace(/<[^>]+>/g, '').trim() ?? null;
  const blocks = html.split(/<h2\b/i).slice(1);
  const sections = {};
  for (const block of blocks) {
    const heading = (block.match(/^[^>]*>([\s\S]*?)<\/h2>/) ?? [])[1]?.replace(/<[^>]+>/g, '').trim() ?? '';
    if (!heading || STOP.test(heading)) continue;
    const rest = block.slice(block.indexOf('</h2>') + 5);
    const text = htmlToText(rest.split(/<h2\b/i)[0]).trim();
    if (text.length < 40) continue;
    const hit = HEADINGS.find(([, pattern]) => pattern.test(heading));
    if (!hit) continue;
    sections[hit[0]] = sections[hit[0]] ? `${sections[hit[0]]}\n\n${text}` : text;
  }
  return { slug, title, url: `${SITE}/lab-tests/${slug}/`, sections };
}

/** Which page MedlinePlus Connect points a LOINC code at. */
async function connectFor(code) {
  const url = `${CONNECT}?mainSearchCriteria.v.cs=${LOINC_SYSTEM}&mainSearchCriteria.v.c=${encodeURIComponent(code)}&knowledgeResponseType=application/json`;
  const response = await fetchPolite(url, { minDelayMs: 200 });
  if (!response.ok) return null;
  const data = await response.json().catch(() => null);
  const entries = data?.feed?.entry ?? [];
  for (const entry of entries) {
    const href = entry.link?.[0]?.href ?? '';
    const match = href.match(/\/lab-tests\/([a-z0-9-]+)\/?/);
    if (match) return { slug: match[1], title: entry.title?._value ?? null };
  }
  return null;
}

async function main() {
  ensureDir(path.join(dir, 'pages'));
  const slugs = await listSlugs();
  log(`labtests: ${slugs.length} pages listed`);

  // The pages themselves.
  const queue = [...slugs];
  let fetched = 0;
  await Promise.all(
    Array.from({ length: 6 }, async () => {
      while (queue.length) {
        const slug = queue.shift();
        const file = path.join(dir, 'pages', `${slug}.html`);
        if (fs.existsSync(file)) continue;
        try {
          const response = await fetchPolite(`${SITE}/lab-tests/${slug}/`, { minDelayMs: 150 });
          if (response.ok) {
            fs.writeFileSync(file, await response.text());
            fetched += 1;
          }
        } catch (error) {
          log(`labtests: ${slug} — ${error.message}`);
        }
        await sleep(80);
      }
    }),
  );
  log(`labtests: ${fetched} pages fetched this run`);

  // Which LOINC codes each page answers for.
  const loinc = readJson(path.join(cacheDir, 'loinc', 'tests.json'));
  const codesBySlug = new Map();
  if (loinc) {
    const mapFile = path.join(dir, 'loinc-map.json');
    const map = readJson(mapFile, { pairs: {} });
    const todo = loinc.tests.filter((t) => !(t.code in map.pairs));
    log(`labtests: ${todo.length} LOINC codes to map through MedlinePlus Connect`);
    let done = 0;
    for (const test of todo) {
      try {
        const hit = await connectFor(test.code);
        map.pairs[test.code] = hit?.slug ?? null;
      } catch (error) {
        log(`labtests: connect ${test.code} — ${error.message}`);
        map.pairs[test.code] = null;
      }
      done += 1;
      if (done % 100 === 0) {
        writeJson(mapFile, map);
        log(`labtests: ${done}/${todo.length} codes mapped`);
      }
    }
    writeJson(mapFile, map);
    for (const test of loinc.tests) {
      const slug = map.pairs[test.code];
      if (!slug) continue;
      codesBySlug.set(slug, [...(codesBySlug.get(slug) ?? []), test]);
    }
  }

  // The corpus of tests: a page, its sections, and the codes it answers for.
  const tests = [];
  for (const slug of slugs) {
    const file = path.join(dir, 'pages', `${slug}.html`);
    if (!fs.existsSync(file)) continue;
    const page = parsePage(slug, fs.readFileSync(file, 'utf8'));
    if (!page.title || !Object.keys(page.sections).length) continue;
    const codes = (codesBySlug.get(slug) ?? []).sort((a, b) => (a.consumer_name ?? '').localeCompare(b.consumer_name ?? ''));
    tests.push({ ...page, loinc: codes.slice(0, 12), loinc_count: codes.length, retrieved_at: new Date().toISOString() });
  }
  writeJson(path.join(dir, 'tests.json'), { retrieved_at: new Date().toISOString(), loinc_version: loinc?.version ?? null, tests });
  log(`labtests: ${tests.length} tests with text (${tests.filter((t) => t.loinc.length).length} with LOINC codes) → .cache/medicine/labtests/tests.json`);
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exitCode = 1;
});
