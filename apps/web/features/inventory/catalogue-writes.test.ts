import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * A formula invented for one patient stays on that patient's treatment.
 *
 * Writing a prescription often means adapting a classical formula, or making
 * one up on the spot for the person in the room. That is a line on a treatment,
 * not an addition to the shared catalogue: the practitioner who opens the
 * formula list next week should see the formulas they chose to keep, not every
 * improvisation of the past year. `record_prescription` already stores a typed
 * formula as a name on the dispensing record, and the only screen that creates
 * a catalogue row is the formula editor.
 *
 * Nothing in the type system says so, though — any server action could insert
 * into `herb_formulas` and nobody would notice until the list had filled up. So
 * the rule is checked the way it is stated: by reading the source.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, '../..');

/** The formula editor, and nothing else, may add a formula to the catalogue. */
const ALLOWED = new Set(['features/inventory/actions.ts']);

const SKIP = new Set(['node_modules', '.next', 'test-results', 'public']);

function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(full, acc);
    else if (/\.tsx?$/.test(entry.name) && !entry.name.endsWith('.test.ts')) acc.push(full);
  }
  return acc;
}

describe('the formula catalogue', () => {
  it('is written to by the formula editor alone', () => {
    const writers: string[] = [];
    for (const dir of ['app', 'features', 'components', 'lib']) {
      for (const file of sourceFiles(path.join(webRoot, dir))) {
        const source = readFileSync(file, 'utf8');
        // `.from('herb_formulas')` and an insert within the same statement —
        // the chain may wrap across lines, so the gap is allowed to.
        if (/from\('herb_formulas'\)[\s\S]{0,200}?\.insert\(/.test(source)) {
          writers.push(path.relative(webRoot, file).split(path.sep).join('/'));
        }
      }
    }
    expect(writers.filter((file) => !ALLOWED.has(file))).toEqual([]);
  });
});
