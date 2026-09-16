// Step 3 — FDA drug labelling through DailyMed (US National Library of
// Medicine; the labels are the FDA's structured product labels, the same
// public documents openFDA serves under CC0). For each drug in the corpus,
// the newest label of a single-ingredient product of the active ingredient:
// what it is for, how it is given, who must not take it, what it does on the
// side, what it interacts with — word for word, with the label's own date
// and the DailyMed address of the full document.
//
//   node scripts/medicine/dailymed.mjs
//
// Why DailyMed and not openFDA for the full corpus: openFDA answers a search
// with whole labels a megabyte at a time and, without a key, a thousand
// times a day; DailyMed lists a drug's labels in a few kilobytes and hands
// one document over on request, with no daily ceiling. openfda.mjs stays as
// the alternative for a run with a key. Both write the same record.
// Output: .cache/medicine/openfda/<qid>.json
import fs from 'node:fs';
import path from 'node:path';
import { cacheDir, fetchPolite, htmlToText, log, readJson, sleep, writeJson } from './lib.mjs';
import { candidateNames } from './lib/drug-names.mjs';

const API = 'https://dailymed.nlm.nih.gov/dailymed/services/v2';
const dir = path.join(cacheDir, 'openfda');
/** A label section can run to many pages; this much is kept, the rest is one click away. */
const MAX_CHARS = 6000;

/** LOINC section codes of the label, named as openFDA names them so the compiler reads both alike. */
const SECTIONS = {
  '34067-9': 'indications_and_usage',
  '34068-7': 'dosage_and_administration',
  '34070-3': 'contraindications',
  '34066-1': 'boxed_warning',
  '34071-1': 'warnings',
  '43685-7': 'warnings_and_cautions',
  '34084-4': 'adverse_reactions',
  '34073-7': 'drug_interactions',
  '43684-0': 'use_in_specific_populations',
  '42228-7': 'pregnancy',
};
const RX_DOCUMENT = '34391-3';
const OTC_DOCUMENT = '34390-5';
const UNII_SYSTEM = '2.16.840.1.113883.4.9';

/** Words that may follow the ingredient in a single-ingredient product name (see openfda.mjs). */
const TRAILING = new Set([
  'sodium', 'potassium', 'calcium', 'magnesium', 'zinc', 'hydrochloride', 'dihydrochloride', 'trihydrochloride', 'hcl',
  'besylate', 'succinate', 'tartrate', 'bitartrate', 'sulfate', 'sulphate', 'maleate', 'mesylate', 'citrate', 'acetate',
  'phosphate', 'bromide', 'fumarate', 'tosylate', 'monohydrate', 'trihydrate', 'dihydrate', 'anhydrous', 'hemihydrate',
  'hydrobromide', 'nitrate', 'lactate', 'gluconate', 'carbonate', 'chloride', 'disodium', 'dipotassium', 'dipropionate',
  'propionate', 'valerate', 'acetonide', 'furoate', 'palmitate', 'stearate', 'benzoate', 'butyrate', 'decanoate',
  'enanthate', 'cypionate', 'undecanoate', 'pivalate', 'mofetil', 'axetil', 'proxetil', 'medoxomil', 'cilexetil',
  'etabonate', 'hyclate', 'pamoate', 'napsylate', 'xinafoate', 'aceponate', 'malate', 'salicylate', 'tannate', 'polistirex',
  'edisylate', 'isethionate', 'hydroxide', 'oxide', 'iodide', 'nicotinate', 'aspartate', 'glycinate', 'orotate', 'pidolate',
  'er', 'xr', 'sr', 'dr', 'cr', 'la', 'extended', 'delayed', 'release', 'usp', 'mg', 'mcg', 'g', 'ml', 'film', 'coated',
  'chewable', 'orally', 'disintegrating', 'for', 'oral', 'topical', 'ophthalmic', 'nasal', 'transdermal', 'vaginal', 'rectal',
  'human', 'recombinant', 'synthetic', 'micronized', 'liposomal', 'pegylated',
]);

