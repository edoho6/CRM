// Step 3 — FDA drug labelling through openFDA (CC0). For each drug in the
// corpus, the most recent prescription label of the active ingredient: what
// it is for, how it is given, who must not take it, what it does on the side,
// what it interacts with — kept word for word, with the label's own date and
// the DailyMed address of the full document.
//
//   node scripts/medicine/openfda.mjs
//
// Without OPENFDA_API_KEY (free, instant) the service allows 1,000 requests a
// day per address — enough for a sample, not for the whole corpus.
// Output: .cache/medicine/openfda/<qid>.json
import fs from 'node:fs';
import path from 'node:path';
import { cacheDir, env, fetchPolite, log, readJson, sleep, writeJson } from './lib.mjs';

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

/** The international name on the left, the name the FDA files under on the right. */
const US_NAMES = {
  paracetamol: 'acetaminophen',
  salbutamol: 'albuterol',
  adrenaline: 'epinephrine',
  noradrenaline: 'norepinephrine',
  glibenclamide: 'glyburide',
  ciclosporin: 'cyclosporine',
  aciclovir: 'acyclovir',
  beclometasone: 'beclomethasone',
  cefalexin: 'cephalexin',
  colestyramine: 'cholestyramine',
  'glyceryl trinitrate': 'nitroglycerin',
  hyoscine: 'scopolamine',
  isoprenaline: 'isoproterenol',
  mesalazine: 'mesalamine',
  oestradiol: 'estradiol',
  pethidine: 'meperidine',
  phenobarbitone: 'phenobarbital',
  rifampicin: 'rifampin',
  amfetamine: 'amphetamine',
  dexamfetamine: 'dextroamphetamine',
  lignocaine: 'lidocaine',
  frusemide: 'furosemide',
  levothyroxine: 'levothyroxine sodium',
};

/**
 * Words that may follow the ingredient in a single-ingredient generic name:
 * its salt, its release form, its strength. "AND", a comma or a slash mean a
 * combination product, and a combination's label is not this drug's label —
 * the first pass returned butalbital-aspirin-caffeine for aspirin.
 */
const TRAILING = new Set([
  'sodium', 'potassium', 'calcium', 'magnesium', 'hydrochloride', 'hcl', 'besylate', 'succinate', 'tartrate', 'sulfate',
  'sulphate', 'maleate', 'mesylate', 'citrate', 'acetate', 'phosphate', 'bromide', 'fumarate', 'tosylate', 'monohydrate',
  'trihydrate', 'dihydrate', 'anhydrous', 'hemihydrate', 'er', 'xr', 'sr', 'dr', 'cr', 'la', 'extended', 'delayed',
  'release', 'tablet', 'tablets', 'capsule', 'capsules', 'oral', 'solution', 'suspension', 'injection', 'usp', 'mg', 'mcg', 'g',
  'ml', 'film', 'coated', 'chewable', 'orally', 'disintegrating',
]);

function singleIngredient(label, name) {
  const generic = String(label.openfda?.generic_name?.[0] ?? '').toLowerCase();
  if (!generic || /\band\b|,|\/|\bwith\b/.test(generic)) return false;
  const want = name.toLowerCase().split(/\s+/);
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

async function search(name, prescriptionOnly) {
  const key = env('OPENFDA_API_KEY');
  const query = [`openfda.generic_name:"${name}"`, prescriptionOnly ? 'openfda.product_type:"HUMAN PRESCRIPTION DRUG"' : null]
    .filter(Boolean)
    .join('+AND+');
  const url = `${API}?search=${query}&sort=effective_time:desc&limit=25${key ? `&api_key=${key}` : ''}`;
  const response = await fetchPolite(url, { minDelayMs: 350 });
  if (response.status === 404 || response.status === 400) return [];
  if (!response.ok) throw new Error(`openFDA ${response.status} for ${name}`);
  const data = await response.json();
  return data.results ?? [];
}

function pick(results, name) {
  return results.find((label) => singleIngredient(label, name) && Array.isArray(label.indications_and_usage) && label.indications_and_usage.length) ?? null;
}

async function labelFor(record, curatedName) {
  // A name the search can take: letters, digits, spaces and hyphens. Wikidata
  // labels like "(S)-(−)-colchicine" are skipped, not sent. The name the
  // corpus asked for comes first, then its American spelling, then Wikidata's.
  const raw = [curatedName, record.labels.en, ...record.aliases.en]
    .filter(Boolean)
    .map((n) => n.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/^rac-/, '').trim())
    .filter((n) => /^[a-z0-9][a-z0-9 -]{2,60}$/i.test(n));
  const names = [];
  for (const n of raw) {
    const us = US_NAMES[n.toLowerCase()];
    if (us && !names.includes(us)) names.push(us);
    if (!names.includes(n)) names.push(n);
  }
  for (const prescriptionOnly of [true, false]) {
    for (const name of names.slice(0, 8)) {
      const label = pick(await search(name, prescriptionOnly), name);
      if (label) return { label, matched_name: name };
    }
  }
  return null;
}

async function main() {
  const corpus = readJson(path.join(cacheDir, 'wikidata', 'corpus.json'));
  if (!corpus) throw new Error('run wikidata.mjs first');
  fs.mkdirSync(dir, { recursive: true });
  let found = 0;
  for (const qid of corpus.selected.drug) {
    const file = path.join(dir, `${qid}.json`);
    if (fs.existsSync(file)) {
      if (readJson(file)?.set_id) found += 1;
      continue;
    }
    const record = corpus.entities[qid];
    const hit = await labelFor(record, corpus.curated?.[qid] ?? null);
    if (!hit) {
      writeJson(file, { qid, found: false, retrieved_at: new Date().toISOString() });
      log(`openfda: no label for ${record.labels.en}`);
      continue;
    }
    const { label, matched_name } = hit;
    const sections = {};
    for (const key of SECTIONS) {
      const text = sectionText(label, key);
      if (text) sections[key] = text;
    }
    writeJson(file, {
      qid,
      found: true,
      matched_name,
      set_id: label.set_id ?? null,
      effective_time: label.effective_time ?? null,
      brand_name: label.openfda?.brand_name?.[0] ?? null,
      generic_name: label.openfda?.generic_name?.[0] ?? null,
      product_type: label.openfda?.product_type?.[0] ?? null,
      manufacturer: label.openfda?.manufacturer_name?.[0] ?? null,
      url: label.set_id ? `https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=${label.set_id}` : null,
      retrieved_at: new Date().toISOString(),
      sections,
    });
    found += 1;
    log(`openfda: ${record.labels.en} ← ${label.openfda?.brand_name?.[0] ?? matched_name} (${label.effective_time ?? '?'})`);
    await sleep(200);
  }
  log(`openfda: labels for ${found}/${corpus.selected.drug.length} drugs → .cache/medicine/openfda/`);
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exitCode = 1;
});
