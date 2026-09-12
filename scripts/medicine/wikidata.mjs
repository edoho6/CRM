// Step 1 — Wikidata (CC0): which entries the corpus has, and what Wikidata
// knows about each: names and aliases in Hebrew and English, the codes that
// join it to the other sources (ICD-10, MeSH, DOID, ATC, RxNorm, MedlinePlus,
// NHS), its symptoms, the drugs that treat it, its picture, its parents.
//
//   node scripts/medicine/wikidata.mjs --conditions=12 --symptoms=8 --drugs=12   (a sample)
//   node scripts/medicine/wikidata.mjs --curated=scripts/medicine/curated-sample.json  (named entries)
//   node scripts/medicine/wikidata.mjs --all                                     (everything with a Hebrew name)
//
// Selection: conditions are items with an ICD-10 code and a Hebrew label,
// most-linked first; symptoms are the ones those conditions name (P780),
// most often first, topped up from the items Wikidata calls symptoms; drugs
// are the ones those conditions name as treatment (P2176) plus the
// most-linked items with an ATC code. So even a small sample links to itself.
//
// Output: .cache/medicine/wikidata/corpus.json — {selected: {kind: [qid]}, entities: {qid: record}}.
import path from 'node:path';
import { args, cacheDir, cachedJson, fetchJson, log, readJson, sleep, writeJson } from './lib.mjs';

const SPARQL = 'https://query.wikidata.org/sparql';
const API = 'https://www.wikidata.org/w/api.php';
const wikidataDir = path.join(cacheDir, 'wikidata');

/** The claims the corpus reads, by property. */
const PROPS = {
  P31: 'instance_of',
  P279: 'subclass_of',
  P494: 'icd10',
  P4229: 'icd10cm',
  P486: 'mesh',
  P699: 'doid',
  P267: 'atc',
  P3345: 'rxcui',
  P604: 'medlineplus',
  P7995: 'nhs',
  P780: 'symptoms',
  P2176: 'treated_by',
  P2175: 'treats',
  P18: 'image',
  P1995: 'specialty',
  P1050: 'medical_condition',
};

const SYMPTOM_CLASSES = new Set(['Q169872', 'Q1441305']);

/**
 * A curated sample: English names resolved through Wikidata's search, keeping
 * the first candidate that is the kind it claims to be (an ICD-10 or MeSH code
 * for a condition, a symptom class for a symptom, an ATC code for a drug) and
 * has a Hebrew name. The "most linked" selection lands on pandemics and
 * politics; a clinic's shelf looks like this list instead.
 */
async function resolveCurated(kind, names, asked) {
  const out = [];
  for (const name of names) {
    const url = `${API}?action=wbsearchentities&search=${encodeURIComponent(name)}&language=en&type=item&limit=6&format=json`;
    const data = await cachedJson(path.join(wikidataDir, 'search', `${kind}-${name.replace(/[^a-z0-9]+/gi, '_')}.json`), url);
    const candidates = (data.search ?? []).map((hit) => hit.id);
    const found = await entities(candidates);
    const pick = candidates.find((qid) => {
      const r = found[qid];
      if (!r?.labels?.he) return false;
      const c = r.claims;
      if (kind === 'drug') return Boolean(c.atc);
      if (kind === 'symptom') return (c.instance_of ?? []).some((x) => SYMPTOM_CLASSES.has(x)) || Boolean(c.icd10 || c.mesh);
      return Boolean(c.icd10 || c.mesh || c.doid);
    });
    if (pick) {
      out.push(pick);
      asked[pick] = name;
    } else log(`wikidata: no ${kind} item found for "${name}"`);
    await sleep(300);
  }
  return out;
}

