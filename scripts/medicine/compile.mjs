// Step 5 — the compiler: one entry per Wikidata item, its sources joined by
// the item's own codes, the English text laid out by section, every passage
// that came from a source quoted with its provenance, the links between
// entries collected from Wikidata and from the sources' own words, and the
// cross-check verdict.
//
//   node scripts/medicine/compile.mjs [--keep-thin]
//
// An item that no text source describes — Wikidata alone knows its name —
// is left out of the corpus and listed in the report; a reference of empty
// shells is worse than a shorter one. --keep-thin keeps them.
// Output: .cache/medicine/compiled.json — {entries, links, dropped}, still without Hebrew.
import path from 'node:path';
import { args, cacheDir, firstSentences, log, readJson, slugOf, today, writeJson } from './lib.mjs';
import { cleanIcd } from './lib/icd.mjs';
import { crossCheck, mentions, statusFor } from './lib/cross-check.mjs';
import { cleanName } from './lib/drug-names.mjs';
import { foldArticle } from './lib/wiki-sections.mjs';

const LICENCES = {
  wikidata: 'CC0 1.0',
  medlineplus: 'Public domain (US Government)',
  genetics: 'Public domain (US Government)',
  fda: 'CC0 1.0 (openFDA)',
  nhs: 'Open Government Licence v3.0',
  loinc: 'LOINC, Regenstrief Institute — free with the licence acknowledged',
  'wikipedia-he': 'CC BY-SA 4.0',
  'wikipedia-en': 'CC BY-SA 4.0',
};

/**
 * Wikipedia is the last source consulted and the only one that is
 * share-alike: an entry whose text comes from it must say so and carry the
 * same licence. So it fills what the others left empty and never replaces
 * them, and a dose is never taken from it at all (lib/wiki-sections.mjs
 * drops a dosage heading) — doses come from the labels, word for word.
 */
const WIKIPEDIA_MIN_CHARS = 200;

/** A section of an entry keeps this much; the quote keeps more; the source keeps all. */
const SECTION_CHARS = 2500;

