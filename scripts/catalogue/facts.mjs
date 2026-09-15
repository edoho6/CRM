#!/usr/bin/env node
// From the two sources to one fact sheet per herb, formula and point.
//
//   node scripts/catalogue/facts.mjs [--kind=herbs,formulas,points]
//
// Reads what scripts/pull/bara.mjs saved (test-results/pull/bara/index) and
// what fetch-americandragon.mjs saved (.cache/catalogue/americandragon),
// parses both into facts, merges them by pinyin (herbs, formulas) or point
// code, and writes .cache/catalogue/facts/<kind>.json — the only thing the
// writer is allowed to see — plus test-results/catalogue/facts-report.md:
// what matched, what only one source has, what could not be mapped to a
// catalogue key, and where the two sources disagree.
import fs from 'node:fs';
import path from 'node:path';
import {
  args,
  baraDir,
  dragonDir,
  ensureDir,
  factsDir,
  log,
  readJson,
  reportDir,
  root,
  writeJson,
} from './lib.mjs';
import {
  parseDragonFormula,
  parseDragonHerb,
  parseDragonPoint,
} from '../../supabase/functions/_shared/catalogue/americandragon.ts';
import {
  parseBaraFormula,
  parseBaraHerb,
} from '../../supabase/functions/_shared/catalogue/bara.ts';
import {
  mergeFormula,
  mergeHerb,
  mergePoint,
} from '../../supabase/functions/_shared/catalogue/merge.ts';
import { normalizePinyin } from '../../supabase/functions/_shared/catalogue/map.ts';

const options = args();
const kinds = String(options.kind ?? 'herbs,formulas,points')
  .split(',')
  .map((s) => s.trim());

const report = [];
const line = (text = '') => report.push(text);

function readEntries(file) {
  const data = readJson(file, []);
  return Array.isArray(data) ? data : Object.values(data);
}

function dragonPages(family) {
  const dir = path.join(dragonDir, family);
  if (!fs.existsSync(dir)) return [];
  const index = readJson(path.join(dragonDir, 'index.json'), {});
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.html'))
    .map((name) => {
      const slug = name.replace(/\.html$/, '');
      const meta = index[`${family}/${slug}`];
      return {
        slug,
        html: fs.readFileSync(path.join(dir, name), 'utf8'),
        url: meta?.url ?? `https://www.americandragon.com/${family}/${name}`,
      };
    });
}

/**
 * The keys the bundled seed already holds, to say how much of it the sources
 * cover. Herbs and formulas are matched on their pinyin; a point code keeps
 * its digits, because normalizePinyin would turn every ST code into "st".
 */
function seedNames(folder, fn, { codes = false } = {}) {
  const dir = path.join(root, 'supabase', 'seed', folder);
  if (!fs.existsSync(dir)) return new Set();
  const names = new Set();
  for (const file of fs.readdirSync(dir)) {
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    for (const match of sql.matchAll(new RegExp(`${fn}\\('([^']+)'`, 'g')))
      names.add(codes ? match[1].trim().toUpperCase() : normalizePinyin(match[1]));
  }
  return names;
}

