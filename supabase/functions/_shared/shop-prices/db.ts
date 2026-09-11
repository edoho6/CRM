// The database side of the job, over a Supabase client.
//
// Only the client's two methods the job needs are named here, so the tests
// can hand in a plain object and the Edge Function hands in the real client
// (service role, injected by Supabase — never in a file). Every write goes
// through one of the migration's functions; nothing here touches a table
// directly except the read of the store list.

import { JobError } from './errors.ts';
import type { Bookmark, Db, FinishInput, OfferPayload, StoreRow, UpsertStats } from './types.ts';

interface Answer {
  data: unknown;
  error: { message: string; code?: string } | null;
}

export interface SqlClient {
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<Answer>;
  from(table: string): { select(columns: string): PromiseLike<Answer> };
}

const STORE_COLUMNS =
  'id, slug, name, base_url, platform, status, config, crawl_delay_ms, bookmark, refresh_requested_at, last_started_at, last_completed_at, last_success_at, last_error_at, consecutive_failures';

async function answer(promise: PromiseLike<Answer>, what: string): Promise<unknown> {
  const { data, error } = await promise;
  if (error) throw new JobError(`db_${what}`, error.message);
  return data;
}

export function createDb(client: SqlClient): Db {
  return {
    async listStores(): Promise<StoreRow[]> {
      const rows = await answer(client.from('shop_stores').select(STORE_COLUMNS), 'stores');
      return (rows ?? []) as StoreRow[];
    },
    async claimStore(storeId: string, runId: string): Promise<StoreRow | null> {
      const row = await answer(client.rpc('shop_claim_store', { p_store: storeId, p_run: runId }), 'claim');
      return (row as StoreRow | null) ?? null;
    },
    async saveBookmark(storeId: string, bookmark: Bookmark | null): Promise<void> {
      await answer(client.rpc('shop_save_bookmark', { p_store: storeId, p_bookmark: bookmark }), 'bookmark');
    },
    async upsertOffers(storeId: string, runId: string, offers: OfferPayload[]): Promise<UpsertStats> {
      const result = await answer(
        client.rpc('shop_upsert_offers', { p_store: storeId, p_run: runId, p_offers: offers }),
        'upsert',
      );
      const stats = (result ?? {}) as Partial<UpsertStats>;
      return {
        new_products: stats.new_products ?? 0,
        new_offers: stats.new_offers ?? 0,
        updated: stats.updated ?? 0,
        price_changes: stats.price_changes ?? 0,
      };
    },
    async finishRun(input: FinishInput): Promise<number> {
      const marked = await answer(
        client.rpc('shop_finish_run', {
          p_store: input.storeId,
          p_run: input.runId,
          p_trigger: input.trigger,
          p_ok: input.ok,
          p_partial: input.partial,
          p_error: input.error,
          p_stats: input.stats,
        }),
        'finish',
      );
      return typeof marked === 'number' ? marked : 0;
    },
  };
}
