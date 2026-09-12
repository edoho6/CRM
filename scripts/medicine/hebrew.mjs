// Step 6 — the Hebrew. Each entry's English material (the sections compiled
// from the sources) is handed to Claude with one instruction: write the
// Hebrew entry from this and nothing else. Doses and side effects are
// translated from the quoted passage, never invented or rounded; a section
// with no material is left out. The answer is cached by a hash of the
// material, so a re-run only pays for what changed.
//
//   node scripts/medicine/hebrew.mjs [--force] [--limit=N]
//
// Needs ANTHROPIC_API_KEY in apps/web/.env.local (the same key the
// "questions about the data" screen uses). Without it the step is skipped;
// build.mjs then falls back to supabase/seed/medicine/hebrew-manual.json,
// where Hebrew written by hand lives, keyed by Wikidata item.
// Output: .cache/medicine/hebrew/<qid>.<hash>.json
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { args, cacheDir, env, log, readJson, sleep, writeJson } from './lib.mjs';

const MODEL = 'claude-sonnet-5';
const ENDPOINT = 'https://api.anthropic.com/v1/messages';
const dir = path.join(cacheDir, 'hebrew');

const SECTION_KEYS = {
  condition: ['overview', 'symptoms', 'causes', 'diagnosis', 'treatment', 'urgent', 'self_care'],
  symptom: ['overview', 'possible_causes', 'urgent', 'self_care'],
  drug: ['what_for', 'how_to_take', 'side_effects', 'who_cannot', 'interactions', 'pregnancy'],
};

const SYSTEM = `You write entries for a Hebrew medical reference used by clinicians in Israel.
Rules, in order of importance:
1. Use ONLY the material given. Do not add facts, doses, drug names, numbers or claims that are not in it. If a section has no material, omit it.
2. Doses, frequencies, units, percentages and durations must be carried over exactly as written in the material (translate the words, keep the numbers). Never round, convert or generalise a dose.
3. Write plain, neutral Hebrew (impersonal register: "מומלץ", "נוטלים", never "אתה"/"את"). Short sentences. No marketing tone, no reassurance, no advice beyond the material.
4. Keep drug and condition names as the Hebrew name given, with the English in parentheses the first time.
5. Output JSON only, of the shape {"summary_he": string, "sections_he": {key: string}} with keys taken from the allowed list. summary_he is one or two sentences saying what the entry is. Each section is 1–6 sentences of prose; lists may be written as short lines separated by newlines.`;

function hashOf(material) {
  return crypto.createHash('sha1').update(JSON.stringify(material)).digest('hex').slice(0, 12);
}

function materialFor(entry) {
  return {
    kind: entry.kind,
    name_en: entry.name_en,
    name_he: entry.name_he,
    summary_en: entry.summary_en,
    sections_en: entry.sections?.en ?? {},
    allowed_sections: SECTION_KEYS[entry.kind],
  };
}

async function callClaude(key, material) {
  const body = {
    model: MODEL,
    max_tokens: 1600,
    system: SYSTEM,
    messages: [
      {
        role: 'user',
        content: `Entry kind: ${material.kind}\nEnglish name: ${material.name_en}\nHebrew name: ${material.name_he ?? '(none — transliterate)'}\nAllowed section keys: ${material.allowed_sections.join(', ')}\n\nMATERIAL (English, from the sources):\n${JSON.stringify({ summary: material.summary_en, sections: material.sections_en }, null, 1)}\n\nReturn the JSON.`,
      },
    ],
  };
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`anthropic ${response.status}: ${(await response.text()).slice(0, 200)}`);
  const data = await response.json();
  const text = (data.content ?? []).filter((b) => b.type === 'text').map((b) => b.text).join('');
  const json = text.match(/\{[\s\S]*\}/);
  if (!json) throw new Error('no JSON in the answer');
  const parsed = JSON.parse(json[0]);
  const sections = {};
  for (const key of material.allowed_sections) if (typeof parsed.sections_he?.[key] === 'string' && parsed.sections_he[key].trim()) sections[key] = parsed.sections_he[key].trim();
  return { summary_he: String(parsed.summary_he ?? '').trim() || null, sections_he: sections, usage: data.usage ?? null };
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
  fs.mkdirSync(dir, { recursive: true });
  const limit = options.limit ? Number(options.limit) : Infinity;
  let written = 0;
  let tokens = 0;
  for (const entry of compiled.entries) {
    if (written >= limit) break;
    const material = materialFor(entry);
    if (!Object.keys(material.sections_en).length && !material.summary_en) continue;
    const file = path.join(dir, `${entry.wikidata_id}.${hashOf(material)}.json`);
    if (fs.existsSync(file) && !options.force) continue;
    try {
      const result = await callClaude(key, material);
      writeJson(file, { wikidata_id: entry.wikidata_id, model: MODEL, generated_at: new Date().toISOString(), basis: Object.keys(material.sections_en), ...result });
      written += 1;
      tokens += (result.usage?.input_tokens ?? 0) + (result.usage?.output_tokens ?? 0);
      log(`hebrew: ${entry.name_en} ✓`);
      await sleep(400);
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
