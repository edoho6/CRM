// Loads the canon into the database (migration 72): the entries with Bara's dose,
// every name they answer to, the passages with their vectors, and the pregnancy
// note. Runs as the platform admin, who types the email and password at the
// terminal; no service key. Everything already loaded is replaced.
//
//   node --max-old-space-size=8192 scripts/library/canon/build.mjs   (once, if the index is not built)
//   node --max-old-space-size=8192 scripts/library/canon/load.mjs
import { log, sleep } from '../../medicine/lib.mjs';
import { connectAsAdmin } from '../lib/upload.mjs';
import { canonForLoading } from './engine.mjs';

const DIM = 1024;
const STATEMENT_TIMEOUT = /statement timeout|canceling statement/i;

async function rpc(supabase, fn, args, label) {
  for (let attempt = 1; ; attempt += 1) {
    const { data, error } = await supabase.rpc(fn, args);
    if (!error) return data;
    if (STATEMENT_TIMEOUT.test(error.message)) throw Object.assign(new Error(`${fn} (${label}): ${error.message}`), { timeout: true });
    const transient = /fetch failed|network|ECONNRESET|ETIMEDOUT|socket|502|503|504/i.test(error.message);
    if (!transient || attempt >= 5) throw new Error(`${fn} (${label}): ${error.message}`);
    log(`${fn}: ${error.message}; trying again in ${attempt * 5}s`);
    await sleep(attempt * 5000);
  }
}

/** Rows in batches; a batch the database cannot write in time is halved, down to one. */
async function inBatches(supabase, fn, rows, size, label) {
  let done = 0;
  let step = size;
  let lastShown = 0;
  while (done < rows.length) {
    const batch = rows.slice(done, done + step);
    try {
      await rpc(supabase, fn, { p: batch }, `${label} ${done + 1}–${done + batch.length}`);
      done += batch.length;
      if (done - lastShown >= size * 20 || done === rows.length) {
        log(`${label}: ${done} of ${rows.length}`);
        lastShown = done;
      }
    } catch (error) {
      if (!error.timeout || step === 1) throw error;
      step = Math.max(1, Math.floor(step / 2));
      log(`${label}: batch too slow, now ${step} at a time`);
    }
  }
}

/**
 * Characters Postgres will not hold in text: the NUL byte ("unsupported Unicode
 * escape sequence" — two passages of the psyche book carried one from the PDF
 * text layer and stopped the first load at passage 29,701) and the other control
 * codes, bar tab and newline.
 */
const CONTROL = new RegExp('[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f]', 'g');
const clean = (text) => String(text ?? '').replace(CONTROL, '');

/** `--from=29701` continues a load that stopped: the entries and names are in, the passages before that number too. */
const from = Number(process.argv.find((a) => a.startsWith('--from='))?.slice(7) ?? 0);

const canon = canonForLoading();
log(`canon on disk: ${canon.entries.length} entries, ${canon.rows.length} names, ${canon.passages.length} passages`);
const supabase = await connectAsAdmin();
try {
  if (!from) {
    await rpc(supabase, 'canon_clear', {}, 'clear');
    await inBatches(supabase, 'canon_add_entries', canon.entries, 100, 'entries');
    await inBatches(supabase, 'canon_add_names', canon.rows, 1000, 'names');
  } else log(`continuing from passage ${from}`);
  const passages = canon.passages
    .map((p, i) => ({
      book: p.book,
      entry: p.entry ?? null,
      section: p.section ?? null,
      heading: clean(p.heading),
      page: p.page ?? null,
      text: clean(p.text),
      // Five decimals are what a half-precision vector keeps anyway, and they halve the upload.
      embedding: Array.from(canon.vectors.subarray(i * DIM, (i + 1) * DIM), (v) => Math.round(v * 1e5) / 1e5),
    }))
    .slice(from ? from - 1 : 0);
  await inBatches(supabase, 'canon_add_passages', passages, 100, 'passages');
  await rpc(supabase, 'canon_set_note', { p_name: 'pregnancy_points', p_content: canon.pregnancyNote }, 'note');
  log('canon loaded');
} finally {
  await supabase.auth.signOut({ scope: 'local' });
}
process.exit(0);
