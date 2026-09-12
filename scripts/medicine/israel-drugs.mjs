// Step 3c — the Israeli layer: which products of each active ingredient are
// registered here, under which Hebrew names, and where the Hebrew leaflet
// is. It is what turns an American label into something a clinic in Israel
// can use: the practitioner writes "סיאליס", the entry is tadalafil.
//
//   node scripts/medicine/israel-drugs.mjs
//
// Only facts and links are taken — the Hebrew and English product names, the
// registration number, the dosage form, whether it needs a prescription,
// whether it is in the health basket, the registration holder, and the
// address of the leaflet on the Ministry's own site. **The leaflets
// themselves are not copied**: they belong to the manufacturers, and the
// entry links to them.
//
// The registry has no documented API; this is the service its own site
// calls, so it is read slowly and a failure is never fatal.
// Output: .cache/medicine/israel/<qid>.json
import fs from 'node:fs';
import path from 'node:path';
import { cacheDir, fetchPolite, log, readJson, sleep, writeJson } from './lib.mjs';
import { candidateNames } from './lib/drug-names.mjs';

const API = 'https://israeldrugs.health.gov.il/GovServiceList/IDRServer';
/** Where the Ministry publishes the leaflet files themselves. */
const FILES = 'https://mohpublic.z6.web.core.windows.net/IsraelDrugs';
const dir = path.join(cacheDir, 'israel');
/** Enough to show the shelf without turning the entry into a catalogue. */
const MAX_PRODUCTS = 12;

async function post(endpoint, body) {
  const response = await fetchPolite(`${API}/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
    minDelayMs: 250,
  });
  if (!response.ok) return null;
  return response.json().catch(() => null);
}

const normalize = (name) => String(name ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** A product of this ingredient and of nothing else, for people. */
function isOurs(product, name) {
  const compare = normalize(product.activeComponentsCompareName);
  if (!compare) return false;
  if (/[,+]|\band\b/.test(compare)) return false;
  // The registry holds veterinary products too, under the same ingredient.
  if (/וטרינר/.test(product.dragHebName ?? '') || /\bvet\b|veterinary/i.test(product.dragEnName ?? '')) return false;
  return compare === normalize(name) || compare.startsWith(`${normalize(name)} `);
}

/** The Hebrew consumer leaflet if there is one, else any consumer leaflet. */
function leafletOf(details) {
  const brochures = (details?.brochure ?? []).filter((b) => b.url);
  const consumer = brochures.filter((b) => /עלון לצרכן/.test(b.type ?? b.display ?? ''));
  const hebrew = consumer.find((b) => !b.lng || /עברית/.test(b.lng));
  const pick = hebrew ?? consumer[0] ?? null;
  if (!pick) return null;
  return {
    url: `${FILES}/${pick.url}`,
    language: pick.lng ?? 'עברית',
    updated_at: pick.updateDateFormat ?? null,
  };
}

async function productsFor(names) {
  for (const name of names.slice(0, 4)) {
    const data = await post('SearchByName', { val: name, prescription: false, healthServices: false, pageIndex: 1, orderBy: 0 });
    const results = (data?.results ?? []).filter((p) => isOurs(p, name) && !p.iscanceled);
    if (results.length) return { name, results };
  }
  return null;
}

async function main() {
  const corpus = readJson(path.join(cacheDir, 'wikidata', 'corpus.json'));
  if (!corpus) throw new Error('run wikidata.mjs first');
  fs.mkdirSync(dir, { recursive: true });

  const todo = [];
  let found = 0;
  for (const qid of corpus.selected.drug) {
    const existing = readJson(path.join(dir, `${qid}.json`));
    if (existing) {
      if (existing.found) found += 1;
      continue;
    }
    if (!(corpus.entities[qid].claims.atc ?? []).some((code) => code.length >= 7)) continue;
    const names = candidateNames(corpus.entities[qid], corpus.curated?.[qid] ?? null);
    if (names.length) todo.push({ qid, names });
  }
  log(`israel: ${todo.length} ingredients to look up, ${found} already cached`);

  let done = 0;
  const queue = [...todo];
  await Promise.all(
    Array.from({ length: 2 }, async () => {
      while (queue.length) {
        const drug = queue.shift();
        try {
          const hit = await productsFor(drug.names);
          if (!hit) {
            writeJson(path.join(dir, `${drug.qid}.json`), { qid: drug.qid, found: false, tried: drug.names.slice(0, 4), retrieved_at: new Date().toISOString() });
          } else {
            // One product is asked about in full, for the leaflet and the basket details.
            const details = await post('GetSpecificDrug', { dragRegNum: hit.results[0].dragRegNum });
            const products = hit.results
              .slice(0, MAX_PRODUCTS)
              .map((p) => ({
                name_he: String(p.dragHebName ?? '').replace(/\s+/g, ' ').trim(),
                name_en: String(p.dragEnName ?? '').replace(/\s+/g, ' ').trim(),
                registration: p.dragRegNum,
                dosage_form: p.dosageForm ?? null,
                prescription: Boolean(p.prescription),
                in_basket: Boolean(p.health),
              }))
              .sort((a, b) => a.name_he.localeCompare(b.name_he, 'he'));
            writeJson(path.join(dir, `${drug.qid}.json`), {
              qid: drug.qid,
              found: true,
              matched_name: hit.name,
              ingredient_he: details?.activeMetirals?.[0]?.ingredientsDesc ?? null,
              registration_holder: details?.regOwnerName ?? null,
              atc: details?.atc?.[0]?.atc5Code ?? null,
              leaflet: leafletOf(details),
              products,
              retrieved_at: new Date().toISOString(),
            });
            found += 1;
          }
        } catch (error) {
          log(`israel: ${drug.names[0]} — ${error.message}`);
        }
        done += 1;
        if (done % 50 === 0) log(`israel: ${done}/${todo.length} (${found} with Israeli products)`);
        await sleep(200);
      }
    }),
  );
  log(`israel: ${found} ingredients with registered products → .cache/medicine/israel/`);
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exitCode = 1;
});
