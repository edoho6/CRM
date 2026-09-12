// Step 6 — the Hebrew. Each entry's English material (the sections compiled
// from the sources) is handed to Claude with one instruction: write the
// Hebrew entry from this and nothing else. Doses and side effects are
// translated from the quoted passage, never invented or rounded; a section
// with no material is left out. The answer is cached by a hash of the
// material, so a re-run only pays for what changed.
//
//   node scripts/medicine/hebrew.mjs [--force] [--limit=N] [--redo-flagged]
//   node scripts/medicine/hebrew.mjs --review [--limit=N]
//
// --review is the second reading: a separate call that is shown the
// material and the Hebrew and asked only whether the Hebrew says anything
// the material does not, or gets a number wrong. Its verdict is kept beside
// the entry (build.mjs puts it in hebrew_meta.review) and a failed verdict,
// like a failed numbers check (verify-hebrew.mjs), is what --redo-flagged
// rewrites.
//
// Needs ANTHROPIC_API_KEY in apps/web/.env.local (the same key the
// "questions about the data" screen uses). Without it the step is skipped;
// build.mjs then falls back to supabase/seed/medicine/hebrew-manual.json,
// where Hebrew written by hand lives, keyed by Wikidata item.
// Output: .cache/medicine/hebrew/<qid>.<hash>.json, .cache/medicine/hebrew-review/<qid>.<hash>.json
import fs from 'node:fs';
import path from 'node:path';
import { args, cacheDir, env, log, readJson, seedDir, sleep, writeJson } from './lib.mjs';
import { hashOf, materialFor } from './lib/material.mjs';

const MODEL = 'claude-sonnet-5';
const ENDPOINT = 'https://api.anthropic.com/v1/messages';
const dir = path.join(cacheDir, 'hebrew');
const reviewDir = path.join(cacheDir, 'hebrew-review');

const SYSTEM = `You write entries for a Hebrew medical reference used by clinicians in Israel.
Rules, in order of importance:
1. Use ONLY the material given. Do not add facts, doses, drug names, numbers or claims that are not in it. If a section has no material, omit it.
2. Doses, frequencies, units, percentages, ages and durations must be carried over exactly as written in the material (translate the words, keep the numbers). Never round, convert or generalise a number.
3. Write plain, neutral Hebrew (impersonal register: "מומלץ", "נוטלים", never "אתה"/"את"). Short sentences. No marketing tone, no reassurance, no advice beyond the material.
4. Keep drug and condition names as the Hebrew name given, with the English in parentheses the first time.
5. When the material is a label of one product form (an injection, an extended-release tablet, an inhaler), say so in the first section, because the doses belong to that form.
6. Output JSON only, of the shape {"summary_he": string, "sections_he": {key: string}} with keys taken from the allowed list. summary_he is one or two sentences saying what the entry is. Each section is 1–8 sentences of prose; lists may be written as short lines separated by newlines.`;

const REVIEW_SYSTEM = `You are checking a Hebrew medical entry against the English source material it was written from. You are not asked to improve it, only to judge it.
Answer JSON only: {"faithful": true|false, "issues": [string]}.
faithful is false if the Hebrew states any fact, dose, number, drug name, indication or warning that the material does not contain, or contradicts the material, or changes a number (rounding, converting units, a different frequency). Translation choices and omissions are not issues. Each issue is one short English sentence naming the section and what is wrong.`;

async function ask(key, system, content, maxTokens) {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, system, messages: [{ role: 'user', content }] }),
  });
  if (response.status === 429 || response.status === 529) {
    await sleep(20000);
    return ask(key, system, content, maxTokens);
  }
  if (!response.ok) throw new Error(`anthropic ${response.status}: ${(await response.text()).slice(0, 200)}`);
  const data = await response.json();
  const text = (data.content ?? []).filter((b) => b.type === 'text').map((b) => b.text).join('');
  const json = text.match(/\{[\s\S]*\}/);
  if (!json) throw new Error('no JSON in the answer');
  return { parsed: JSON.parse(json[0]), usage: data.usage ?? null };
}

async function writeHebrew(key, material) {
  const content = `Entry kind: ${material.kind}\nEnglish name: ${material.name_en}\nHebrew name: ${material.name_he ?? '(none — transliterate)'}\nAllowed section keys: ${material.allowed_sections.join(', ')}\n\nMATERIAL (English, from the sources):\n${JSON.stringify({ summary: material.summary_en, sections: material.sections_en }, null, 1)}\n\nReturn the JSON.`;
  const { parsed, usage } = await ask(key, SYSTEM, content, 2500);
  const sections = {};
  for (const k of material.allowed_sections) if (typeof parsed.sections_he?.[k] === 'string' && parsed.sections_he[k].trim()) sections[k] = parsed.sections_he[k].trim();
  return { summary_he: String(parsed.summary_he ?? '').trim() || null, sections_he: sections, usage };
}

