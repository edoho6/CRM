// Loading into the database as the platform admin, through the library's
// own functions — no service key, the same way the medicine import works.
import path from 'node:path';
import { createRequire } from 'node:module';
import { env, log, root, sleep } from '../../medicine/lib.mjs';
import { ask } from '../../medicine/lib/prompt.mjs';

const { createClient } = createRequire(path.join(root, 'apps', 'web', 'package.json'))('@supabase/supabase-js');

/**
 * Passages per call. Each carries a 1,024-number vector and the database
 * must add every one to the vector index, and Supabase stops any one
 * statement after eight seconds: twenty fits a slow moment, and a batch
 * that still runs out of time is halved, down to one.
 */
const CHUNK_BATCH = 20;
const STATEMENT_TIMEOUT = /statement timeout/i;

export async function connectAsAdmin() {
  const url = env('NEXT_PUBLIC_SUPABASE_URL');
  const anonKey = env('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  if (!url || !anonKey) throw new Error('NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are not set (apps/web/.env.local)');
  const email = process.env.LIBRARY_ADMIN_EMAIL || (await ask('Platform admin email: '));
  const password = process.env.LIBRARY_ADMIN_PASSWORD || (await ask('Password (not shown): ', { hidden: true }));
  if (!email || !password) throw new Error('an email and a password are needed (a platform admin)');
  const supabase = createClient(url, anonKey, { auth: { persistSession: false } });
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`sign-in failed: ${error.message}`);
  return supabase;
}

async function call(supabase, fn, args, label) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      const { data, error } = await supabase.rpc(fn, args);
      if (error) throw new Error(error.message);
      return data;
    } catch (error) {
      // A statement timeout is not transient: the batch is too big for the moment, and the caller shrinks it.
      if (STATEMENT_TIMEOUT.test(error.message ?? '')) throw new Error(`${fn} (${label}): ${error.message}`);
      const transient = /fetch failed|network|ECONNRESET|ETIMEDOUT|socket|timeout|502|503|504/i.test(error.message ?? '');
      if (!transient || attempt >= 5) throw new Error(`${fn} (${label}): ${error.message}`);
      log(`upload: ${label} — ${error.message}; trying again in ${attempt * 5}s`);
      await sleep(attempt * 5000);
    }
  }
}

/** One source and all its passages, replaced whole. */
export async function uploadSource(supabase, source, chunks) {
  const id = await call(supabase, 'library_upsert_source', { p: source }, source.title);
  await call(supabase, 'library_clear_chunks', { p_source: id }, source.title);
  let added = 0;
  let batch = CHUNK_BATCH;
  for (let i = 0; i < chunks.length; ) {
    const slice = chunks.slice(i, i + batch);
    try {
      added += await call(supabase, 'library_add_chunks', { p_source: id, p_chunks: slice }, `${source.title} ${i}`);
      i += slice.length;
    } catch (error) {
      if (!STATEMENT_TIMEOUT.test(error.message) || batch === 1) throw error;
      batch = Math.max(1, Math.floor(batch / 2));
      log(`upload: ${source.title} — the database ran out of time on ${slice.length} passages; ${batch} at a time from here`);
      await sleep(2000);
    }
  }
  return { id, added };
}

export async function removeSource(supabase, id, title) {
  await call(supabase, 'library_remove_source', { p_source: id }, title);
}
