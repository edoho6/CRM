// Step 5a — LOINC (Regenstrief Institute): the code and the name every lab
// test is ordered and reported under. Free for commercial use with the
// licence acknowledged, but only after a person registers and accepts it —
// so the release is downloaded by hand, once, and this step reads it.
//
//   node scripts/medicine/loinc.mjs
//
// Put the release zip (Loinc_2.xx.zip, from loinc.org → Get LOINC →
// Downloads) in .cache/medicine/loinc/ and run this. Nothing here reaches
// the network.
//
// What is kept: the Universal Lab Orders value set — the ~1,500 tests
// actually ordered in practice, out of the hundred thousand codes — with
// LOINC's own consumer-friendly name for each.
// Output: .cache/medicine/loinc/tests.json
import fs from 'node:fs';
import path from 'node:path';
import { cacheDir, log, writeJson } from './lib.mjs';
import { parseCsv, readZipEntry } from './lib/zip.mjs';

const dir = path.join(cacheDir, 'loinc');

/** "Hemoglobin, Blood" → "Hemoglobin"; the specimen is a column of its own. */
function splitConsumerName(name) {
  const match = String(name ?? '').match(/^(.*?),\s*([^,]+)$/);
  return match ? { name: match[1].trim(), specimen: match[2].trim() } : { name: String(name ?? '').trim(), specimen: null };
}

function main() {
  const zips = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /^Loinc_[\d.]+\.zip$/i.test(f)).sort() : [];
  if (!zips.length) {
    // Like the NHS step without its key: the pipeline goes on without lab tests.
    log(`loinc: no LOINC release in ${path.relative(process.cwd(), dir)} — skipped (register free at loinc.org, download "LOINC Complete" under Get LOINC → Downloads, and put the zip there)`);
    return;
  }
  const file = zips[zips.length - 1];
  const version = file.match(/^Loinc_([\d.]+)\.zip$/i)[1];
  const zip = fs.readFileSync(path.join(dir, file));
  log(`loinc: reading ${file}`);

  const orders = parseCsv(readZipEntry(zip, 'LoincUniversalLabOrdersValueSet.csv').toString('utf8'));
  const consumer = new Map(parseCsv(readZipEntry(zip, 'ConsumerName.csv').toString('utf8')).map((row) => [row.LoincNumber, row.ConsumerName]));
  const core = new Map(
    parseCsv(readZipEntry(zip, 'LoincTableCore.csv').toString('utf8'))
      .filter((row) => row.STATUS === 'ACTIVE')
      .map((row) => [row.LOINC_NUM, row]),
  );

  const tests = [];
  for (const order of orders) {
    const code = order.LOINC_NUM;
    const row = core.get(code);
    if (!row) continue;
    const { name, specimen } = splitConsumerName(consumer.get(code));
    tests.push({
      code,
      long_name: order.LONG_COMMON_NAME || row.LONG_COMMON_NAME,
      short_name: row.SHORTNAME || null,
      consumer_name: name || null,
      specimen: specimen || row.SYSTEM || null,
      component: row.COMPONENT || null,
      class: row.CLASS || null,
      order_obs: order.ORDER_OBS || null,
    });
  }

  writeJson(path.join(dir, 'tests.json'), { version, file, generated_at: new Date().toISOString(), tests });
  log(`loinc: ${tests.length} commonly ordered tests from LOINC ${version} → .cache/medicine/loinc/tests.json`);
}

try {
  main();
} catch (error) {
  console.error(error.message ?? error);
  process.exitCode = 1;
}
