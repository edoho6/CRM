// The library's websites, refreshed.
//
// Runs inside Supabase (Edge Functions) on a schedule and looks again at
// the pages of the professional library that have gone a week without a
// look — at most forty a run, for at most fifty seconds, one request a
// second per site, conditionally, so an unchanged page costs its site a
// 304. The logic is in ../_shared/library/refresh.ts, which the web app's
// tests exercise with fakes; this file wires it to Deno, to Voyage and to
// the database.
//
// Why here and not in the web app: the library is one shared shelf for
// every clinic, and the web app holds no identity that may write to it —
// by design, it has no service key. This function does, because Supabase
// hands it one at runtime; it never appears in the repository.
//
// Secrets, all set in the Supabase dashboard under Edge Functions → Secrets:
//   LIBRARY_REFRESH_SECRET — the schedule must send it as `x-library-refresh-secret`
//   VOYAGE_API_KEY         — for the passages' embeddings (the same key the app uses)
//   LIBRARY_CONTACT        — an email address for site owners, shown in User-Agent

import { createClient } from 'npm:@supabase/supabase-js@2';
import { createFetcher } from '../_shared/shop-prices/fetcher.ts';
import type { Logger } from '../_shared/shop-prices/types.ts';
import { refreshWebsites, sha256Hex, type ChunkPayload, type RefreshDb, type SourcePayload, type WebsiteSource } from '../_shared/library/refresh.ts';
import { embedAll } from '../_shared/library/voyage.ts';

const AGENT_TOKEN = 'herbalist-library';
/** Passages per call: each carries a 1,024-number vector, and fifty of those is a few hundred kilobytes. */
const CHUNK_BATCH = 50;

const log: Logger = {
  info: (message, data) => console.log(message, data ? JSON.stringify(data) : ''),
  warn: (message, data) => console.warn(message, data ? JSON.stringify(data) : ''),
};

Deno.serve(async (request) => {
  const secret = Deno.env.get('LIBRARY_REFRESH_SECRET');
  if (!secret || request.headers.get('x-library-refresh-secret') !== secret) {
    return new Response('Forbidden', { status: 403 });
  }
  const voyageKey = Deno.env.get('VOYAGE_API_KEY');
  if (!voyageKey) return Response.json({ error: 'VOYAGE_API_KEY is not set' }, { status: 503 });

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });
  const rpc = async <T>(fn: string, args: Record<string, unknown>): Promise<T> => {
    const { data, error } = await supabase.rpc(fn, args);
    if (error) throw new Error(`${fn}: ${error.message}`);
    return data as T;
  };
  const db: RefreshDb = {
    async staleWebsites(limit, olderThanDays) {
      const cutoff = new Date(Date.now() - olderThanDays * 86_400_000).toISOString();
      const { data, error } = await supabase
        .from('library_sources')
        .select('id, locator, url, title, sha256, etag, last_modified, licence_note, fetched_at')
        .eq('kind', 'website')
        .eq('status', 'active')
        .or(`fetched_at.is.null,fetched_at.lt.${cutoff}`)
        .order('fetched_at', { ascending: true, nullsFirst: true })
        .limit(limit);
      if (error) throw new Error(`library_sources: ${error.message}`);
      return (data ?? []) as WebsiteSource[];
    },
    upsertSource: (source: SourcePayload) => rpc<string>('library_upsert_source', { p: source }),
    clearChunks: (sourceId) => rpc<void>('library_clear_chunks', { p_source: sourceId }),
    async addChunks(sourceId, chunks: ChunkPayload[]) {
      let added = 0;
      for (let i = 0; i < chunks.length; i += CHUNK_BATCH) {
        added += await rpc<number>('library_add_chunks', { p_source: sourceId, p_chunks: chunks.slice(i, i + CHUNK_BATCH) });
      }
      return added;
    },
    touchSource: (sourceId, etag, lastModified) => rpc<void>('library_touch_source', { p_source: sourceId, p_etag: etag, p_last_modified: lastModified }),
  };

  const contact = Deno.env.get('LIBRARY_CONTACT') ?? Deno.env.get('SHOP_PRICES_CONTACT') ?? '';
  const fetcher = createFetcher({
    userAgent: `${AGENT_TOKEN}/1.0 (professional library of a clinic app; ${contact})`,
    minDelayMs: 1_000,
  });

  const outcome = await refreshWebsites({
    db,
    fetcher,
    embed: (texts) => embedAll(voyageKey, texts),
    sha256: sha256Hex,
    log,
    agentToken: AGENT_TOKEN,
    budgetMs: 50_000,
    limit: 40,
    olderThanDays: 7,
  });
  return Response.json({ ...outcome, requests: fetcher.requests });
});
