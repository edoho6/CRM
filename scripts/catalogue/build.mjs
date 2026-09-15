#!/usr/bin/env node
// The dataset the import reads, and the report to read before importing.
//
//   node scripts/catalogue/build.mjs [--fields-only] [--scope=core|all]
//
// Joins each fact sheet (.cache/catalogue/facts) with the text written for
// it (.cache/catalogue/text) into test-results/catalogue/dataset.json —
// entries shaped for catalogue_import (migration 57) — and writes
// test-results/catalogue/report.md.
//
// --fields-only leaves every clinical text field out of the entry, so the
// import carries only what the readers found without a model: the category,
// the nature, the taste, the channels, the dose, the Hebrew name, and a
// formula's ingredients with their doses. The import changes a text field
// only when the entry carries its key, so this never touches the text a
// catalogue entry already has. It costs nothing to produce.
//
// --scope=core (the default) keeps the entries the catalogue already holds
// and the ones the Israeli supplier carries. --scope=all adds everything
// American Dragon has, which is fifteen hundred more formulas and four
// hundred more herbs: a much larger catalogue, not a better one by default.
import fs from 'node:fs';
import path from 'node:path';
import {
  args,
  datasetFile,
  ensureDir,
  factsDir,
  log,
  readJson,
  reportDir,
  root,
  textDir,
} from './lib.mjs';
import { normalizePinyin } from '../../supabase/functions/_shared/catalogue/map.ts';

const options = args();
const fieldsOnly = Boolean(options['fields-only']);
const scope = String(options.scope ?? 'core');
if (!['core', 'all'].includes(scope)) {
  log(`build: unknown --scope=${scope} (core or all)`);
  process.exit(1);
}

const report = [];
const line = (text = '') => report.push(text);

function sourceLabel(sheet) {
  return `facts:${sheet.sources.map((source) => source.name).join('+')}`;
}

function sourceRefs(sheet) {
  return sheet.sources.map((source) => ({
    name: source.name,
    url: source.url,
    title: source.title ?? null,
  }));
}

/** The pinyin the bundled seed already holds, so "core" can mean "what we have plus what Bara carries". */
function seedKeys(folder, fn) {
  const dir = path.join(root, 'supabase', 'seed', folder);
  if (!fs.existsSync(dir)) return new Set();
  const keys = new Set();
  for (const file of fs.readdirSync(dir)) {
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    for (const match of sql.matchAll(new RegExp(`${fn}\\('([^']+)'`, 'g')))
      keys.add(normalizePinyin(match[1]));
  }
  return keys;
}

/** A short dose note from the other doses a sheet carries (tincture, exceptional cases), in both languages. */
function doseNotes(sheet) {
  const tincture = (sheet.otherDoses ?? []).find((dose) => dose.unit === 'ml');
  if (!tincture || tincture.min === null || tincture.max === null) return { he: '', en: '' };
  const range =
    tincture.min === tincture.max ? `${tincture.min}` : `${tincture.min}–${tincture.max}`;
  return { he: `טינקטורה: ${range} מ״ל`, en: `Tincture: ${range} ml` };
}

function herbEntry(sheet, text) {
  const entry = {
    pinyin: sheet.pinyin,
    chinese: sheet.chinese,
    botanical: sheet.botanical,
    pharmaceutical: sheet.pharmaceutical,
    english: sheet.english,
    hebrew: sheet.hebrew,
    tcm_category: sheet.category,
    temperature: sheet.temperature,
    tastes: sheet.tastes,
    channels: sheet.channels,
    dose_min: sheet.dose?.min ?? null,
    dose_max: sheet.dose?.max ?? null,
    sources: sourceRefs(sheet),
    source: sourceLabel(sheet),
  };
  if (!text) return entry;
  const notes = doseNotes(sheet);
  return {
    ...entry,
    actions: text.he.functions,
    indications: text.he.indications,
    cautions: text.he.cautions,
    dosage_notes: notes.he,
    text_en: {
      functions: text.en.functions,
      indications: text.en.indications,
      cautions: text.en.cautions,
      dosage_notes: notes.en,
    },
  };
}

function formulaEntry(sheet, text) {
  const entry = {
    pinyin: sheet.pinyin,
    chinese: sheet.chinese,
    english: sheet.english,
    tcm_category: sheet.category,
    source_text: sheet.classicalSource,
    items: sheet.ingredients.map((item) => ({
      h: item.pinyin,
      d: item.doseMin ?? item.doseMax ?? null,
      n:
        [
          item.note,
          item.doseMin !== null && item.doseMax !== null && item.doseMin !== item.doseMax
            ? `${item.doseMin}–${item.doseMax} g`
            : null,
        ]
          .filter(Boolean)
          .join('; ') || null,
    })),
    sources: sourceRefs(sheet),
    source: sourceLabel(sheet),
  };
  if (!text) return entry;
  return {
    ...entry,
    actions: text.he.actions,
    indications: text.he.indications,
    contraindications: text.he.contraindications,
    text_en: {
      actions: text.en.actions,
      indications: text.en.indications,
      contraindications: text.en.contraindications,
    },
  };
}