async function sparql(name, query) {
  const url = `${SPARQL}?format=json&query=${encodeURIComponent(query)}`;
  const data = await cachedJson(path.join(wikidataDir, `select-${name}.json`), url, {
    headers: { Accept: 'application/sparql-results+json' },
  });
  return data.results.bindings.map((row) => ({
    qid: row.item.value.replace(/^.*\//, ''),
    sitelinks: Number(row.sitelinks?.value ?? 0),
  }));
}

function selectionQuery(kind, limit, offset = 0) {
  const body =
    kind === 'condition'
      ? `?item wdt:P494 ?icd . ?item wikibase:sitelinks ?sitelinks .
         ?item rdfs:label ?he FILTER(LANG(?he) = "he") .
         FILTER NOT EXISTS { ?item wdt:P31 wd:Q169872 } FILTER NOT EXISTS { ?item wdt:P31 wd:Q1441305 }`
      : kind === 'symptom'
        ? `{ ?item wdt:P31 wd:Q169872 } UNION { ?item wdt:P31 wd:Q1441305 }
           ?item wikibase:sitelinks ?sitelinks .
           ?item rdfs:label ?he FILTER(LANG(?he) = "he") .`
        : `?item wdt:P267 ?atc . ?item wikibase:sitelinks ?sitelinks .
           ?item rdfs:label ?he FILTER(LANG(?he) = "he") .`;
  return `SELECT DISTINCT ?item ?sitelinks WHERE { ${body} } ORDER BY DESC(?sitelinks) LIMIT ${limit} OFFSET ${offset}`;
}

/** Everything of a kind with a Hebrew label, page by page. */
async function selectAll(kind) {
  const out = [];
  const page = 2000;
  for (let offset = 0; ; offset += page) {
    const rows = await sparql(`${kind}-all-${offset}`, selectionQuery(kind, page, offset));
    out.push(...rows);
    if (rows.length < page) break;
    await sleep(1500);
  }
  return out;
}

function claimValue(claim) {
  const value = claim?.mainsnak?.datavalue?.value;
  if (value === undefined) return null;
  if (typeof value === 'string') return value;
  if (value.id) return value.id;
  if (value.text) return value.text;
  return null;
}

function compact(entity) {
  const claims = {};
  for (const [prop, name] of Object.entries(PROPS)) {
    const values = (entity.claims?.[prop] ?? [])
      .filter((claim) => claim.rank !== 'deprecated')
      .map(claimValue)
      .filter(Boolean);
    if (values.length) claims[name] = [...new Set(values)];
  }
  const label = (lang) => entity.labels?.[lang]?.value ?? null;
  const aliases = (lang) => (entity.aliases?.[lang] ?? []).map((a) => a.value);
  return {
    qid: entity.id,
    labels: { he: label('he'), en: label('en') },
    descriptions: { he: entity.descriptions?.he?.value ?? null, en: entity.descriptions?.en?.value ?? null },
    aliases: { he: aliases('he'), en: aliases('en') },
    sitelinks: { he: entity.sitelinks?.hewiki?.title ?? null, en: entity.sitelinks?.enwiki?.title ?? null },
    claims,
  };
}

/** Full records for a list of items, from the cache or the API, fifty at a time. */
async function entities(qids) {
  const out = {};
  const missing = [];
  for (const qid of qids) {
    const cached = readJson(path.join(wikidataDir, 'entities', `${qid}.json`));
    if (cached) out[qid] = cached;
    else missing.push(qid);
  }
  for (let i = 0; i < missing.length; i += 50) {
    const batch = missing.slice(i, i + 50);
    const url = `${API}?action=wbgetentities&ids=${batch.join('|')}&props=labels|descriptions|aliases|claims|sitelinks&languages=he|en&sitefilter=hewiki|enwiki&format=json`;
    const data = await fetchJson(url);
    for (const [qid, entity] of Object.entries(data.entities ?? {})) {
      if (entity.missing !== undefined) continue;
      const record = compact(entity);
      writeJson(path.join(wikidataDir, 'entities', `${qid}.json`), record);
      out[qid] = record;
    }
    log(`wikidata: ${Math.min(i + 50, missing.length)}/${missing.length} entities read`);
    await sleep(700);
  }
  return out;
}

/** Symptoms and drugs the chosen conditions name, most-named first. */
function namedBy(conditions, records, key) {
  const counts = new Map();
  for (const qid of conditions) {
    for (const target of records[qid]?.claims?.[key] ?? []) counts.set(target, (counts.get(target) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([qid]) => qid);
}

async function main() {
  const options = args();
  const all = Boolean(options.all);
  const sizes = {
    condition: Number(options.conditions ?? 12),
    symptom: Number(options.symptoms ?? 8),
    drug: Number(options.drugs ?? 12),
  };

  if (options.curated) {
    const wanted = readJson(path.resolve(String(options.curated)));
    if (!wanted) throw new Error(`no curated list at ${options.curated}`);
    const curated = {};
    const selected = {
      condition: await resolveCurated('condition', wanted.condition ?? [], curated),
      symptom: await resolveCurated('symptom', wanted.symptom ?? [], curated),
      drug: await resolveCurated('drug', wanted.drug ?? [], curated),
    };
    const records = await entities([...selected.condition, ...selected.symptom, ...selected.drug]);
    const entitiesOut = {};
    for (const qid of [...selected.condition, ...selected.symptom, ...selected.drug]) entitiesOut[qid] = records[qid];
    writeJson(path.join(wikidataDir, 'corpus.json'), { generated_at: new Date().toISOString(), selected, curated, entities: entitiesOut });
    log(`wikidata: curated corpus of ${selected.condition.length} conditions, ${selected.symptom.length} symptoms, ${selected.drug.length} drugs → .cache/medicine/wikidata/corpus.json`);
    return;
  }

  const conditionRows = all ? await selectAll('condition') : await sparql(`condition-${sizes.condition}`, selectionQuery('condition', sizes.condition));
  const conditions = conditionRows.map((row) => row.qid);
  log(`wikidata: ${conditions.length} conditions selected`);
  const records = await entities(conditions);

  // Symptoms: what the conditions name, then Wikidata's own symptom items.
  const symptomPool = all ? (await selectAll('symptom')).map((r) => r.qid) : (await sparql(`symptom-${sizes.symptom}`, selectionQuery('symptom', sizes.symptom * 2))).map((r) => r.qid);
  const namedSymptoms = namedBy(conditions, records, 'symptoms');
  const symptomCandidates = [...new Set([...namedSymptoms, ...symptomPool])];
  Object.assign(records, await entities(symptomCandidates.filter((q) => !records[q])));
  const symptoms = symptomCandidates
    .filter((qid) => records[qid]?.labels?.he && (all || true))
    .filter((qid) => !conditions.includes(qid))
    .slice(0, all ? undefined : sizes.symptom);

  // Drugs: what the conditions name as treatment, then the most-linked ATC items.
  const drugPool = all ? (await selectAll('drug')).map((r) => r.qid) : (await sparql(`drug-${sizes.drug}`, selectionQuery('drug', sizes.drug * 2))).map((r) => r.qid);
  const namedDrugs = namedBy(conditions, records, 'treated_by');
  const drugCandidates = [...new Set([...namedDrugs, ...drugPool])];
  Object.assign(records, await entities(drugCandidates.filter((q) => !records[q])));
  const drugs = drugCandidates
    .filter((qid) => records[qid]?.labels?.he && records[qid]?.claims?.atc)
    .slice(0, all ? undefined : sizes.drug);

  // A condition that is really a symptom, by its own class, moves over.
  const selected = { condition: [], symptom: [...symptoms], drug: drugs };
  for (const qid of conditions) {
    const classes = records[qid]?.claims?.instance_of ?? [];
    if (classes.some((c) => SYMPTOM_CLASSES.has(c))) selected.symptom.push(qid);
    else selected.condition.push(qid);
  }

  const entitiesOut = {};
  for (const qid of [...selected.condition, ...selected.symptom, ...selected.drug]) entitiesOut[qid] = records[qid];
  writeJson(path.join(wikidataDir, 'corpus.json'), { generated_at: new Date().toISOString(), selected, entities: entitiesOut });
  log(`wikidata: corpus of ${selected.condition.length} conditions, ${selected.symptom.length} symptoms, ${selected.drug.length} drugs → .cache/medicine/wikidata/corpus.json`);
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exitCode = 1;
});