async function reviewHebrew(key, material, hebrew) {
  const content = `MATERIAL (English):\n${JSON.stringify({ summary: material.summary_en, sections: material.sections_en }, null, 1)}\n\nHEBREW ENTRY:\n${JSON.stringify({ summary_he: hebrew.summary_he, sections_he: hebrew.sections_he }, null, 1)}\n\nReturn the JSON verdict.`;
  const { parsed, usage } = await ask(key, REVIEW_SYSTEM, content, 800);
  return { faithful: Boolean(parsed.faithful), issues: Array.isArray(parsed.issues) ? parsed.issues.map(String).slice(0, 10) : [], usage };
}

/** The latest generated Hebrew for an item, or the hand-written one. */
function currentHebrew(qid, hash, manual) {
  if (manual[qid]) return { file: 'manual', summary_he: manual[qid].summary_he ?? null, sections_he: manual[qid].sections_he ?? {} };
  const file = path.join(dir, `${qid}.${hash}.json`);
  const record = readJson(file);
  return record ? { file, ...record } : null;
}

async function main() {
  const options = args();
  const key = env('ANTHROPIC_API_KEY');
  const compiled = readJson(path.join(cacheDir, 'compiled.json'));
  if (!compiled) throw new Error('run compile.mjs first');
  if (!key) {
    log('hebrew: ANTHROPIC_API_KEY is not set — skipped (build.mjs uses hebrew-manual.json where it has an entry)');
    return;
  }
  const manual = readJson(path.join(seedDir, 'hebrew-manual.json'), {});
  const flags = readJson(path.join(cacheDir, 'hebrew-flags.json'), { flags: {} }).flags;
  fs.mkdirSync(dir, { recursive: true });
  fs.mkdirSync(reviewDir, { recursive: true });
  const limit = options.limit ? Number(options.limit) : Infinity;
  let written = 0;
  let tokens = 0;

  if (options.review) {
    let unfaithful = 0;
    for (const entry of compiled.entries) {
      if (written >= limit) break;
      const material = materialFor(entry);
      if (!Object.keys(material.sections_en).length) continue;
      const hash = hashOf(material);
      const hebrew = currentHebrew(entry.wikidata_id, hash, manual);
      if (!hebrew || !Object.keys(hebrew.sections_he).length) continue;
      const file = path.join(reviewDir, `${entry.wikidata_id}.${hash}.json`);
      if (fs.existsSync(file) && !options.force) continue;
      try {
        const verdict = await reviewHebrew(key, material, hebrew);
        writeJson(file, { wikidata_id: entry.wikidata_id, model: MODEL, reviewed_at: new Date().toISOString(), of: hebrew.file, ...verdict });
        written += 1;
        tokens += (verdict.usage?.input_tokens ?? 0) + (verdict.usage?.output_tokens ?? 0);
        if (!verdict.faithful) unfaithful += 1;
        log(`review: ${entry.name_en} ${verdict.faithful ? '✓' : '✗ ' + verdict.issues.join(' | ')}`);
        await sleep(300);
      } catch (error) {
        log(`review: ${entry.name_en} — ${error.message}`);
      }
    }
    log(`review: ${written} entries reviewed, ${unfaithful} flagged (${tokens} tokens) → .cache/medicine/hebrew-review/`);
    return;
  }

  for (const entry of compiled.entries) {
    if (written >= limit) break;
    const material = materialFor(entry);
    if (!Object.keys(material.sections_en).length && !material.summary_en) continue;
    const hash = hashOf(material);
    const file = path.join(dir, `${entry.wikidata_id}.${hash}.json`);
    const review = readJson(path.join(reviewDir, `${entry.wikidata_id}.${hash}.json`));
    const flagged = Boolean(flags[entry.wikidata_id]) || (review && review.faithful === false);
    if (options['redo-flagged'] ? !flagged : fs.existsSync(file) && !options.force) continue;
    if (manual[entry.wikidata_id] && !options.force) continue;
    try {
      const result = await writeHebrew(key, material);
      writeJson(file, { wikidata_id: entry.wikidata_id, model: MODEL, generated_at: new Date().toISOString(), basis: Object.keys(material.sections_en), attempt: (readJson(file)?.attempt ?? 0) + 1, ...result });
      // A rewrite invalidates the old verdict; the next --review reads it again.
      fs.rmSync(path.join(reviewDir, `${entry.wikidata_id}.${hash}.json`), { force: true });
      written += 1;
      tokens += (result.usage?.input_tokens ?? 0) + (result.usage?.output_tokens ?? 0);
      log(`hebrew: ${entry.name_en} ✓`);
      await sleep(300);
    } catch (error) {
      log(`hebrew: ${entry.name_en} — ${error.message}`);
    }
  }
  log(`hebrew: ${written} entries written (${tokens} tokens) → .cache/medicine/hebrew/`);
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exitCode = 1;
});