function pointEntry(sheet, text) {
  const entry = {
    code: sheet.code,
    pinyin: sheet.pinyin,
    english: sheet.english,
    sources: sourceRefs(sheet),
    source: sourceLabel(sheet),
  };
  if (!text) return entry;
  return {
    ...entry,
    location: text.he.location,
    actions: text.he.actions,
    indications: text.he.indications,
    needling: text.he.needling,
    cautions: text.he.cautions,
    text_en: {
      location: text.en.location,
      actions: text.en.actions,
      indications: text.en.indications,
      needling: text.en.needling,
      cautions: text.en.cautions,
    },
  };
}

const BUILDERS = { herbs: herbEntry, formulas: formulaEntry, points: pointEntry };
const SEED = {
  herbs: () => seedKeys('herbs', 'catalogue_upsert_herb'),
  formulas: () => seedKeys('formulas', 'catalogue_upsert_formula'),
  points: () => null,
};

/** Is this sheet inside the chosen scope? Points are always in: their codes are a closed set. */
function inScope(kind, sheet, seed) {
  if (scope === 'all' || kind === 'points') return true;
  return seed.has(sheet.key) || sheet.sources.some((source) => source.name === 'bara');
}

function main() {
  ensureDir(reportDir);
  const dataset = { generatedAt: new Date().toISOString(), herbs: [], formulas: [], points: [] };
  line(`# Catalogue dataset — ${dataset.generatedAt}`);
  line();
  line(
    `Built with --scope=${scope}${fieldsOnly ? ' --fields-only (no clinical text; the import leaves the text a catalogue entry already has)' : ''}.`,
  );
  line();
  for (const kind of ['herbs', 'formulas', 'points']) {
    const sheets = readJson(path.join(factsDir, `${kind}.json`), []);
    const seed = SEED[kind]() ?? new Set();
    const chosen = sheets.filter((sheet) => inScope(kind, sheet, seed));
    const missing = [];
    let removed = 0;
    let flagged = 0;
    let attempts2 = 0;
    let withText = 0;
    const emptyFields = {};
    for (const sheet of chosen) {
      const text = fieldsOnly ? null : readJson(path.join(textDir, kind, `${sheet.key}.json`));
      if (!fieldsOnly && (!text || !text.he || !text.en)) {
        missing.push(sheet.pinyin ?? sheet.code);
        continue;
      }
      if (text) {
        withText += 1;
        removed += text.removed ?? 0;
        if (text.flagged) flagged += 1;
        if (text.attempts === 2) attempts2 += 1;
        for (const [field, value] of Object.entries(text.he))
          if (!value) emptyFields[field] = (emptyFields[field] ?? 0) + 1;
      }
      dataset[kind].push(BUILDERS[kind](sheet, text));
    }
    line(`## ${kind}`);
    line();
    line(
      `- fact sheets ${sheets.length}; in scope ${chosen.length}; in the dataset ${dataset[kind].length}${fieldsOnly ? ' (structured fields only)' : `; with text ${withText}; without text (left out) ${missing.length}`}`,
    );
    if (!fieldsOnly) {
      line(
        `- entries rewritten once after the checks: ${attempts2}; entries with a line removed in the end: ${flagged}; lines removed: ${removed}`,
      );
      line(`- Hebrew fields the sources gave nothing for: ${JSON.stringify(emptyFields)}`);
    }
    if (kind === 'herbs') {
      line(
        `- Western herbs: ${dataset.herbs.filter((entry) => entry.tcm_category === 'western').length}; with a Hebrew name: ${dataset.herbs.filter((entry) => entry.hebrew).length}; with a dose: ${dataset.herbs.filter((entry) => entry.dose_min !== null || entry.dose_max !== null).length}`,
      );
    }
    if (kind === 'formulas') {
      line(
        `- ingredient lists from Bara: ${chosen.filter((s) => s.ingredientsFrom === 'bara').length}, from American Dragon: ${chosen.filter((s) => s.ingredientsFrom === 'americandragon').length}; category inferred from actions: ${chosen.filter((s) => s.categoryInferred).length}`,
      );
    }
    const disagreements = chosen.filter((sheet) => sheet.disagreements?.length);
    if (disagreements.length) {
      line();
      line(`### Where the sources disagree (Bara was taken) — ${disagreements.length}`);
      line();
      for (const sheet of disagreements)
        line(`- ${sheet.pinyin}: ${sheet.disagreements.join(' | ')}`);
    }
    if (missing.length) {
      line();
      line(`### Without text yet — ${missing.length}`);
      line();
      line(missing.join(', '));
    }
    line();
  }
  fs.writeFileSync(datasetFile, JSON.stringify(dataset));
  fs.writeFileSync(path.join(reportDir, 'report.md'), report.join('\n'));
  log(
    `build: herbs ${dataset.herbs.length}, formulas ${dataset.formulas.length}, points ${dataset.points.length} → ${datasetFile}; report → ${path.join(reportDir, 'report.md')}`,
  );
}

main();
