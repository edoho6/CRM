// Loading into the database as the platform admin, through the library's
// own functions — no service key, the same way the medicine import works.
import path from 'node:path';
import { createRequire } from 'node:module';
import { env, log, root, sleep } from '../../medicine/lib.mjs';
import { ask } from '../../medicine/lib/prompt.mjs';

const { createClient } = createRequire(path.join(root, 'apps', 'web', 'package.json'))('@supabase/supabase-js');

/** Passages per call: each carries a 1,024-number vector, and fifty of those is a few hundred kilobytes. */
const CHUNK_BATCH = 50;

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
  for (let i = 0; i < chunks.length; i += CHUNK_BATCH) {
    added += await call(supabase, 'library_add_chunks', { p_source: id, p_chunks: chunks.slice(i, i + CHUNK_BATCH) }, `${source.title} ${i}`);
  }
  return { id, added };
}

export async function removeSource(supabase, id, title) {
  await call(supabase, 'library_remove_source', { p_source: id }, title);
}