function tally(list) {
  const counts = new Map();
  for (const item of list) counts.set(item, (counts.get(item) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

function herbs() {
  const bara = new Map();
  const baraSkipped = [];
  for (const record of readEntries(path.join(baraDir, 'herbs', 'entries.json'))) {
    const parsed = parseBaraHerb(record);
    if (!parsed) {
      baraSkipped.push(record.listName);
      continue;
    }
    const key = parsed.pinyin
      ? normalizePinyin(parsed.pinyin)
      : parsed.botanical
        ? `w:${normalizePinyin(parsed.botanical)}`
        : null;
    if (!key) {
      baraSkipped.push(record.listName);
      continue;
    }
    if (bara.has(key)) baraSkipped.push(`${record.listName} (duplicate of ${bara.get(key).title})`);
    else bara.set(key, parsed);
  }

  const dragon = new Map();
  const dragonSkipped = [];
  const dragonDuplicates = [];
  for (const page of dragonPages('herbs')) {
    const parsed = parseDragonHerb(page.html, page.url);
    if (!parsed?.pinyin) {
      dragonSkipped.push(page.slug);
      continue;
    }
    const key = normalizePinyin(parsed.pinyin);
    if (dragon.has(key))
      dragonDuplicates.push(`${page.slug} = ${dragon.get(key).url.split('/').pop()}`);
    else dragon.set(key, parsed);
  }

  const keys = [...new Set([...bara.keys(), ...dragon.keys()])].sort();
  const sheets = [];
  for (const key of keys) {
    const sheet = mergeHerb(bara.get(key) ?? null, dragon.get(key) ?? null);
    if (sheet) sheets.push(sheet);
  }

  const seed = seedNames('herbs', 'catalogue_upsert_herb');
  const both = sheets.filter((s) => s.sources.length === 2).length;
  const onlyBara = sheets.filter((s) => s.sources.length === 1 && s.sources[0].name === 'bara');
  const onlyDragon = sheets.filter(
    (s) => s.sources.length === 1 && s.sources[0].name === 'americandragon',
  );
  line('## Herbs');
  line();
  line(
    `- Bara records read: ${bara.size} (${[...bara.values()].filter((h) => h.kind === 'western').length} Western); skipped ${baraSkipped.length}`,
  );
  line(
    `- American Dragon pages read: ${dragon.size}; skipped (no name) ${dragonSkipped.length}; duplicate pinyin ${dragonDuplicates.length}`,
  );
  line(
    `- Fact sheets: ${sheets.length} — in both sources ${both}, Bara only ${onlyBara.length}, American Dragon only ${onlyDragon.length}`,
  );
  line(
    `- Bundled seed herbs: ${seed.size}; covered by a sheet: ${[...seed].filter((k) => keys.includes(k)).length}; seed herbs with no sheet: ${[...seed].filter((k) => !keys.includes(k)).length}`,
  );
  line(`- Restricted in Israel (Bara): ${sheets.filter((s) => s.restrictedInIsrael).length}`);
  line();
  line('### Unmapped values');
  line();
  const unmappedCategory = sheets
    .filter((s) => !s.category)
    .flatMap((s) => Object.values(s.categoryRaw));
  line(`- category: ${sheets.filter((s) => !s.category).length} sheet(s) without a key`);
  for (const [value, count] of tally(unmappedCategory).slice(0, 40))
    line(`  - ${count} × "${value}"`);
  const unmappedTemperature = sheets.filter((s) => !s.temperature && s.kind === 'chinese').length;
  line(`- temperature: ${unmappedTemperature} Chinese sheet(s) without a key`);
  line(
    `- tastes: ${sheets.filter((s) => s.tastes.length === 0 && s.kind === 'chinese').length} Chinese sheet(s) without any`,
  );
  line(
    `- channels: ${sheets.filter((s) => s.channels.length === 0 && s.kind === 'chinese').length} Chinese sheet(s) without any`,
  );
  line(`- dose: ${sheets.filter((s) => !s.dose).length} sheet(s) without a dose`);
  line();
  line('### Disagreements between the sources');
  line();
  for (const sheet of sheets.filter((s) => s.disagreements.length))
    line(`- ${sheet.pinyin}: ${sheet.disagreements.join(' | ')}`);
  line();
  line('### Bara only (no American Dragon page)');
  line();
  line(onlyBara.map((s) => s.pinyin).join(', '));
  line();
  line('### Skipped');
  line();
  for (const name of baraSkipped) line(`- bara: ${name}`);
  for (const slug of dragonSkipped) line(`- americandragon: ${slug}`);
  for (const dup of dragonDuplicates) line(`- americandragon duplicate: ${dup}`);
  line();
  return sheets;
}

function formulas() {
  const bara = new Map();
  for (const record of readEntries(path.join(baraDir, 'formulas', 'entries.json'))) {
    const parsed = parseBaraFormula(record);
    if (parsed?.pinyin) bara.set(normalizePinyin(parsed.pinyin), parsed);
  }
  const dragon = new Map();
  const dragonSkipped = [];
  const dragonDuplicates = [];
  for (const page of dragonPages('formulas')) {
    const parsed = parseDragonFormula(page.html, page.url);
    if (!parsed?.pinyin) {
      dragonSkipped.push(`${page.slug} — ${parsed?.title?.split(' - ')[0] ?? '?'}`);
      continue;
    }
    const key = normalizePinyin(parsed.pinyin);
    if (dragon.has(key))
      dragonDuplicates.push(`${page.slug} = ${dragon.get(key).url.split('/').pop()}`);
    else dragon.set(key, parsed);
  }
  const keys = [...new Set([...bara.keys(), ...dragon.keys()])].sort();
  const sheets = [];
  for (const key of keys) {
    const sheet = mergeFormula(bara.get(key) ?? null, dragon.get(key) ?? null);
    if (sheet) sheets.push(sheet);
  }
  const seed = seedNames('formulas', 'catalogue_upsert_formula');
  line('## Formulas');
  line();
  line(`- Bara records read: ${bara.size}`);
  line(
    `- American Dragon pages read: ${dragon.size}; without a pinyin name (protocol pages, left out) ${dragonSkipped.length}; duplicate pinyin ${dragonDuplicates.length}`,
  );
  line(
    `- Fact sheets: ${sheets.length} — in both ${sheets.filter((s) => s.sources.length === 2).length}, Bara only ${sheets.filter((s) => s.sources.length === 1 && s.sources[0].name === 'bara').length}, American Dragon only ${sheets.filter((s) => s.sources.length === 1 && s.sources[0].name === 'americandragon').length}`,
  );
  line(
    `- Bundled seed formulas: ${seed.size}; covered: ${[...seed].filter((k) => keys.includes(k)).length}`,
  );
  line(
    `- Category: from Bara ${sheets.filter((s) => s.category && !s.categoryInferred).length}, inferred from American Dragon actions ${sheets.filter((s) => s.categoryInferred).length}, none ${sheets.filter((s) => !s.category).length}`,
  );
  line(
    `- Ingredients: from Bara ${sheets.filter((s) => s.ingredientsFrom === 'bara').length}, from American Dragon ${sheets.filter((s) => s.ingredientsFrom === 'americandragon').length}, none ${sheets.filter((s) => !s.ingredientsFrom).length}`,
  );
  line();
  line('### Unmapped Bara groups');
  line();
  for (const [value, count] of tally(
    sheets.filter((s) => !s.category && s.categoryRaw.bara).map((s) => s.categoryRaw.bara),
  ))
    line(`- ${count} × "${value}"`);
  line();
  line('### Disagreements between the sources');
  line();
  for (const sheet of sheets.filter((s) => s.disagreements.length))
    line(`- ${sheet.pinyin}: ${sheet.disagreements.join(' | ')}`);
  line();
  line('### American Dragon pages left out (no pinyin name)');
  line();
  for (const item of dragonSkipped) line(`- ${item}`);
  for (const dup of dragonDuplicates) line(`- duplicate: ${dup}`);
  line();
  return sheets;
}

function points() {
  const sheets = [];
  const extras = [];
  const seen = new Map();
  for (const page of dragonPages('points')) {
    const parsed = parseDragonPoint(page.html, page.url);
    if (!parsed) continue;
    const sheet = mergePoint(parsed);
    if (!sheet) {
      extras.push(`${parsed.codeRaw} ${parsed.pinyin ?? ''}`.trim());
      continue;
    }
    if (seen.has(sheet.code)) {
      extras.push(`duplicate ${sheet.code}: ${page.slug} = ${seen.get(sheet.code)}`);
      continue;
    }
    seen.set(sheet.code, page.slug);
    sheets.push(sheet);
  }
  sheets.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
  const seedCodes = seedNames('points', 'catalogue_upsert_point', { codes: true });
  const have = new Set(sheets.map((s) => s.code.toUpperCase()));
  line('## Points');
  line();
  line(
    `- American Dragon pages read: ${sheets.length + extras.length}; channel points ${sheets.length}; extra points and duplicates (left out for now) ${extras.length}`,
  );
  line(
    `- Catalogue codes: ${seedCodes.size}; with a sheet: ${[...seedCodes].filter((k) => have.has(k)).length}; without: ${
      [...seedCodes].filter((k) => !have.has(k)).join(', ') || '—'
    }`,
  );
  line(
    `- Sheets without a location: ${sheets.filter((s) => s.location.length === 0).length}; without needling: ${sheets.filter((s) => s.needling.length === 0).length}`,
  );
  line();
  line('### Extra points seen (not in the catalogue yet)');
  line();
  line(extras.join(', '));
  line();
  return sheets;
}

function main() {
  ensureDir(factsDir);
  ensureDir(reportDir);
  line(`# Catalogue facts — ${new Date().toISOString()}`);
  line();
  const counts = {};
  if (kinds.includes('herbs')) {
    const sheets = herbs();
    writeJson(path.join(factsDir, 'herbs.json'), sheets);
    counts.herbs = sheets.length;
  }
  if (kinds.includes('formulas')) {
    const sheets = formulas();
    writeJson(path.join(factsDir, 'formulas.json'), sheets);
    counts.formulas = sheets.length;
  }
  if (kinds.includes('points')) {
    const sheets = points();
    writeJson(path.join(factsDir, 'points.json'), sheets);
    counts.points = sheets.length;
  }
  fs.writeFileSync(path.join(reportDir, 'facts-report.md'), report.join('\n'));
  log(
    `facts: ${JSON.stringify(counts)} → ${factsDir}; report → ${path.join(reportDir, 'facts-report.md')}`,
  );
}

main();