const NHS_HEADLINES = {
  condition: [
    ['symptoms', /symptom/i],
    ['causes', /cause|why it happens|what causes/i],
    ['diagnosis', /diagnos|tests?/i],
    ['treatment', /treat|medicine|therap|manag/i],
    ['urgent', /urgent|emergency|999|111|see a gp|get help|when to/i],
    ['self_care', /things you can do|self[- ]help|prevent|lifestyle|how to ease/i],
  ],
  symptom: [
    ['possible_causes', /cause|what could/i],
    ['urgent', /urgent|emergency|999|111|see a gp|get help|when to/i],
    ['self_care', /things you can do|self[- ]help|how to ease|treat/i],
  ],
  drug: [
    ['what_for', /about|what .* is for|why|uses/i],
    ['how_to_take', /how (and when )?to (take|use)|dosage|dose/i],
    ['side_effects', /side effect/i],
    ['who_cannot', /who can(not| not|'t)|cannot take|not suitable|pregnan/i],
    ['interactions', /other medicines|interact|food and drink|alcohol/i],
  ],
};

const FDA_SECTIONS = {
  what_for: ['indications_and_usage'],
  how_to_take: ['dosage_and_administration'],
  who_cannot: ['boxed_warning', 'contraindications', 'warnings_and_cautions', 'warnings'],
  side_effects: ['adverse_reactions'],
  interactions: ['drug_interactions'],
  pregnancy: ['pregnancy', 'use_in_specific_populations'],
};

const IDENTIFIER_KEYS = ['icd10', 'icd10cm', 'mesh', 'doid', 'atc', 'rxcui', 'unii', 'omim', 'orphanet', 'medlineplus', 'nhs'];

/**
 * ICD-10 chapters V to Y are external causes (a traffic collision, warfare,
 * violence) and Z is "factors influencing health status" (pregnancy,
 * homelessness): items with a code there are not conditions a clinic looks
 * up. Chapter R is "symptoms and signs" — an item filed there is a symptom,
 * whatever Wikidata's class says.
 */
const EXTERNAL_ICD = /^[VWXYZ]/i;
const SYMPTOM_ICD = /^R/i;

/**
 * Abstractions, not entries. "Disease" has a Wikidata item, an ICD code and
 * a Wikipedia article, and every text in the corpus mentions the word — it
 * collected 513 incoming links before this list existed. A clinic looks up
 * influenza, not "illness".
 */
const TOO_GENERAL = new Set([
  'disease', 'syndrome', 'illness', 'disorder', 'medical condition', 'medical sign', 'symptom', 'infection',
  'medication', 'drug', 'medicine', 'pharmaceutical drug', 'therapy', 'treatment', 'medical treatment', 'surgery',
  'injury', 'wound', 'inflammation', 'diagnosis', 'medical diagnosis', 'patient', 'health', 'disease causative agent',
]);

/**
 * Wikidata classes whose members are not conditions: an organism, a
 * discipline, a personality trait, a protein. An item there stays only if
 * a disease vocabulary filed it under a code — "rotavirus" is A08.0, the
 * infection; "Staphylococcus aureus" is a bacterium. Drugs are not filtered
 * this way: St John's wort is a taxon and a medicine.
 */
const NON_CLINICAL_CLASSES = new Set([
  'Q16521', // taxon
  'Q11862829', // academic discipline
  'Q1047113', // field of study
  'Q151885', // concept
  'Q2393196', // personality trait
  'Q2866472', // defence mechanism
  'Q31338769', // alternative medicine
  'Q2996394', // biological process
  'Q112826905', // class of anatomical entity
  'Q84467700', // group or class of proteins
  'Q67015883', // group or class of enzymes
  'Q3518464', // classification scheme (ICD-10 itself)
]);

/**
 * A drug is an item with a full, seven-character ATC code: a shorter code
 * names a class ("antipsychotics", N05A), not a substance. Group V is
 * contrast media, diagnostics, allergens and nutrients — antidotes (V03A)
 * are drugs — and Q is veterinary.
 */
function isDrugOfInterest(record) {
  return (record.claims.atc ?? []).some((code) => code.length >= 7 && !code.startsWith('Q') && (!code.startsWith('V') || code.startsWith('V03A')));
}

function displayName(record, kind, curatedName) {
  if (curatedName) return curatedName;
  const label = record.labels.en ?? record.qid;
  return kind === 'drug' ? cleanName(label) || label : label;
}

function clip(text) {
  const clean = String(text ?? '').trim();
  return clean.length > SECTION_CHARS ? `${clean.slice(0, SECTION_CHARS).trimEnd()} […]` : clean;
}

function uniqueSlug(base, taken, qid) {
  let slug = slugOf(base) || qid.toLowerCase();
  if (taken.has(slug)) slug = `${slug}-${qid.toLowerCase()}`;
  taken.add(slug);
  return slug;
}

function dedupe(list, limit = 12) {
  const seen = new Set();
  const out = [];
  for (const item of list) {
    const key = String(item ?? '').trim();
    if (!key || seen.has(key.toLowerCase())) continue;
    seen.add(key.toLowerCase());
    out.push(key);
    if (out.length >= limit) break;
  }
  return out;
}

function fdaDate(effectiveTime) {
  return effectiveTime && /^\d{8}$/.test(effectiveTime)
    ? `${effectiveTime.slice(0, 4)}-${effectiveTime.slice(4, 6)}-${effectiveTime.slice(6, 8)}`
    : null;
}

/** A name worth joining on: five letters or more and not an abbreviation ("AD" joined Alzheimer's to atopic dermatitis). */
const joinable = (n) => Boolean(n) && n.length >= 5 && n !== n.toUpperCase();

/**
 * A join by name, when no code joins. Two rules keep it honest. One side
 * must be a primary name — the item's label against the source's title or
 * one of its synonyms, or the source's title against one of the item's
 * aliases; an alias meeting a synonym is not a match (that put Sjögren's
 * text under "keratoconjunctivitis sicca" and fibromyalgia under
 * "myofascial pain"). And the source's title must not be the label of
 * another item in the corpus, whose text it then is.
 */
function byName(record, items, titleOf, synonymsOf, owners) {
  const label = record.labels.en && joinable(record.labels.en) ? record.labels.en.toLowerCase() : null;
  const aliases = new Set(record.aliases.en.filter(joinable).map((n) => n.toLowerCase()));
  for (const item of items) {
    const title = String(titleOf(item)).toLowerCase();
    const synonyms = synonymsOf(item).filter(joinable).map((s) => s.toLowerCase());
    const hit = (label && (title === label || synonyms.includes(label))) || aliases.has(title);
    if (!hit) continue;
    const owner = owners.get(title);
    if (owner && owner !== record.qid) continue;
    return item;
  }
  return null;
}

/** The MedlinePlus topic for an item: by MeSH id first, by name second. */
function medlineplusFor(record, topics, owners) {
  const mesh = new Set(record.claims.mesh ?? []);
  const byMesh = topics.find((t) => t.mesh.some((m) => mesh.has(m.id)));
  if (byMesh) return { topic: byMesh, matched: 'mesh', code: byMesh.mesh.find((m) => mesh.has(m.id)).id };
  const topic = byName(record, topics, (t) => t.title, (t) => t.also_called, owners);
  return topic ? { topic, matched: 'name', code: null } : null;
}

/**
 * The MedlinePlus Genetics condition for an item: by MeSH, OMIM or an
 * ICD-10-CM code, and only then by name or synonym.
 */
function geneticsFor(record, conditions, owners) {
  const mesh = new Set(record.claims.mesh ?? []);
  const omim = new Set(record.claims.omim ?? []);
  const icd = new Set([...(record.claims.icd10cm ?? []), ...(record.claims.icd10 ?? [])].map((c) => c.toUpperCase()));
  for (const c of conditions) {
    const m = c.mesh.find((id) => mesh.has(id));
    if (m) return { condition: c, matched: 'mesh', code: m };
    const o = c.omim.find((id) => omim.has(id));
    if (o) return { condition: c, matched: 'omim', code: o };
    const i = c.icd10cm.find((code) => icd.has(code.toUpperCase()));
    if (i) return { condition: c, matched: 'icd10cm', code: i };
  }
  const condition = byName(record, conditions, (c) => c.name, (c) => c.synonyms, owners);
  return condition ? { condition, matched: 'name', code: null } : null;
}

function nhsFor(qid, dir) {
  const link = readJson(path.join(dir, `by-qid-${qid}.json`));
  if (!link) return null;
  const page = readJson(path.join(dir, `${link.kind}-${link.slug}.json`));
  return page?.found ? page : null;
}

/** NHS parts folded into sections by their headlines. */
function nhsSections(kind, page) {
  const out = {};
  for (const part of page.parts) {
    const headline = part.headline ?? '';
    const hit = NHS_HEADLINES[kind].find(([, pattern]) => pattern.test(headline));
    const key = hit ? hit[0] : 'overview';
    out[key] = out[key] ? `${out[key]}\n\n${part.text}` : part.text;
  }
  return out;
}

async function main() {
  const options = args();
  const corpus = readJson(path.join(cacheDir, 'wikidata', 'corpus.json'));
  if (!corpus) throw new Error('run wikidata.mjs first');
  const medlineplusFile = readJson(path.join(cacheDir, 'medlineplus', 'topics.json'));
  const topics = medlineplusFile?.topics ?? [];
  const medlineplusRetrieved = medlineplusFile?.retrieved_at ?? null;
  const geneticsFile = readJson(path.join(cacheDir, 'genetics', 'conditions.json'));
  const genetics = geneticsFile?.conditions ?? [];
  const geneticsRetrieved = geneticsFile?.retrieved_at ?? null;
  const nhsDir = path.join(cacheDir, 'nhs');
  const fdaDir = path.join(cacheDir, 'openfda');
  const rxnormDir = path.join(cacheDir, 'rxnorm');
  const wikipediaDir = path.join(cacheDir, 'wikipedia');
  const israelDir = path.join(cacheDir, 'israel');
  const records = corpus.entities;
  const curated = corpus.curated ?? {};

  // What the corpus holds, by kind, after the rules above. An item that the
  // disease vocabularies and the ATC index both list (aspirin has a Disease
  // Ontology id) is a drug, once.
  const dropped = [];
  const all = [];
  const drugSet = new Set(corpus.selected.drug);
  const tooGeneral = (qid) => TOO_GENERAL.has(String(records[qid]?.labels?.en ?? '').toLowerCase());
  // ICD-10 first, ICD-10-CM when that is all the item has ("body piercing" and "screening" live in Z).
  const icdOf = (qid) => cleanIcd((records[qid]?.claims?.icd10 ?? [])[0] ?? (records[qid]?.claims?.icd10cm ?? [])[0] ?? '');
  const nonClinical = (qid) => (records[qid]?.claims?.instance_of ?? []).some((cls) => NON_CLINICAL_CLASSES.has(cls)) && !icdOf(qid);
  for (const qid of corpus.selected.condition) {
    if (drugSet.has(qid)) continue;
    if (tooGeneral(qid)) {
      dropped.push({ qid, kind: 'condition', name: records[qid].labels.en, reason: 'too general to be an entry' });
      continue;
    }
    if (nonClinical(qid)) {
      dropped.push({ qid, kind: 'condition', name: records[qid].labels.en, reason: 'not a clinical entity (an organism, a discipline, a trait)' });
      continue;
    }
    const code = icdOf(qid);
    if (EXTERNAL_ICD.test(code)) {
      dropped.push({ qid, kind: 'condition', name: records[qid].labels.en, reason: `ICD-10 chapter ${code[0].toUpperCase()}` });
      continue;
    }
    // The whole classification, A00 to Z99, is one item on Wikidata.
    if (/^A00-Z99$/i.test(code)) {
      dropped.push({ qid, kind: 'condition', name: records[qid].labels.en, reason: 'the classification itself, not a condition' });
      continue;
    }
    all.push([qid, SYMPTOM_ICD.test(code) ? 'symptom' : 'condition']);
  }
  for (const qid of corpus.selected.symptom) {
    if (drugSet.has(qid) || all.some(([q]) => q === qid)) continue;
    if (tooGeneral(qid)) {
      dropped.push({ qid, kind: 'symptom', name: records[qid].labels.en, reason: 'too general to be an entry' });
      continue;
    }
    if (nonClinical(qid)) {
      dropped.push({ qid, kind: 'symptom', name: records[qid].labels.en, reason: 'not a clinical entity (an organism, a discipline, a trait)' });
      continue;
    }
    all.push([qid, 'symptom']);
  }
  for (const qid of corpus.selected.drug) {
    if (tooGeneral(qid)) {
      dropped.push({ qid, kind: 'drug', name: records[qid].labels.en, reason: 'too general to be an entry' });
      continue;
    }
    if (!isDrugOfInterest(records[qid])) {
      const codes = records[qid].claims.atc ?? [];
      dropped.push({ qid, kind: 'drug', name: records[qid].labels.en, reason: codes.every((c) => c.length < 7) ? 'a drug class, not a substance (ATC)' : 'ATC group V or Q only' });
      continue;
    }
    all.push([qid, 'drug']);
  }
  const kindOf = Object.fromEntries(all);
  const nameOf = (qid) => displayName(records[qid], kindOf[qid], curated[qid]);

  // Whose name a source's title is: the item labelled with it, else the
  // first item that lists it as an alias. A name join to any other item is refused.
  const owners = new Map();
  for (const [qid] of all) for (const alias of records[qid].aliases.en ?? []) if (joinable(alias) && !owners.has(alias.toLowerCase())) owners.set(alias.toLowerCase(), qid);
  for (const [qid] of all) if (records[qid].labels.en) owners.set(records[qid].labels.en.toLowerCase(), qid);

  // Names the sources' prose is searched for, by kind.
  const namesOf = (qid) => dedupe([nameOf(qid), records[qid].labels.en, ...records[qid].aliases.en], 8).filter((n) => n.length >= 4);
  const byName = (kind) => {
    const map = new Map();
    for (const [qid, k] of all) if (k === kind) for (const name of namesOf(qid)) if (!map.has(name)) map.set(name, qid);
    return map;
  };
  const conditionNames = byName('condition');
  const symptomNames = byName('symptom');
  const drugNames = byName('drug');

  // The same maps in Hebrew, for the Hebrew Wikipedia text: its prose names
  // סוכרת and שיעול, not diabetes and cough.
  const namesHeOf = (qid) => dedupe([records[qid].labels.he, ...(records[qid].aliases.he ?? [])], 8).filter((n) => n && n.length >= 3);
  const byNameHe = (kind) => {
    const map = new Map();
    for (const [qid, k] of all) if (k === kind) for (const name of namesHeOf(qid)) if (!map.has(name)) map.set(name, qid);
    return map;
  };
  const conditionNamesHe = byNameHe('condition');
  const symptomNamesHe = byNameHe('symptom');
  const drugNamesHe = byNameHe('drug');

  // Wikidata's relations read from the other end: the conditions that name a
  // drug as their treatment (P2176), the conditions that name a symptom (P780).
  const treatedBy = new Map();
  const symptomOf = new Map();
  for (const [qid, k] of all) {
    if (k !== 'condition') continue;
    for (const d of records[qid].claims.treated_by ?? []) treatedBy.set(d, [...(treatedBy.get(d) ?? []), qid]);
    for (const s of records[qid].claims.symptoms ?? []) symptomOf.set(s, [...(symptomOf.get(s) ?? []), qid]);
  }

  const taken = new Set();
  const entries = [];
  const links = new Map();
  const addLink = (from, to, relation, source) => {
    if (!from || !to || from === to || !kindOf[from] || !kindOf[to]) return;
    const key = `${from}|${to}|${relation}`;
    if (!links.has(key)) links.set(key, { from, to, relation, source });
  };

  for (const [qid, kind] of all) {
    const record = records[qid];
    const nameEn = nameOf(qid);
    const sources = [];
    const quotes = [];
    const sectionsEn = {};
    const evidence = {};
    const sourcesUsed = ['wikidata'];
    /** What is registered in Israel for this substance; drugs only. */
    let israel = null;
    const identity = {};
    const claimIdentity = (source, key) => {
      (identity[source] ??= []).push(key);
    };
    for (const key of ['mesh', 'omim', 'rxcui', 'unii', 'icd10cm']) for (const value of record.claims[key] ?? []) claimIdentity('wikidata', `${key}:${value}`);

    sources.push({
      source: 'wikidata',
      url: `https://www.wikidata.org/wiki/${qid}`,
      title: nameEn,
      licence: LICENCES.wikidata,
      retrieved_at: corpus.generated_at?.slice(0, 10) ?? today(),
      role: 'basis',
    });

    // Wikidata's own claims are one source of links.
    for (const s of record.claims.symptoms ?? []) addLink(s, qid, 'symptom_of', 'wikidata:P780');
    for (const d of record.claims.treated_by ?? []) addLink(d, qid, 'treats', 'wikidata:P2176');
    for (const c of record.claims.treats ?? []) addLink(qid, c, 'treats', 'wikidata:P2175');
    for (const p of record.claims.subclass_of ?? []) addLink(qid, p, 'class', 'wikidata:P279');

    if (kind !== 'drug') {
      const hit = medlineplusFor(record, topics, owners);
      if (hit) {
        const { topic, matched, code } = hit;
        sourcesUsed.push('medlineplus');
        if (code) claimIdentity('medlineplus', `mesh:${code}`);
        sources.push({ source: 'medlineplus', url: topic.url, title: topic.title, licence: LICENCES.medlineplus, retrieved_at: medlineplusRetrieved?.slice(0, 10) ?? today(), role: 'basis', matched });
        if (topic.summary_text) {
          sectionsEn.overview = clip(topic.summary_text);
          quotes.push({ source: 'medlineplus', field: 'overview', text: topic.summary_text, url: topic.url, source_reviewed_at: null, retrieved_at: today(), licence: LICENCES.medlineplus });
          const namedSymptoms = mentions(topic.summary_text, [...symptomNames.keys()]);
          const namedDrugs = mentions(topic.summary_text, [...drugNames.keys()]);
          const namedConditions = mentions(topic.summary_text, [...conditionNames.keys()]);
          if (kind === 'condition') {
            (evidence.symptom ??= {}).medlineplus = namedSymptoms;
            (evidence.treats ??= {}).medlineplus = namedDrugs;
            for (const name of namedSymptoms) addLink(symptomNames.get(name), qid, 'symptom_of', 'medlineplus:text');
            for (const name of namedDrugs) addLink(drugNames.get(name), qid, 'treats', 'medlineplus:text');
          } else {
            (evidence.symptom_of ??= {}).medlineplus = namedConditions;
            for (const name of namedConditions) addLink(qid, conditionNames.get(name), 'symptom_of', 'medlineplus:text');
          }
        }
      }
      if (kind === 'condition') {
        const gen = geneticsFor(record, genetics, owners);
        if (gen) {
          const { condition, matched, code } = gen;
          sourcesUsed.push('genetics');
          if (code) claimIdentity('genetics', `${matched}:${code}`);
          sources.push({ source: 'genetics', url: condition.url, title: condition.name, licence: LICENCES.genetics, retrieved_at: geneticsRetrieved?.slice(0, 10) ?? today(), role: 'basis', matched });
          if (condition.description_text) {
            // MedlinePlus's own summary leads where both exist; the genetics description follows it.
            sectionsEn.overview = sectionsEn.overview ? `${sectionsEn.overview}\n\n${clip(condition.description_text)}` : clip(condition.description_text);
            quotes.push({ source: 'genetics', field: 'overview', text: condition.description_text, url: condition.url, source_reviewed_at: condition.reviewed ?? null, retrieved_at: today(), licence: LICENCES.genetics });
            const namedSymptoms = mentions(condition.description_text, [...symptomNames.keys()]);
            (evidence.symptom ??= {}).genetics = namedSymptoms;
            for (const name of namedSymptoms) addLink(symptomNames.get(name), qid, 'symptom_of', 'genetics:text');
          }
          const causes = [];
          if (condition.inheritance.length) causes.push(`Inheritance pattern: ${condition.inheritance.join('; ')}.`);
          if (condition.genes.length) causes.push(`Related genes: ${condition.genes.join(', ')}.`);
          if (causes.length && !sectionsEn.causes) sectionsEn.causes = causes.join(' ');
        }
        const symptomLabels = (record.claims.symptoms ?? []).map((s) => (kindOf[s] ? nameOf(s) : records[s]?.labels?.en)).filter(Boolean);
        if (symptomLabels.length) (evidence.symptom ??= {}).wikidata = symptomLabels;
        const drugLabels = (record.claims.treated_by ?? []).map((d) => (kindOf[d] ? nameOf(d) : records[d]?.labels?.en)).filter(Boolean);
        if (drugLabels.length) (evidence.treats ??= {}).wikidata = drugLabels;
      } else {
        const conditionLabels = (symptomOf.get(qid) ?? []).map(nameOf);
        if (conditionLabels.length) (evidence.symptom_of ??= {}).wikidata = conditionLabels;
      }
    } else {
      const label = readJson(path.join(fdaDir, `${qid}.json`));
      if (label?.found) {
        sourcesUsed.push('fda');
        for (const u of label.unii ?? []) claimIdentity('fda', `unii:${u}`);
        const reviewed = fdaDate(label.effective_time);
        sources.push({ source: 'fda', url: label.url, title: `${label.brand_name ?? label.generic_name ?? nameEn} — FDA label`, licence: LICENCES.fda, retrieved_at: label.retrieved_at?.slice(0, 10) ?? today(), role: 'basis' });
        for (const [section, keys] of Object.entries(FDA_SECTIONS)) {
          const text = keys.map((k) => label.sections[k]).filter(Boolean).join('\n\n');
          if (!text) continue;
          sectionsEn[section] = clip(text);
          quotes.push({ source: 'fda', field: section, text, url: label.url, source_reviewed_at: reviewed, retrieved_at: label.retrieved_at?.slice(0, 10) ?? today(), licence: LICENCES.fda });
        }
        const indicated = mentions(label.sections.indications_and_usage ?? '', [...conditionNames.keys()]);
        (evidence.treats ??= {}).fda = indicated;
        for (const name of indicated) addLink(qid, conditionNames.get(name), 'treats', 'fda:indications');
        const adverse = mentions(label.sections.adverse_reactions ?? '', [...symptomNames.keys()]);
        (evidence.side_effect ??= {}).fda = adverse;
        for (const name of adverse) addLink(qid, symptomNames.get(name), 'side_effect', 'fda:adverse_reactions');
      }
      const rx = readJson(path.join(rxnormDir, `${qid}.json`));
      if (rx?.found) {
        sourcesUsed.push('rxnorm');
        claimIdentity('rxnorm', `rxcui:${rx.rxcui}`);
      }
      const registry = readJson(path.join(israelDir, `${qid}.json`));
      if (registry?.found && registry.products?.length) {
        israel = {
          products: registry.products,
          leaflet: registry.leaflet ?? null,
          registration_holder: registry.registration_holder ?? null,
          retrieved_at: registry.retrieved_at?.slice(0, 10) ?? today(),
        };
        // The registry's ATC for the same name is a third opinion on identity.
        if (registry.atc) claimIdentity('israel', `atc:${registry.atc}`);
        sources.push({
          source: 'israel',
          url: 'https://israeldrugs.health.gov.il/',
          title: 'מאגר התרופות של משרד הבריאות',
          licence: 'Facts and links only',
          retrieved_at: israel.retrieved_at,
          role: 'further_reading',
        });
      }
      const treatsLabels = dedupe([
        ...(record.claims.treats ?? []).map((c) => (kindOf[c] ? nameOf(c) : records[c]?.labels?.en)),
        ...(treatedBy.get(qid) ?? []).map(nameOf),
      ], 40);
      if (treatsLabels.length) (evidence.treats ??= {}).wikidata = treatsLabels;
    }

    const nhs = nhsFor(qid, nhsDir);
    if (nhs) {
      sourcesUsed.push('nhs');
      sources.push({ source: 'nhs', url: nhs.url, title: nhs.name, licence: LICENCES.nhs, retrieved_at: nhs.retrieved_at?.slice(0, 10) ?? today(), role: 'basis' });
      const folded = nhsSections(kind, nhs);
      for (const [section, text] of Object.entries(folded)) {
        // The NHS text leads where both sources have the section: it is written for the person, not the prescriber.
        sectionsEn[section] = clip(text);
        quotes.push({ source: 'nhs', field: section, text, url: nhs.url, source_reviewed_at: nhs.last_reviewed ?? null, retrieved_at: nhs.retrieved_at?.slice(0, 10) ?? today(), licence: LICENCES.nhs });
      }
      const whole = Object.values(folded).join('\n');
      if (kind === 'condition') {
        const s = mentions(folded.symptoms ?? whole, [...symptomNames.keys()]);
        const d = mentions(folded.treatment ?? '', [...drugNames.keys()]);
        (evidence.symptom ??= {}).nhs = s;
        (evidence.treats ??= {}).nhs = d;
        for (const name of s) addLink(symptomNames.get(name), qid, 'symptom_of', 'nhs:symptoms');
        for (const name of d) addLink(drugNames.get(name), qid, 'treats', 'nhs:treatment');
      } else if (kind === 'drug') {
        const c = mentions(folded.what_for ?? '', [...conditionNames.keys()]);
        const s = mentions(folded.side_effects ?? '', [...symptomNames.keys()]);
        (evidence.treats ??= {}).nhs = c;
        (evidence.side_effect ??= {}).nhs = s;
        for (const name of c) addLink(qid, conditionNames.get(name), 'treats', 'nhs:what_for');
        for (const name of s) addLink(qid, symptomNames.get(name), 'side_effect', 'nhs:side_effects');
      }
    }

    // English Wikipedia fills the sections the other sources left empty, and
    // becomes a basis only for what it actually contributed.
    const enArticle = readJson(path.join(wikipediaDir, 'en', `${qid}.json`));
    if (enArticle && !enArticle.error && enArticle.text?.length >= WIKIPEDIA_MIN_CHARS) {
      const folded = foldArticle(kind, enArticle.text, SECTION_CHARS);
      const filled = [];
      for (const [section, text] of Object.entries(folded.sections)) {
        if (sectionsEn[section] || text.length < 80) continue;
        sectionsEn[section] = text;
        filled.push(section);
        quotes.push({ source: 'wikipedia-en', lang: 'en', field: section, text, url: enArticle.url, source_reviewed_at: enArticle.timestamp?.slice(0, 10) ?? null, retrieved_at: enArticle.retrieved_at?.slice(0, 10) ?? today(), licence: LICENCES['wikipedia-en'] });
      }
      sources.push({ source: 'wikipedia-en', url: enArticle.url, title: enArticle.title, licence: LICENCES['wikipedia-en'], retrieved_at: enArticle.retrieved_at?.slice(0, 10) ?? null, role: filled.length ? 'basis' : 'further_reading', revision: enArticle.revid ?? null });
      if (filled.length) sourcesUsed.push('wikipedia-en');
    } else if (record.sitelinks.en) {
      sources.push({ source: 'wikipedia-en', url: `https://en.wikipedia.org/wiki/${encodeURIComponent(record.sitelinks.en.replace(/ /g, '_'))}`, title: record.sitelinks.en, licence: LICENCES['wikipedia-en'], retrieved_at: null, role: 'further_reading' });
    }

    // The Hebrew article is the only source that is already in Hebrew. It is
    // kept apart (build.mjs uses it only where no better Hebrew exists) and
    // the entry that rests on it says so and carries its licence.
    let wikipediaHe = null;
    const heArticle = readJson(path.join(wikipediaDir, 'he', `${qid}.json`));
    if (heArticle && !heArticle.error && heArticle.text?.length >= WIKIPEDIA_MIN_CHARS) {
      const folded = foldArticle(kind, heArticle.text, SECTION_CHARS);
      const sectionsHe = Object.fromEntries(Object.entries(folded.sections).filter(([, text]) => text.length >= 80));
      if (Object.keys(sectionsHe).length) {
        wikipediaHe = {
          sections: sectionsHe,
          title: heArticle.title,
          url: heArticle.url,
          revision: heArticle.revid ?? null,
          revised_at: heArticle.timestamp ?? null,
          retrieved_at: heArticle.retrieved_at ?? null,
          licence: LICENCES['wikipedia-he'],
        };
        sourcesUsed.push('wikipedia-he');
        for (const [section, text] of Object.entries(sectionsHe)) {
          quotes.push({ source: 'wikipedia-he', lang: 'he', field: section, text, url: heArticle.url, source_reviewed_at: heArticle.timestamp?.slice(0, 10) ?? null, retrieved_at: heArticle.retrieved_at?.slice(0, 10) ?? today(), licence: LICENCES['wikipedia-he'] });
        }
        // Its prose is read for links the same way the English sources are.
        const whole = Object.values(sectionsHe).join('\n');
        if (kind === 'condition') {
          const s = mentions(sectionsHe.symptoms ?? whole, [...symptomNamesHe.keys()]);
          const d = mentions(sectionsHe.treatment ?? '', [...drugNamesHe.keys()]);
          if (s.length) (evidence.symptom ??= {})['wikipedia-he'] = s.map((n) => nameOf(symptomNamesHe.get(n)));
          if (d.length) (evidence.treats ??= {})['wikipedia-he'] = d.map((n) => nameOf(drugNamesHe.get(n)));
          for (const name of s) addLink(symptomNamesHe.get(name), qid, 'symptom_of', 'wikipedia-he:text');
          for (const name of d) addLink(drugNamesHe.get(name), qid, 'treats', 'wikipedia-he:text');
        } else if (kind === 'drug') {
          const c = mentions(sectionsHe.what_for ?? whole, [...conditionNamesHe.keys()]);
          const s = mentions(sectionsHe.side_effects ?? '', [...symptomNamesHe.keys()]);
          if (c.length) (evidence.treats ??= {})['wikipedia-he'] = c.map((n) => nameOf(conditionNamesHe.get(n)));
          if (s.length) (evidence.side_effect ??= {})['wikipedia-he'] = s.map((n) => nameOf(symptomNamesHe.get(n)));
          for (const name of c) addLink(qid, conditionNamesHe.get(name), 'treats', 'wikipedia-he:what_for');
          for (const name of s) addLink(qid, symptomNamesHe.get(name), 'side_effect', 'wikipedia-he:side_effects');
        } else {
          const c = mentions(sectionsHe.possible_causes ?? whole, [...conditionNamesHe.keys()]);
          if (c.length) (evidence.symptom_of ??= {})['wikipedia-he'] = c.map((n) => nameOf(conditionNamesHe.get(n)));
          for (const name of c) addLink(qid, conditionNamesHe.get(name), 'symptom_of', 'wikipedia-he:text');
        }
      }
      sources.push({ source: 'wikipedia-he', url: heArticle.url, title: heArticle.title, licence: LICENCES['wikipedia-he'], retrieved_at: heArticle.retrieved_at?.slice(0, 10) ?? null, role: wikipediaHe ? 'basis' : 'further_reading', revision: heArticle.revid ?? null });
    } else if (record.sitelinks.he) {
      sources.push({ source: 'wikipedia-he', url: `https://he.wikipedia.org/wiki/${encodeURIComponent(record.sitelinks.he.replace(/ /g, '_'))}`, title: record.sitelinks.he, licence: LICENCES['wikipedia-he'], retrieved_at: null, role: 'further_reading' });
    }

    // Thin: nothing describes it in either language. Out, unless asked to keep.
    const hasText = Object.keys(sectionsEn).length > 0 || Boolean(wikipediaHe);
    if (!hasText && !options['keep-thin']) {
      dropped.push({ qid, kind, name: nameEn, reason: 'no text source' });
      continue;
    }

    const summaryEn = sectionsEn.overview
      ? firstSentences(sectionsEn.overview)
      : sectionsEn.what_for
        ? firstSentences(sectionsEn.what_for)
        : record.descriptions.en
          ? record.descriptions.en[0].toUpperCase() + record.descriptions.en.slice(1)
          : null;

    // The identity of the entry checked across sources: a MeSH id that
    // Wikidata and MedlinePlus both file it under, an RxCUI that Wikidata and
    // RxNorm both give the name, a UNII the label and Wikidata share.
    if (Object.keys(identity).length > 1) evidence.identity = identity;
    const check = crossCheck({ sources: sourcesUsed, evidence });
    const identityAgreements = check.agree.filter((a) => a.startsWith('identity:'));
    check.identity_confirmed = identityAgreements.length > 0;
    check.identity = identityAgreements.map((a) => a.slice('identity:'.length));
    // The verdict is about the facts, not the codes: an identity agreement
    // alone does not make an entry cross-checked.
    const contentCheck = { ...check, agree: check.agree.filter((a) => !a.startsWith('identity:')) };

    const identifiers = {};
    for (const [key, values] of Object.entries(record.claims)) {
      if (IDENTIFIER_KEYS.includes(key)) identifiers[key] = key === 'icd10' ? cleanIcd(values[0]) : values[0];
    }

    entries.push({
      wikidata_id: qid,
      kind,
      slug: uniqueSlug(nameEn, taken, qid),
      name_en: nameEn,
      name_he: record.labels.he,
      aliases_en: dedupe([record.labels.en, ...record.aliases.en].filter((n) => n && n !== nameEn)),
      aliases_he: dedupe(record.aliases.he),
      identifiers,
      summary_en: summaryEn,
      summary_he: null,
      sections: { en: hasText ? sectionsEn : null, he: null },
      quotes,
      sources,
      status: statusFor(contentCheck),
      cross_check: check,
      hebrew_meta: null,
      image: null,
      israel,
      description_he: record.descriptions.he,
      image_file: record.claims.image?.[0] ?? null,
      wikipedia_he: wikipediaHe,
    });
  }

  // The lab tests are a corpus of their own: MedlinePlus explains the test,
  // LOINC names the code it is ordered under, and MedlinePlus Connect is
  // what joins the two — so a test whose code Connect confirms has its
  // identity agreed by two sources, exactly like a drug's RxCUI.
  const labFile = readJson(path.join(cacheDir, 'labtests', 'tests.json'));
  for (const test of labFile?.tests ?? []) {
    const sectionsEn = Object.fromEntries(Object.entries(test.sections).map(([key, text]) => [key, clip(text)]));
    if (!Object.keys(sectionsEn).length) continue;
    const slug = uniqueSlug(test.slug, taken, test.slug);
    // A lab test has no Wikidata item, so its slug is what a link points at.
    kindOf[slug] = 'lab_test';
    const codes = test.loinc ?? [];
    const quotes = Object.entries(sectionsEn).map(([field, text]) => ({
      source: 'medlineplus',
      lang: 'en',
      field,
      text,
      url: test.url,
      source_reviewed_at: null,
      retrieved_at: test.retrieved_at?.slice(0, 10) ?? today(),
      licence: LICENCES.medlineplus,
    }));
    const sources = [
      { source: 'medlineplus', url: test.url, title: test.title, licence: LICENCES.medlineplus, retrieved_at: test.retrieved_at?.slice(0, 10) ?? today(), role: 'basis' },
    ];
    const evidence = {};
    if (codes.length) {
      sources.push({
        source: 'loinc',
        url: `https://loinc.org/${codes[0].code}`,
        title: codes[0].long_name,
        licence: LICENCES.loinc,
        retrieved_at: labFile.retrieved_at?.slice(0, 10) ?? today(),
        role: 'basis',
      });
      evidence.identity = { loinc: codes.map((c) => `loinc:${c.code}`), medlineplus: codes.map((c) => `loinc:${c.code}`) };
    }

    // What the test is for, read for the conditions it names.
    const prose = [sectionsEn.what_for, sectionsEn.results].filter(Boolean).join('\n');
    const named = mentions(prose, [...conditionNames.keys()]);
    for (const name of named) addLink(slug, conditionNames.get(name), 'diagnoses', 'medlineplus:what_for');

    const check = crossCheck({ sources: codes.length ? ['medlineplus', 'loinc'] : ['medlineplus'], evidence });
    const identityAgreements = check.agree.filter((a) => a.startsWith('identity:'));
    check.identity_confirmed = identityAgreements.length > 0;
    check.identity = identityAgreements.map((a) => a.slice('identity:'.length));

    entries.push({
      wikidata_id: null,
      kind: 'lab_test',
      slug,
      name_en: test.title,
      name_he: null,
      aliases_en: dedupe(codes.map((c) => c.consumer_name).filter(Boolean)),
      aliases_he: [],
      identifiers: codes.length ? { loinc: codes[0].code } : {},
      summary_en: sectionsEn.overview ? firstSentences(sectionsEn.overview) : null,
      summary_he: null,
      sections: { en: sectionsEn, he: null },
      quotes,
      sources,
      // A test is not a claim about the world, so there is nothing to agree
      // on beyond its identity; it stays a draft until a person approves it.
      status: 'draft',
      cross_check: check,
      hebrew_meta: null,
      image: null,
      israel: null,
      description_he: null,
      image_file: null,
      wikipedia_he: null,
    });
  }

  // Links only between entries that made it into the corpus.
  const kept = new Set(entries.map((e) => e.wikidata_id ?? e.slug));
  const linkList = [...links.values()].filter((l) => kept.has(l.from) && kept.has(l.to));
  writeJson(path.join(cacheDir, 'compiled.json'), { compiled_at: new Date().toISOString(), entries, links: linkList, dropped });
  const byStatus = entries.reduce((acc, e) => ((acc[e.status] = (acc[e.status] ?? 0) + 1), acc), {});
  const byKind = entries.reduce((acc, e) => ((acc[e.kind] = (acc[e.kind] ?? 0) + 1), acc), {});
  const confirmed = entries.filter((e) => e.cross_check.identity_confirmed).length;
  const hebrew = entries.filter((e) => e.wikipedia_he).length;
  log(`compile: ${entries.length} entries ${JSON.stringify(byKind)} (${JSON.stringify(byStatus)}, identity confirmed for ${confirmed}, ${hebrew} with Hebrew Wikipedia text), ${linkList.length} links, ${dropped.length} dropped → .cache/medicine/compiled.json`);
}

main().catch((error) => {
  console.error(error.stack ?? error.message ?? error);
  process.exitCode = 1;
});
