// Step 7 — the dataset: the compiled entries with their Hebrew folded in,
// written where the importer reads it, plus a report of what the corpus
// looks like.
//
//   node scripts/medicine/build.mjs
//
// Hebrew comes from .cache/medicine/hebrew (hebrew.mjs) or, for an entry
// that has one, from supabase/seed/medicine/hebrew-manual.json — text
// written by a person, keyed by Wikidata item, which always wins. The
// second reading's verdict (hebrew.mjs --review) and the numbers check
// (verify-hebrew.mjs) travel with the entry in hebrew_meta, so the page can
// say what was checked.
// Output: supabase/seed/medicine/dataset.json.gz and test-results/medicine/report.md
import fs from 'node:fs';
import path from 'node:path';
import { cacheDir, datasetFile, firstSentences, log, readJson, reportDir, root, seedDir, writeGzipJson } from './lib.mjs';
import { hashOf, materialFor } from './lib/material.mjs';

/**
 * The Hebrew an entry carries, in order of preference: written by a person,
 * written from the sources by the model, and only then the Hebrew Wikipedia
 * article itself. The last is share-alike, so it is marked as such, and it
 * is what gives the reference Hebrew at all until the model has run.
 */
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
  // The Hebrew written from the material the entry has now; older Hebrew, from material that has since changed, is not used.
  const generated = fs.existsSync(dir) ? readJson(path.join(dir, `${entry.wikidata_id}.${hashOf(materialFor(entry))}.json`)) : null;
  if (generated) {
    return {
      summary_he: generated.summary_he ?? null,
      sections_he: generated.sections_he ?? {},
      hebrew_meta: { model: generated.model, generated_at: generated.generated_at, basis: generated.basis ?? [] },
    };
  }
  const wiki = entry.wikipedia_he;
  if (wiki) {
    return {
      summary_he: wiki.sections.overview ? firstSentences(wiki.sections.overview) : null,
      sections_he: wiki.sections,
      hebrew_meta: {
        model: 'wikipedia-he',
        generated_at: wiki.retrieved_at ?? null,
        basis: Object.keys(wiki.sections),
        source: { title: wiki.title, url: wiki.url, revision: wiki.revision, revised_at: wiki.revised_at, licence: wiki.licence },
      },
    };
  }
  return null;
}

/** The second reading's verdict for the Hebrew the entry carries, if one was made. */
function reviewFor(entry) {
  const file = path.join(cacheDir, 'hebrew-review', `${entry.wikidata_id}.${hashOf(materialFor(entry))}.json`);
  const review = readJson(file);
  return review ? { faithful: Boolean(review.faithful), issues: review.issues ?? [], model: review.model, reviewed_at: review.reviewed_at } : null;
}