/** The dosage form ends the product part of a title: "WARFARIN SODIUM TABLET [LABELER]". */
const FORMS = /\b(tablet|tablets|capsule|capsules|injection|solution|suspension|cream|ointment|gel|lotion|patch|film|spray|aerosol|powder|kit|inhalant|lozenge|suppository|emulsion|granule|granules|syrup|elixir|drops|liquid|shampoo|foam|implant|insert|ring|swab|pellet|concentrate|tincture|paste|jelly|enema|system|strip|bar|soap|wafer|troche|pill|pills|dressing)\b/i;

/** The product's generic name(s) from a listing title, and whether it is one ingredient. */
function titleParts(title) {
  const product = String(title).replace(/\s*\[.*$/, '').trim();
  const cut = product.search(FORMS);
  const namePart = (cut > 0 ? product.slice(0, cut) : product).trim();
  const inner = namePart.match(/\(([^)]+)\)/)?.[1] ?? null;
  const outer = namePart.replace(/\s*\([^)]*\)\s*/g, ' ').trim();
  return { candidates: [outer, inner].filter(Boolean), combination: /\band\b|,|\/|\bwith\b|\+/i.test(namePart) };
}

function singleIngredientName(candidate, name) {
  const want = name.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(Boolean);
  const have = candidate.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(Boolean);
  if (!want.length || have.length < want.length) return false;
  // A one-word name may be spelled a letter or two shorter on Wikidata
  // ("carbamazepin" for CARBAMAZEPINE); a longer name must match word for word.
  const head = have.slice(0, want.length);
  const same =
    want.length === 1
      ? head[0] === want[0] || (head[0].startsWith(want[0]) && head[0].length - want[0].length <= 2 && want[0].length >= 6)
      : head.join(' ') === want.join(' ');
  if (!same) return false;
  return have.slice(want.length).every((word) => TRAILING.has(word) || /^\d+(\.\d+)?$/.test(word));
}

function isSingleIngredient(title, name) {
  const { candidates, combination } = titleParts(title);
  if (combination) return false;
  return candidates.some((c) => singleIngredientName(c, name));
}

/** The whole element of the outermost <section> that carries a LOINC code, nested sections included. */
function sectionByCode(xml, code) {
  const marker = `code="${code}"`;
  let at = xml.indexOf(marker);
  let best = null;
  while (at >= 0) {
    const start = xml.lastIndexOf('<section', at);
    if (start >= 0) {
      let depth = 0;
      const re = /<section\b|<\/section>/g;
      re.lastIndex = start;
      let match;
      let end = -1;
      while ((match = re.exec(xml))) {
        depth += match[0] === '</section>' ? -1 : 1;
        if (depth === 0) {
          end = match.index + match[0].length;
          break;
        }
      }
      if (end > start && (!best || start < best.start)) best = { start, end };
    }
    at = xml.indexOf(marker, at + marker.length);
  }
  return best ? xml.slice(best.start, best.end) : null;
}

