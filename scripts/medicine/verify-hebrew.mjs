// Step 6b — the numbers check. Every number in a Hebrew section (a dose, a
// frequency, an age, a percentage) must appear in the English material the
// section was written from; a number that does not is either invented or
// converted, and either is a reason to write the entry again. Runs on the
// generated Hebrew and on the hand-written file alike, needs no network.
//
//   node scripts/medicine/verify-hebrew.mjs
//
// Output: .cache/medicine/hebrew-flags.json (what build.mjs marks and
// hebrew.mjs --redo-flagged rewrites) and test-results/medicine/hebrew-numbers.md
import fs from 'node:fs';
import path from 'node:path';
import { cacheDir, log, readJson, reportDir, seedDir, writeJson } from './lib.mjs';
import { hashOf, materialFor } from './lib/material.mjs';

/** Numbers as a reader sees them: 2,000 and 2000 are the same, 12.5 is one number, "1/2" two. */
function numbersIn(text) {
  const out = new Set();
  for (const match of String(text ?? '').matchAll(/\d[\d,]*(?:\.\d+)?/g)) {
    const clean = match[0].replace(/,/g, '').replace(/\.$/, '');
    if (clean) out.add(clean);
  }
  return out;
}

/** Numbers that carry no clinical claim: section numbers of the label, years, single digits used as counters, the "00" of a clock time. */
function trivial(number) {
  return /^(19|20)\d\d$/.test(number) || /^\d$/.test(number) || /^0+$/.test(number) || (/^\d\.\d$/.test(number) && Number(number) < 10);
}

/** The Hebrew the entry carries: hand-written, or the generated text for exactly this material. */
function currentHebrew(entry, manual) {
  const qid = entry.wikidata_id;
  if (manual[qid]) return { source: 'manual', summary_he: manual[qid].summary_he, sections_he: manual[qid].sections_he ?? {} };
  const record = readJson(path.join(cacheDir, 'hebrew', `${qid}.${hashOf(materialFor(entry))}.json`));
  if (!record) return null;
  return { source: 'generated', summary_he: record.summary_he, sections_he: record.sections_he ?? {} };
}

function main() {
  const compiled = readJson(path.join(cacheDir, 'compiled.json'));
  if (!compiled) throw new Error('run compile.mjs first');
  const manual = readJson(path.join(seedDir, 'hebrew-manual.json'), {});
  const flags = {};
  const lines = ['# Hebrew numbers check', ''];
  let checked = 0;
  for (const entry of compiled.entries) {
    const he = currentHebrew(entry, manual);
    if (!he) continue;
    checked += 1;
    const material = numbersIn([entry.summary_en, ...Object.values(entry.sections?.en ?? {}), ...(entry.quotes ?? []).map((q) => q.text)].join('\n'));
    const missing = [];
    for (const [section, text] of Object.entries({ summary: he.summary_he, ...he.sections_he })) {
      for (const number of numbersIn(text)) {
        if (!material.has(number) && !trivial(number)) missing.push(`${section}: ${number}`);
      }
    }
    if (missing.length) {
      flags[entry.wikidata_id] = { source: he.source, missing };
      lines.push(`- ${entry.kind} · ${entry.name_en} (${entry.wikidata_id}, ${he.source}): ${missing.join('; ')}`);
    }
  }
  writeJson(path.join(cacheDir, 'hebrew-flags.json'), { checked_at: new Date().toISOString(), flags });
  fs.mkdirSync(reportDir, { recursive: true });
  const flagged = Object.keys(flags).length;
  lines.splice(2, 0, `${checked} entries with Hebrew checked, ${flagged} with a number the sources do not have.`, '');
  fs.writeFileSync(path.join(reportDir, 'hebrew-numbers.md'), lines.join('\n') + '\n');
  log(`verify-hebrew: ${checked} checked, ${flagged} flagged → test-results/medicine/hebrew-numbers.md`);
}

try {
  main();
} catch (error) {
  console.error(error.message ?? error);
  process.exitCode = 1;
}
