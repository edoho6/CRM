#!/usr/bin/env node
// Loads test-results/catalogue/dataset.json into the shared catalogue and
// brings the caller's clinic up to date.
//
//   node scripts/catalogue/import.mjs [--kind=herbs,formulas,points] [--no-refresh] [--sandbox]
//
// catalogue_import (migration 57) accepts a platform admin only, so the
// script signs in as one — it asks for the email and the password on the
// terminal (the password is not shown), never from the command line, which
// PowerShell keeps in a history file. CATALOGUE_IMPORT_EMAIL and
// CATALOGUE_IMPORT_PASSWORD in the environment answer the questions for a
// run without a person. --sandbox signs in with the test clinic's account
// from apps/web/.env.test.local instead.
//
// After the catalogue is loaded, clinic_refresh_catalogue_text replaces the
// text of every row in the caller's clinic that nobody has confirmed;
// --no-refresh skips that step. The sign-out is local: the account's other
// sessions (the browser, another script) stay signed in.
import path from 'node:path';
import { createRequire } from 'node:module';
import { args, datasetFile, env, log, readJson, root } from './lib.mjs';
import { ask } from '../medicine/lib/prompt.mjs';

const { createClient } = createRequire(path.join(root, 'apps', 'web', 'package.json'))(
  '@supabase/supabase-js',
);

const options = args();
const kinds = String(options.kind ?? 'herbs,formulas,points')
  .split(',')
  .map((s) => s.trim());
const BATCH = 100;

async function main() {
  const url = env('NEXT_PUBLIC_SUPABASE_URL');
  const anonKey = env('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  if (!url || !anonKey)
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are not set (apps/web/.env.local)',
    );
  const dataset = readJson(datasetFile);
  if (!dataset) throw new Error(`no dataset at ${datasetFile} — run build.mjs first`);

  const email = options.sandbox
    ? env('SMOKE_EMAIL')
    : process.env.CATALOGUE_IMPORT_EMAIL || (await ask('Platform admin email: '));
  const password = options.sandbox
    ? env('SMOKE_PASSWORD')
    : process.env.CATALOGUE_IMPORT_PASSWORD ||
      (await ask('Password (not shown): ', { hidden: true }));
  if (!email || !password) throw new Error('no credentials');

  const supabase = createClient(url, anonKey, { auth: { persistSession: false } });
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) throw new Error(`sign-in failed: ${signInError.message}`);

  try {
    for (const kind of kinds) {
      const entries = dataset[kind] ?? [];
      const totals = { inserted: 0, updated: 0, unknown: 0 };
      for (let i = 0; i < entries.length; i += BATCH) {
        const { data, error } = await supabase.rpc('catalogue_import', {
          p_kind: kind,
          p_entries: entries.slice(i, i + BATCH),
        });
        if (error) throw new Error(`catalogue_import(${kind}) failed at ${i}: ${error.message}`);
        totals.inserted += data.inserted ?? 0;
        totals.updated += data.updated ?? 0;
        totals.unknown += data.unknown ?? 0;
      }
      log(
        `import: ${kind} — ${entries.length} entries: ${totals.inserted} inserted, ${totals.updated} updated${totals.unknown ? `, ${totals.unknown} unknown code(s) skipped` : ''}`,
      );
    }
    if (!options['no-refresh']) {
      const { data, error } = await supabase.rpc('clinic_refresh_catalogue_text');
      if (error) throw new Error(`clinic_refresh_catalogue_text failed: ${error.message}`);
      log(`refresh: ${JSON.stringify(data)}`);
    }
  } finally {
    await supabase.auth.signOut({ scope: 'local' });
  }
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});
