// Step 3 — FDA drug labelling through openFDA (CC0). For each drug in the
// corpus, the most recent label of a single-ingredient product of the active
// ingredient: what it is for, how it is given, who must not take it, what it
// does on the side, what it interacts with — kept word for word, with the
// label's own date and the DailyMed address of the full document.
//
//   node scripts/medicine/openfda.mjs
//
// Without OPENFDA_API_KEY (free, instant) the service allows 1,000 requests a
// day per address. The first pass therefore asks for two drugs per request;
// only the drugs that pass finds nothing for are asked about one by one. The
// run stops at the day's budget and continues from the cache next time.
// Output: .cache/medicine/openfda/<qid>.json
import fs from 'node:fs';
import path from 'node:path';
import { cacheDir, env, fetchPolite, log, readJson, sleep, writeJson } from './lib.mjs';
import { candidateNames } from './lib/drug-names.mjs';

const API = 'https://api.fda.gov/drug/label.json';
const dir = path.join(cacheDir, 'openfda');
const SECTIONS = [
  'indications_and_usage',
  'dosage_and_administration',
  'contraindications',
  'boxed_warning',
  'warnings',
  'warnings_and_cautions',
  'adverse_reactions',
  'drug_interactions',
  'use_in_specific_populations',
  'pregnancy',
];
/** A label section can run to many pages; this much is kept, the rest is one click away. */
const MAX_CHARS = 6000;
const RX = 'HUMAN PRESCRIPTION DRUG';

const key = env('OPENFDA_API_KEY');
/** Requests this run may still make; a key lifts the ceiling out of the way. */
let budget = Number(env('OPENFDA_DAILY_BUDGET') || (key ? 100000 : 900));

/**
 * Words that may follow the ingredient in a single-ingredient generic name:
 * its salt, its release form, its strength. "AND", a comma or a slash mean a
 * combination product, and a combination's label is not this drug's label —
 * the first pass returned butalbital-aspirin-caffeine for aspirin.
 */
const TRAILING = new Set([
  'sodium', 'potassium', 'calcium', 'magnesium', 'hydrochloride', 'hcl', 'besylate', 'succinate', 'tartrate', 'sulfate',
  'sulphate', 'maleate', 'mesylate', 'citrate', 'acetate', 'phosphate', 'bromide', 'fumarate', 'tosylate', 'monohydrate',
  'trihydrate', 'dihydrate', 'anhydrous', 'hemihydrate', 'hydrobromide', 'nitrate', 'lactate', 'gluconate', 'carbonate',
  'chloride', 'disodium', 'dipotassium', 'dihydrochloride', 'dipropionate', 'propionate', 'valerate', 'acetonide', 'furoate',
  'palmitate', 'stearate', 'benzoate', 'butyrate', 'decanoate', 'enanthate', 'cypionate', 'mofetil', 'axetil', 'medoxomil',
  'cilexetil', 'hyclate', 'pamoate', 'xinafoate', 'salicylate', 'er', 'xr', 'sr', 'dr', 'cr', 'la', 'extended', 'delayed', 'release', 'tablet',
  'tablets', 'capsule', 'capsules', 'oral', 'solution', 'suspension', 'injection', 'usp', 'mg', 'mcg', 'g', 'ml', 'film',
  'coated', 'chewable', 'orally', 'disintegrating', 'topical', 'cream', 'ointment', 'gel', 'inhalation', 'aerosol',
  'ophthalmic', 'nasal', 'spray', 'transdermal', 'system', 'patch', 'lotion', 'shampoo', 'foam', 'powder', 'for',
]);

function singleIngredient(label, name) {
  const generic = String(label.openfda?.generic_name?.[0] ?? '').toLowerCase();
  if (!generic || /\band\b|,|\/|\bwith\b|\+/.test(generic)) return false;
  const want = name.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(Boolean);
  const have = generic.replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(Boolean);
  if (have.slice(0, want.length).join(' ') !== want.join(' ')) return false;
  return have.slice(want.length).every((word) => TRAILING.has(word) || /^\d+(\.\d+)?$/.test(word));
}

function sectionText(label, key) {
  const parts = label[key];
  if (!Array.isArray(parts) || parts.length === 0) return null;
  const text = parts.join('\n\n').replace(/\s+\n/g, '\n').trim();
  return text.length > MAX_CHARS ? `${text.slice(0, MAX_CHARS).trimEnd()} […]` : text;
}

/** One request; null when the day's budget is spent. 404 and 400 are "nothing", not errors. */
async function query(search, limit) {
  if (budget <= 0) return null;
  budget -= 1;
  const url = `${API}?search=${search}&sort=effective_time:desc&limit=${limit}${key ? `&api_key=${key}` : ''}`;
  const response = await fetchPolite(url, { minDelayMs: 300 });
  if (response.status === 404 || response.status === 400) return [];
  if (response.status === 429) {
    log('openfda: rate limited — stopping for today; the cache keeps what was read');
    budget = 0;
    return null;
  }
  if (!response.ok) throw new Error(`openFDA ${response.status}`);
  const data = await response.json();
  return data.results ?? [];
}

