// Step 2b — MedlinePlus Genetics (US National Library of Medicine; the
// condition summaries are public domain, "Source: MedlinePlus, National
// Library of Medicine"). About 1,300 genetic and rare conditions with a
// plain-language description, synonyms, the inheritance pattern, the genes,
// and the codes that join a condition to its Wikidata item: MeSH, OMIM,
// ICD-10-CM. It is what the general MedlinePlus topics lack — the long tail
// of conditions a clinic meets once.
//
//   node scripts/medicine/genetics.mjs
//
// The site lists its conditions on one page per letter; each condition has
// a JSON file under /download/genetics/condition/<slug>.json.
// Output: .cache/medicine/genetics/conditions.json
import fs from 'node:fs';
import path from 'node:path';
import { cacheDir, ensureDir, fetchPolite, htmlToText, log, readJson, sleep, writeJson } from './lib.mjs';

const SITE = 'https://medlineplus.gov';
const dir = path.join(cacheDir, 'genetics');
const LETTERS = ['0', ...'abcdefghijklmnopqrstuvwxyz'];

/** Every condition slug the site lists, letter page by letter page. */
async function listSlugs() {
  const cached = readJson(path.join(dir, 'slugs.json'));
  if (cached?.slugs?.length) return cached.slugs;
  const slugs = new Set();
  for (const letter of LETTERS) {
    const response = await fetchPolite(`${SITE}/genetics/condition-${letter}/`, { minDelayMs: 400 });
    if (!response.ok) {
      log(`genetics: letter ${letter} → ${response.status}`);
      continue;
    }
    const html = await response.text();
    for (const match of html.matchAll(/genetics\/condition\/([a-z0-9-]+)\/?["']/g)) slugs.add(match[1]);
  }
  const list = [...slugs].sort();
  writeJson(path.join(dir, 'slugs.json'), { retrieved_at: new Date().toISOString(), slugs: list });
  return list;
}

/** One condition file to a plain record; the description as text, with paragraph breaks kept. */
function parse(slug, data) {
  const texts = data['text-list'] ?? [];
  const description = texts.find((t) => t.text?.['text-role'] === 'description') ?? texts[0];
  const keys = (data['db-key-list'] ?? []).map((k) => k['db-key']).filter(Boolean);
  const byDb = (db) => keys.filter((k) => k.db === db).map((k) => String(k.key));
  return {
    slug,
    name: data.name,
    url: data.ghr_page ?? `${SITE}/genetics/condition/${slug}/`,
    synonyms: (data['synonym-list'] ?? []).map((s) => s.synonym).filter(Boolean),
    mesh: byDb('MeSH'),
    omim: byDb('OMIM'),
    icd10cm: byDb('ICD-10-CM'),
    snomed: byDb('SNOMED CT'),
    inheritance: (data['inheritance-pattern-list'] ?? []).map((i) => i['inheritance-pattern']?.memo).filter(Boolean),
    genes: (data['related-gene-list'] ?? []).map((g) => g['related-gene']?.['gene-symbol']).filter(Boolean),
    description_text: description?.text?.html ? htmlToText(description.text.html) : null,
    reviewed: data.reviewed ?? null,
    published: data.published ?? null,
  };
}

async function main() {
  ensureDir(path.join(dir, 'conditions'));
  const slugs = await listSlugs();
  log(`genetics: ${slugs.length} conditions listed`);
  // The site takes several seconds per file whatever the pace, so eight
  // requests travel at once — still about one a second, which is polite.
  let fetched = 0;
  const fetchOne = async (slug) => {
    const file = path.join(dir, 'conditions', `${slug}.json`);
    if (readJson(file)) return;
    const response = await fetchPolite(`${SITE}/download/genetics/condition/${slug}.json`, { minDelayMs: 200 });
    if (!response.ok) {
      log(`genetics: ${slug} → ${response.status}`);
      return;
    }
    writeJson(file, await response.json());
    fetched += 1;
    if (fetched % 100 === 0) log(`genetics: ${fetched} fetched`);
  };
  const queue = [...slugs];
  await Promise.all(
    Array.from({ length: 8 }, async () => {
      while (queue.length) {
        const slug = queue.shift();
        try {
          await fetchOne(slug);
        } catch (error) {
          log(`genetics: ${slug} — ${error.message}`);
        }
        await sleep(50);
      }
    }),
  );

  const conditions = [];
  for (const slug of slugs) {
    const data = readJson(path.join(dir, 'conditions', `${slug}.json`));
    if (!data) continue;
    const record = parse(slug, data);
    if (record.name && record.description_text) conditions.push(record);
  }
  writeJson(path.join(dir, 'conditions.json'), { retrieved_at: new Date().toISOString(), conditions });
  log(`genetics: ${conditions.length} conditions with a description → .cache/medicine/genetics/conditions.json`);
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exitCode = 1;
});
