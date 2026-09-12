// Step 3b — RxNorm (US National Library of Medicine, public domain): the
// ingredient concept (RxCUI) each drug name resolves to. It is a second,
// independent opinion on what a name means — Wikidata carries an RxCUI of
// its own (P3345), and when the two agree the entry's identity is confirmed
// by two sources; it is also how a label from the FDA can be tied to the
// same ingredient. RxNav asks for no key, only politeness.
//
//   node scripts/medicine/rxnorm.mjs
//
// Output: .cache/medicine/rxnorm/<qid>.json
import fs from 'node:fs';
import path from 'node:path';
import { cacheDir, fetchPolite, log, readJson, sleep, writeJson } from './lib.mjs';
import { candidateNames } from './lib/drug-names.mjs';

const API = 'https://rxnav.nlm.nih.gov/REST';
const dir = path.join(cacheDir, 'rxnorm');

/** The ingredient RxCUI for a name, through RxNav's normalised search. */
async function lookup(name) {
  const response = await fetchPolite(`${API}/rxcui.json?name=${encodeURIComponent(name)}&search=2`, { minDelayMs: 120 });
  if (!response.ok) return null;
  const data = await response.json();
  const ids = data.idGroup?.rxnormId ?? [];
  return ids.length ? String(ids[0]) : null;
}

async function main() {
  const corpus = readJson(path.join(cacheDir, 'wikidata', 'corpus.json'));
  if (!corpus) throw new Error('run wikidata.mjs first');
  fs.mkdirSync(dir, { recursive: true });
  let found = 0;
  let done = 0;
  for (const qid of corpus.selected.drug) {
    const file = path.join(dir, `${qid}.json`);
    const existing = readJson(file);
    if (existing) {
      if (existing.found) found += 1;
      done += 1;
      continue;
    }
    const record = corpus.entities[qid];
    let hit = null;
    for (const name of candidateNames(record, corpus.curated?.[qid] ?? null, 4)) {
      const rxcui = await lookup(name);
      if (rxcui) {
        hit = { name, rxcui };
        break;
      }
    }
    writeJson(file, { qid, found: Boolean(hit), ...(hit ?? {}), retrieved_at: new Date().toISOString() });
    if (hit) found += 1;
    done += 1;
    if (done % 50 === 0) log(`rxnorm: ${done}/${corpus.selected.drug.length} (${found} found)`);
    await sleep(80);
  }
  log(`rxnorm: ${found}/${corpus.selected.drug.length} drugs resolved → .cache/medicine/rxnorm/`);
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exitCode = 1;
});