const usable = (label) => Array.isArray(label.indications_and_usage) && label.indications_and_usage.length > 0;

/** The best label for a name among results: prescription before OTC, newest first (the query sorts). */
function pick(results, name) {
  const mine = results.filter((label) => usable(label) && singleIngredient(label, name));
  return mine.find((label) => label.openfda?.product_type?.[0] === RX) ?? mine[0] ?? null;
}

function record(qid, label, matchedName) {
  const sections = {};
  for (const key of SECTIONS) {
    const text = sectionText(label, key);
    if (text) sections[key] = text;
  }
  return {
    qid,
    found: true,
    matched_name: matchedName,
    set_id: label.set_id ?? null,
    effective_time: label.effective_time ?? null,
    brand_name: label.openfda?.brand_name?.[0] ?? null,
    generic_name: label.openfda?.generic_name?.[0] ?? null,
    substance_name: label.openfda?.substance_name?.[0] ?? null,
    product_type: label.openfda?.product_type?.[0] ?? null,
    manufacturer: label.openfda?.manufacturer_name?.[0] ?? null,
    unii: label.openfda?.unii ?? [],
    rxcui: label.openfda?.rxcui ?? [],
    url: label.set_id ? `https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=${label.set_id}` : null,
    retrieved_at: new Date().toISOString(),
    sections,
  };
}

const term = (name) => `openfda.generic_name:"${encodeURIComponent(name)}"`;

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
    const names = candidateNames(corpus.entities[qid], corpus.curated?.[qid] ?? null);
    if (names.length) todo.push({ qid, names });
    else writeJson(path.join(dir, `${qid}.json`), { qid, found: false, reason: 'no usable name', retrieved_at: new Date().toISOString() });
  }
  log(`openfda: ${todo.length} drugs to look up, ${found} already cached, budget ${budget} requests`);

  // Pass 1: two drugs per request, by their first name, prescription labels
  // first, a dozen labels a page — a label is a hundred kilobytes or more,
  // and a page of a hundred took minutes to arrive. A name's own labels are
  // matched locally, so a crowded name (ibuprofen has thousands) only costs
  // the other a second look.
  const missed = [];
  for (let i = 0; i < todo.length; i += 2) {
    const group = todo.slice(i, i + 2);
    const search = `(${group.map((d) => term(d.names[0])).join('+')})+AND+openfda.product_type:"${encodeURIComponent(RX)}"`;
    const results = await query(search, 12);
    if (results === null) {
      missed.push(...group, ...todo.slice(i + 2));
      break;
    }
    for (const drug of group) {
      const label = pick(results, drug.names[0]);
      if (label) {
        writeJson(path.join(dir, `${drug.qid}.json`), record(drug.qid, label, drug.names[0]));
        found += 1;
        log(`openfda: ${drug.names[0]} ← ${label.openfda?.brand_name?.[0] ?? drug.names[0]} (${label.effective_time ?? '?'})`);
      } else missed.push(drug);
    }
    await sleep(100);
  }

  // Pass 2: the misses one by one — each of their names, prescription then
  // over-the-counter — until the budget runs out.
  let stopped = false;
  for (const drug of missed) {
    if (budget <= 0) {
      stopped = true;
      break;
    }
    let hit = null;
    outer: for (const prescriptionOnly of [true, false]) {
      for (const name of drug.names.slice(0, 4)) {
        const search = prescriptionOnly ? `${term(name)}+AND+openfda.product_type:"${encodeURIComponent(RX)}"` : term(name);
        const results = await query(search, 8);
        if (results === null) {
          stopped = true;
          break outer;
        }
        const label = pick(results, name);
        if (label) {
          hit = { label, name };
          break outer;
        }
      }
    }
    if (stopped && !hit) break;
    if (hit) {
      writeJson(path.join(dir, `${drug.qid}.json`), record(drug.qid, hit.label, hit.name));
      found += 1;
      log(`openfda: ${drug.names[0]} ← ${hit.label.openfda?.brand_name?.[0] ?? hit.name} (${hit.label.effective_time ?? '?'})`);
    } else {
      writeJson(path.join(dir, `${drug.qid}.json`), { qid: drug.qid, found: false, tried: drug.names.slice(0, 4), retrieved_at: new Date().toISOString() });
      log(`openfda: no single-ingredient label for ${drug.names[0]}`);
    }
  }

  const total = corpus.selected.drug.length;
  if (stopped) log(`openfda: stopped at the day's budget — ${found}/${total} so far; run again tomorrow, or set OPENFDA_API_KEY (free) for 120,000 a day`);
  else log(`openfda: labels for ${found}/${total} drugs → .cache/medicine/openfda/`);
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exitCode = 1;
});
