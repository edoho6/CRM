// Step 7 — the dataset: the compiled entries with their Hebrew folded in,
// written where the importer reads it, plus a report of what the corpus
// looks like.
//
//   node scripts/medicine/build.mjs
//
// Hebrew comes from .cache/medicine/hebrew (hebrew.mjs) or, for an entry
// that has one, from supabase/seed/medicine/hebrew-manual.json — text
// written by a person, keyed by Wikidata item, which always wins.
// Output: supabase/seed/medicine/dataset.json.gz and test-results/medicine/report.md
import fs from 'node:fs';
import path from 'node:path';
import { cacheDir, datasetFile, log, readJson, reportDir, seedDir, writeGzipJson } from './lib.mjs';

function hebrewFor(entry, manual) {
  const hand = manual[entry.wikidata_id];
  if (hand) {
    return {
      summary_he: hand.summary_he ?? null,
      sections_he: hand.sections_he ?? {},
      hebrew_meta: { model: 'manual', generated_at: hand.written_at ?? null, basis: hand.basis ?? Object.keys(entry.sections?.en ?? {}) },
    };
  }
  const dir = path.join(cacheDir, 'hebrew');
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir).filter((f) => f.startsWith(`${entry.wikidata_id}.`)).sort();
  if (!files.length) return null;
  const latest = readJson(path.join(dir, files[files.length - 1]));
  return {
    summary_he: latest.summary_he ?? null,
    sections_he: latest.sections_he ?? {},
    hebrew_meta: { model: latest.model, generated_at: latest.generated_at, basis: latest.basis ?? [] },
  };
}

function main() {
  const compiled = readJson(path.join(cacheDir, 'compiled.json'));
  if (!compiled) throw new Error('run compile.mjs first');
  const manual = readJson(path.join(seedDir, 'hebrew-manual.json'), {});

  const entries = compiled.entries.map((entry) => {
    const he = hebrewFor(entry, manual);
    const { description_he, image_file, ...rest } = entry;
    // A Hebrew name given by hand wins over Wikidata's label ("ליפיטור" is a
    // brand, "מתנת" is nobody's word for low back pain); the label stays as an alias.
    const handName = manual[entry.wikidata_id]?.name_he ?? null;
    const nameHe = handName ?? entry.name_he;
    const aliasesHe = [...new Set([...(entry.aliases_he ?? []), ...(handName && entry.name_he && entry.name_he !== handName ? [entry.name_he] : []), ...(manual[entry.wikidata_id]?.aliases_he ?? [])])];
    return {
      ...rest,
      name_he: nameHe,
      aliases_he: aliasesHe,
      // A short Wikidata description is better than nothing under a name.
      summary_he: he?.summary_he ?? (description_he ? description_he[0].toUpperCase() + description_he.slice(1) : null),
      sections: { en: entry.sections?.en ?? null, he: he && Object.keys(he.sections_he).length ? he.sections_he : null },
      hebrew_meta: he?.hebrew_meta ?? null,
    };
  });

  writeGzipJson(datasetFile, { generated_at: new Date().toISOString(), entries, links: compiled.links });

  const byKind = {};
  for (const e of entries) {
    const bucket = (byKind[e.kind] ??= { total: 0, draft: 0, cross_checked: 0, verified: 0, hebrew: 0, sources2: 0 });
    bucket.total += 1;
    bucket[e.status] += 1;
    if (e.sections.he) bucket.hebrew += 1;
    if ((e.cross_check?.sources ?? 0) >= 2) bucket.sources2 += 1;
  }
  const lines = [
    `# Western medicine corpus — ${new Date().toISOString().slice(0, 10)}`,
    '',
    `${entries.length} entries, ${compiled.links.length} links.`,
    '',
    '| kind | entries | draft | cross-checked | verified | with Hebrew | ≥2 sources |',
    '|---|---|---|---|---|---|---|',
    ...Object.entries(byKind).map(([k, b]) => `| ${k} | ${b.total} | ${b.draft} | ${b.cross_checked} | ${b.verified} | ${b.hebrew} | ${b.sources2} |`),
    '',
    '## Entries with one source only',
    '',
    ...entries.filter((e) => (e.cross_check?.sources ?? 0) < 2).map((e) => `- ${e.kind} · ${e.name_en} (${e.wikidata_id})`),
    '',
    '## Entries without Hebrew text',
    '',
    ...entries.filter((e) => !e.sections.he).map((e) => `- ${e.kind} · ${e.name_en} (${e.wikidata_id})`),
    '',
    '## Conflicts',
    '',
    ...entries.filter((e) => e.cross_check?.conflicts?.length).flatMap((e) => e.cross_check.conflicts.map((c) => `- ${e.name_en}: ${c}`)),
    '',
  ];
  fs.mkdirSync(reportDir, { recursive: true });
  fs.writeFileSync(path.join(reportDir, 'report.md'), lines.join('\n'));
  const size = Math.round(fs.statSync(datasetFile).size / 1024);
  log(`build: ${entries.length} entries → ${path.relative(process.cwd(), datasetFile)} (${size} KB); report in test-results/medicine/report.md`);
}

try {
  main();
} catch (error) {
  console.error(error.message ?? error);
  process.exitCode = 1;
}
