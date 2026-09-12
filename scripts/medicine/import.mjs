// Step 8 — loading the dataset into the database, as the platform admin,
// through med_import (migration 42). The web app holds no service key and
// this script holds none either: it signs in as a person who is on the
// platform list, and the database checks that on every call.
//
//   node scripts/medicine/import.mjs
//
// The script asks for the address and the password at the terminal (the
// password unseen), so they are never on a command line, never in a file in
// the tree and never in a chat; MED_IMPORT_EMAIL / MED_IMPORT_PASSWORD in
// the environment answer the questions for an unattended run. `--sandbox`
// uses the smoke account from apps/web/.env.test.local instead, which only
// works if that account is a platform admin. Entries go first, twenty-five
// at a time; the links follow once every entry they point at exists.
import path from 'node:path';
import { createRequire } from 'node:module';
import { args, datasetFile, env, log, readGzipJson, root } from './lib.mjs';
import { ask } from './lib/prompt.mjs';

const { createClient } = createRequire(path.join(root, 'apps', 'web', 'package.json'))('@supabase/supabase-js');

async function main() {
  const options = args();
  const url = env('NEXT_PUBLIC_SUPABASE_URL');
  const anonKey = env('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  if (!url || !anonKey) throw new Error('NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are not set (apps/web/.env.local)');

  const dataset = readGzipJson(datasetFile);
  if (!dataset) throw new Error(`no dataset at ${datasetFile} — run build.mjs first`);
  log(`import: ${dataset.entries.length} entries, ${dataset.links.length} links (built ${dataset.generated_at})`);

  const email = options.sandbox ? env('SMOKE_EMAIL') : process.env.MED_IMPORT_EMAIL || (await ask('Platform admin email: '));
  const password = options.sandbox ? env('SMOKE_PASSWORD') : process.env.MED_IMPORT_PASSWORD || (await ask('Password (not shown): ', { hidden: true }));
  if (!email || !password) throw new Error(options.sandbox ? 'SMOKE_EMAIL / SMOKE_PASSWORD are not set (apps/web/.env.test.local)' : 'an email and a password are needed (a platform admin)');

  const supabase = createClient(url, anonKey, { auth: { persistSession: false } });
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) throw new Error(`sign-in failed: ${signInError.message}`);

  try {
    const totals = { entries: 0, links: 0, skipped_links: 0 };
    // Twenty-five at a time: a drug entry carries its label's sections as
    // quotes, and a hundred of those is more than one request should hold.
    const chunk = 25;
    for (let i = 0; i < dataset.entries.length; i += chunk) {
      const { data, error } = await supabase.rpc('med_import', { p_entries: dataset.entries.slice(i, i + chunk), p_links: [] });
      if (error) throw new Error(`med_import (entries ${i}–${i + chunk}): ${error.message}`);
      totals.entries += data.entries;
      log(`import: ${Math.min(i + chunk, dataset.entries.length)}/${dataset.entries.length} entries`);
    }
    for (let i = 0; i < dataset.links.length; i += 500) {
      const { data, error } = await supabase.rpc('med_import', { p_entries: [], p_links: dataset.links.slice(i, i + 500) });
      if (error) throw new Error(`med_import (links ${i}–${i + 500}): ${error.message}`);
      totals.links += data.links;
      totals.skipped_links += data.skipped_links;
    }
    log(`import: done — ${totals.entries} entries, ${totals.links} links (${totals.skipped_links} links skipped: an end outside the corpus)`);
  } finally {
    await supabase.auth.signOut();
  }
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exitCode = 1;
});
