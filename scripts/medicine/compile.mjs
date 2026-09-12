// Step 5 — the compiler: one entry per Wikidata item, its sources joined by
// the item's own codes, the English text laid out by section, every passage
// that came from a source quoted with its provenance, the links between
// entries collected from Wikidata and from the sources' own words, and the
// cross-check verdict.
//
//   node scripts/medicine/compile.mjs
//
// Output: .cache/medicine/compiled.json — {entries, links}, still without Hebrew.
import fs from 'node:fs';
import path from 'node:path';
import { cacheDir, firstSentences, log, readJson, slugOf, today, writeJson } from './lib.mjs';
import { crossCheck, mentions, statusFor } from './lib/cross-check.mjs';

const LICENCES = {
  wikidata: 'CC0 1.0',
  medlineplus: 'Public domain (US Government)',
  fda: 'CC0 1.0 (openFDA)',
  nhs: 'Open Government Licence v3.0',
  'wikipedia-he': 'CC BY-SA 4.0',
  'wikipedia-en': 'CC BY-SA 4.0',
};

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

/**
 * The English name an entry shows: the name the corpus asked for when it was
 * curated, otherwise Wikidata's label without a chemist's racemate prefix
 * ("rac-warfarin", "(RS)-metoprolol" — a clinic says warfarin, metoprolol).
 */
function displayName(record, curatedName) {
  if (curatedName) return curatedName;
  return String(record.labels.en ?? record.qid).replace(/^(rac|\(RS\)|\(±\)|\(\+\)|\(−\)|\(-\))-/, '');
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

/**
 * The MedlinePlus topic for an item: by MeSH id first, by name second. A
 * name match needs a real name — five letters or more and not an
 * abbreviation: "AD" is an alias of atopic dermatitis and the "also called"
 * of the Alzheimer topic, and that join put dementia under eczema.
 */
function medlineplusFor(record, topics) {
  const mesh = new Set(record.claims.mesh ?? []);
  const byMesh = topics.find((t) => t.mesh.some((m) => mesh.has(m.id)));
  if (byMesh) return { topic: byMesh, matched: 'mesh' };
  const usable = (n) => n && n.length >= 5 && n !== n.toUpperCase();
  const names = new Set([record.labels.en, ...record.aliases.en].filter(usable).map((n) => n.toLowerCase()));
  const byName = topics.find((t) => names.has(t.title.toLowerCase()) || t.also_called.some((a) => names.has(a.toLowerCase())));
  return byName ? { topic: byName, matched: 'name' } : null;
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
  const corpus = readJson(path.join(cacheDir, 'wikidata', 'corpus.json'));
  if (!corpus) throw new Error('run wikidata.mjs first');
  const topics = readJson(path.join(cacheDir, 'medlineplus', 'topics.json'))?.topics ?? [];
  const medlineplusRetrieved = readJson(path.join(cacheDir, 'medlineplus', 'topics.json'))?.retrieved_at ?? null;
  const nhsDir = path.join(cacheDir, 'nhs');
  const fdaDir = path.join(cacheDir, 'openfda');

  const kinds = corpus.selected;
  const all = [...kinds.condition.map((q) => [q, 'condition']), ...kinds.symptom.map((q) => [q, 'symptom']), ...kinds.drug.map((q) => [q, 'drug'])];
  const kindOf = Object.fromEntries(all);
  const records = corpus.entities;
  const curated = corpus.curated ?? {};
  const nameOf = (qid) => displayName(records[qid], curated[qid]);

  // Names the sources' prose is searched for, by kind.
  const namesOf = (qid) => dedupe([nameOf(qid), records[qid].labels.en, ...records[qid].aliases.en], 8);

  // Wikidata's relations read from the other end: the conditions that name a
  // drug as their treatment (P2176), the conditions that name a symptom (P780).
  const treatedBy = new Map();
  const symptomOf = new Map();
  for (const [qid, k] of all) {
    if (k !== 'condition') continue;
    for (const d of records[qid].claims.treated_by ?? []) treatedBy.set(d, [...(treatedBy.get(d) ?? []), qid]);
    for (const s of records[qid].claims.symptoms ?? []) symptomOf.set(s, [...(symptomOf.get(s) ?? []), qid]);
  }
  const byName = (kind) => {
    const map = new Map();
    for (const [qid, k] of all) if (k === kind) for (const name of namesOf(qid)) map.set(name, qid);
    return map;
  };
  const conditionNames = byName('condition');
  const symptomNames = byName('symptom');
  const drugNames = byName('drug');

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
      const hit = medlineplusFor(record, topics);
      if (hit) {
        const { topic, matched } = hit;
        sourcesUsed.push('medlineplus');
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

    // Where to read on, outside the corpus.
    if (record.sitelinks.he) sources.push({ source: 'wikipedia-he', url: `https://he.wikipedia.org/wiki/${encodeURIComponent(record.sitelinks.he.replace(/ /g, '_'))}`, title: record.sitelinks.he, licence: LICENCES['wikipedia-he'], retrieved_at: null, role: 'further_reading' });
    if (record.sitelinks.en) sources.push({ source: 'wikipedia-en', url: `https://en.wikipedia.org/wiki/${encodeURIComponent(record.sitelinks.en.replace(/ /g, '_'))}`, title: record.sitelinks.en, licence: LICENCES['wikipedia-en'], retrieved_at: null, role: 'further_reading' });

    const summaryEn = sectionsEn.overview
      ? firstSentences(sectionsEn.overview)
      : sectionsEn.what_for
        ? firstSentences(sectionsEn.what_for)
        : record.descriptions.en
          ? record.descriptions.en[0].toUpperCase() + record.descriptions.en.slice(1)
          : null;

    const check = crossCheck({ sources: sourcesUsed, evidence });
    const identifiers = {};
    for (const [key, values] of Object.entries(record.claims)) {
      if (['icd10', 'icd10cm', 'mesh', 'doid', 'atc', 'rxcui', 'medlineplus', 'nhs'].includes(key)) identifiers[key] = values[0];
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
      sections: { en: Object.keys(sectionsEn).length ? sectionsEn : null, he: null },
      quotes,
      sources,
      status: statusFor(check),
      cross_check: check,
      hebrew_meta: null,
      image: null,
      description_he: record.descriptions.he,
      image_file: record.claims.image?.[0] ?? null,
    });
  }

  const linkList = [...links.values()];
  writeJson(path.join(cacheDir, 'compiled.json'), { compiled_at: new Date().toISOString(), entries, links: linkList });
  const byStatus = entries.reduce((acc, e) => ((acc[e.status] = (acc[e.status] ?? 0) + 1), acc), {});
  log(`compile: ${entries.length} entries (${JSON.stringify(byStatus)}), ${linkList.length} links → .cache/medicine/compiled.json`);
}

main().catch((error) => {
  console.error(error.stack ?? error.message ?? error);
  process.exitCode = 1;
});