/** SPL markup to plain text: paragraphs and list items on their own lines, tables cell by cell. */
function splText(fragment) {
  const withBreaks = fragment
    .replace(/<\/(paragraph|item|title|caption|tr)>/gi, '\n')
    .replace(/<\/(td|th)>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n');
  const text = htmlToText(withBreaks);
  return text.length > MAX_CHARS ? `${text.slice(0, MAX_CHARS).trimEnd()} […]` : text;
}

function parseLabel(xml) {
  const documentType = xml.includes(`code="${RX_DOCUMENT}"`) ? 'HUMAN PRESCRIPTION DRUG' : xml.includes(`code="${OTC_DOCUMENT}"`) ? 'HUMAN OTC DRUG' : null;
  const effective = xml.match(/<effectiveTime value="(\d{8})/)?.[1] ?? null;
  const unii = new Set();
  for (const block of xml.matchAll(/<ingredient classCode="ACTI[BM]"[\s\S]*?<\/ingredient>/g)) {
    for (const code of block[0].matchAll(new RegExp(`code="([A-Z0-9]{10})" codeSystem="${UNII_SYSTEM.replace(/\./g, '\\.')}"`, 'g'))) unii.add(code[1]);
  }
  const sections = {};
  for (const [code, key] of Object.entries(SECTIONS)) {
    const fragment = sectionByCode(xml, code);
    if (!fragment) continue;
    const text = splText(fragment);
    if (text) sections[key] = text;
  }
  return { documentType, effective, unii: [...unii], sections };
}

async function listLabels(name) {
  const response = await fetchPolite(`${API}/spls.json?drug_name=${encodeURIComponent(name)}&pagesize=25&page=1`, { minDelayMs: 150 });
  if (!response.ok) return [];
  const data = await response.json();
  return data.data ?? [];
}

async function fetchLabel(setid) {
  const response = await fetchPolite(`${API}/spls/${setid}.xml`, { minDelayMs: 150 });
  if (!response.ok) return null;
  return response.text();
}

async function labelFor(names) {
  for (const name of names.slice(0, 6)) {
    const listed = (await listLabels(name)).filter((s) => isSingleIngredient(s.title, name));
    let fallback = null;
    // The list is newest first; the first prescription label wins, an OTC one is kept in case there is no other.
    for (const spl of listed.slice(0, 3)) {
      const xml = await fetchLabel(spl.setid);
      if (!xml) continue;
      const parsed = parseLabel(xml);
      if (!parsed.sections.indications_and_usage) continue;
      const found = { spl, parsed, name };
      if (parsed.documentType === 'HUMAN PRESCRIPTION DRUG') return found;
      fallback ??= found;
    }
    if (fallback) return fallback;
  }
  return null;
}

function record(qid, { spl, parsed, name }) {
  const { candidates } = titleParts(spl.title);
  return {
    qid,
    found: true,
    via: 'dailymed',
    matched_name: name,
    set_id: spl.setid,
    effective_time: parsed.effective,
    brand_name: candidates[0] ?? null,
    generic_name: candidates[1] ?? candidates[0] ?? null,
    substance_name: candidates[1] ?? candidates[0] ?? null,
    product_type: parsed.documentType,
    manufacturer: spl.title.match(/\[(.+)\]\s*$/)?.[1] ?? null,
    unii: parsed.unii,
    rxcui: [],
    url: `https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=${spl.setid}`,
    retrieved_at: new Date().toISOString(),
    sections: parsed.sections,
  };
}

async function main() {
  const corpus = readJson(path.join(cacheDir, 'wikidata', 'corpus.json'));
  if (!corpus) throw new Error('run wikidata.mjs first');
  fs.mkdirSync(dir, { recursive: true });
  const todo = [];
  let found = 0;
  for (const qid of corpus.selected.drug) {
    const existing = readJson(path.join(dir, `${qid}.json`));
    if (existing?.found) {
      found += 1;
      continue;
    }
    // A class (a four- or five-character ATC code) has no label of its own; the compiler drops it anyway.
    if (!(corpus.entities[qid].claims.atc ?? []).some((code) => code.length >= 7)) continue;
    const names = candidateNames(corpus.entities[qid], corpus.curated?.[qid] ?? null);
    if (names.length) todo.push({ qid, names });
    else writeJson(path.join(dir, `${qid}.json`), { qid, found: false, reason: 'no usable name', retrieved_at: new Date().toISOString() });
  }
  log(`dailymed: ${todo.length} drugs to look up, ${found} already cached`);

  let done = 0;
  const queue = [...todo];
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      while (queue.length) {
        const drug = queue.shift();
        try {
          const hit = await labelFor(drug.names);
          if (hit) {
            writeJson(path.join(dir, `${drug.qid}.json`), record(drug.qid, hit));
            found += 1;
          } else {
            writeJson(path.join(dir, `${drug.qid}.json`), { qid: drug.qid, found: false, via: 'dailymed', tried: drug.names.slice(0, 6), retrieved_at: new Date().toISOString() });
          }
        } catch (error) {
          log(`dailymed: ${drug.names[0]} — ${error.message}`);
        }
        done += 1;
        if (done % 50 === 0) log(`dailymed: ${done}/${todo.length} (${found} labels so far)`);
        await sleep(100);
      }
    }),
  );
  log(`dailymed: labels for ${found}/${corpus.selected.drug.length} drugs → .cache/medicine/openfda/`);
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exitCode = 1;
});