function main() {
  const compiled = readJson(path.join(cacheDir, 'compiled.json'));
  if (!compiled) throw new Error('run compile.mjs first');
  const manual = readJson(path.join(seedDir, 'hebrew-manual.json'), {});
  const flags = readJson(path.join(cacheDir, 'hebrew-flags.json'), { flags: {} }).flags ?? {};
  // The pictures a person has looked at (images.mjs, then the contact sheets):
  // the manifest is the list, the files sit under public/medicine/images.
  const images = readJson(path.join(root, 'apps', 'web', 'features', 'medicine', 'medicine-images.json'), {});

  const entries = compiled.entries.map((entry) => {
    const he = hebrewFor(entry, manual);
    const { description_he, image_file, wikipedia_he, ...rest } = entry;
    const picture = entry.wikidata_id ? images[entry.wikidata_id] : null;
    const image = picture
      ? {
          file: `/medicine/images/${picture.file}`,
          title: picture.title,
          source: picture.source,
          author: picture.author,
          page: picture.page,
          licence: picture.licence,
          licenceUrl: picture.licenceUrl,
          creditRequired: picture.creditRequired,
        }
      : null;
    // A Hebrew name given by hand wins over Wikidata's label ("ליפיטור" is a
    // brand, "מתנת" is nobody's word for low back pain); the label stays as an alias.
    const handName = manual[entry.wikidata_id]?.name_he ?? null;
    const nameHe = handName ?? entry.name_he;
    const aliasesHe = [...new Set([...(entry.aliases_he ?? []), ...(handName && entry.name_he && entry.name_he !== handName ? [entry.name_he] : []), ...(manual[entry.wikidata_id]?.aliases_he ?? [])])];
    // The model's Hebrew is reviewed and its numbers checked; text quoted
    // from Wikipedia is not the model's to answer for.
    const review = he && he.hebrew_meta.model !== 'wikipedia-he' ? reviewFor(entry) : null;
    const numbers = review || (he && he.hebrew_meta.model !== 'wikipedia-he') ? (flags[entry.wikidata_id] ? { ok: false, missing: flags[entry.wikidata_id].missing } : { ok: true, missing: [] }) : null;
    return {
      ...rest,
      image,
      name_he: nameHe,
      aliases_he: aliasesHe,
      // A short Wikidata description is better than nothing under a name.
      summary_he: he?.summary_he ?? (description_he ? description_he[0].toUpperCase() + description_he.slice(1) : null),
      sections: { en: entry.sections?.en ?? null, he: he && Object.keys(he.sections_he).length ? he.sections_he : null },
      hebrew_meta: he ? { ...he.hebrew_meta, review, numbers } : null,
    };
  });

  writeGzipJson(datasetFile, { generated_at: new Date().toISOString(), entries, links: compiled.links });

  const byKind = {};
  for (const e of entries) {
    const bucket = (byKind[e.kind] ??= { total: 0, draft: 0, cross_checked: 0, verified: 0, hebrew: 0, ownHebrew: 0, sources2: 0, identity: 0, reviewed: 0, faithful: 0, numbersOk: 0 });
    bucket.total += 1;
    bucket[e.status] += 1;
    if (e.sections.he) bucket.hebrew += 1;
    if (e.sections.he && e.hebrew_meta?.model !== 'wikipedia-he') bucket.ownHebrew += 1;
    if ((e.cross_check?.sources ?? 0) >= 2) bucket.sources2 += 1;
    if (e.cross_check?.identity_confirmed) bucket.identity += 1;
    if (e.hebrew_meta?.review) bucket.reviewed += 1;
    if (e.hebrew_meta?.review?.faithful) bucket.faithful += 1;
    if (e.hebrew_meta?.numbers?.ok) bucket.numbersOk += 1;
  }
  const dropped = compiled.dropped ?? [];
  const droppedByReason = dropped.reduce((acc, d) => ((acc[d.reason] = [...(acc[d.reason] ?? []), d]), acc), {});
  const lines = [
    `# Western medicine corpus — ${new Date().toISOString().slice(0, 10)}`,
    '',
    `${entries.length} entries, ${compiled.links.length} links; ${dropped.length} items left out.`,
    '',
    '| kind | entries | draft | cross-checked | verified | ≥2 sources | identity confirmed | with Hebrew | Hebrew of our own | Hebrew reviewed | faithful | numbers ok |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|',
    ...Object.entries(byKind).map(([k, b]) => `| ${k} | ${b.total} | ${b.draft} | ${b.cross_checked} | ${b.verified} | ${b.sources2} | ${b.identity} | ${b.hebrew} | ${b.ownHebrew} | ${b.reviewed} | ${b.faithful} | ${b.numbersOk} |`),
    '',
    '## Left out',
    '',
    ...Object.entries(droppedByReason).flatMap(([reason, items]) => [
      `### ${reason} (${items.length})`,
      '',
      ...items.slice(0, 80).map((d) => `- ${d.kind} · ${d.name} (${d.qid})`),
      ...(items.length > 80 ? [`- … and ${items.length - 80} more`] : []),
      '',
    ]),
    '## Entries with one source only',
    '',
    ...entries.filter((e) => (e.cross_check?.sources ?? 0) < 2).map((e) => `- ${e.kind} · ${e.name_en} (${e.wikidata_id})`),
    '',
    '## Entries without Hebrew sections',
    '',
    ...entries.filter((e) => !e.sections.he).map((e) => `- ${e.kind} · ${e.name_en} (${e.wikidata_id})`),
    '',
    '## Hebrew the second reading rejected',
    '',
    ...entries.filter((e) => e.hebrew_meta?.review && !e.hebrew_meta.review.faithful).map((e) => `- ${e.name_en} (${e.wikidata_id}): ${e.hebrew_meta.review.issues.join(' | ')}`),
    '',
    '## Hebrew with a number the sources do not have',
    '',
    ...entries.filter((e) => e.hebrew_meta?.numbers && !e.hebrew_meta.numbers.ok).map((e) => `- ${e.name_en} (${e.wikidata_id}): ${e.hebrew_meta.numbers.missing.join('; ')}`),
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
