// The whole pipeline in order, for a sample or for everything:
//
//   node scripts/medicine/pipeline.mjs --conditions=12 --symptoms=8 --drugs=12
//   node scripts/medicine/pipeline.mjs --all
//
// Each step is its own script and can be re-run alone; the cache under
// .cache/medicine makes a second run cheap. The import is a separate,
// deliberate step (import.mjs), because it needs the platform admin.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const forwarded = process.argv.slice(2);

// The order matters twice: the sources before the compiler, and the Hebrew
// before its two checks — the second reading (hebrew.mjs --review) and the
// numbers check (verify-hebrew.mjs) — so that build.mjs can carry their
// verdicts. A rewrite of what they flagged is a separate, deliberate run:
// `node scripts/medicine/hebrew.mjs --redo-flagged`, then the checks again.
const steps = [
  ['wikidata.mjs'],
  ['medlineplus.mjs'],
  ['genetics.mjs'],
  // The labels come through DailyMed (no daily ceiling); openfda.mjs is the same step for a run with an openFDA key.
  ['dailymed.mjs'],
  ['rxnorm.mjs'],
  ['nhs.mjs'],
  ['compile.mjs'],
  ['hebrew.mjs'],
  ['hebrew.mjs', '--review'],
  ['verify-hebrew.mjs'],
  ['build.mjs'],
];

for (const [step, ...extra] of steps) {
  const stepArgs = step === 'wikidata.mjs' ? forwarded : [...extra, ...forwarded.filter((a) => a === '--force')];
  console.log(`\n── ${step} ${stepArgs.join(' ')}`);
  const result = spawnSync(process.execPath, [path.join(here, step), ...stepArgs], { stdio: 'inherit' });
  if (result.status !== 0) {
    console.error(`pipeline: ${step} failed`);
    process.exit(result.status ?? 1);
  }
}
