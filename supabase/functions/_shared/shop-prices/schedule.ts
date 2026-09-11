// Which store this tick reads.
//
// One store per tick, in this order: a store an admin asked to refresh; a
// store whose last pass stopped partway (the bookmark is set); the active
// store that has gone longest without a complete pass, once it has gone at
// least twenty hours. A store another tick is still working on is skipped,
// and one that failed three times in a row is left alone for six hours.
// Nothing due → null, and the tick does nothing at all.

import type { StoreRow } from './types.ts';

export const CLAIM_STALE_MS = 3 * 60_000;
export const DAILY_MS = 20 * 60 * 60_000;
export const BACKOFF_MS = 6 * 60 * 60_000;
export const MAX_FAILURES = 3;

function at(value: string | null): number | null {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

export function isClaimed(store: StoreRow, nowMs: number): boolean {
  const started = at(store.last_started_at);
  if (started === null) return false;
  const completed = at(store.last_completed_at);
  const running = completed === null || completed < started;
  return running && started > nowMs - CLAIM_STALE_MS;
}

export function inBackoff(store: StoreRow, nowMs: number): boolean {
  if (store.consecutive_failures < MAX_FAILURES) return false;
  const errored = at(store.last_error_at);
  return errored !== null && errored > nowMs - BACKOFF_MS;
}

function oldestFirst(key: (store: StoreRow) => number | null) {
  return (a: StoreRow, b: StoreRow) => (key(a) ?? -Infinity) - (key(b) ?? -Infinity);
}

export function pickStore(stores: StoreRow[], nowMs: number): StoreRow | null {
  const eligible = stores.filter(
    (store) => store.status === 'active' && !isClaimed(store, nowMs) && !inBackoff(store, nowMs),
  );

  const requested = eligible
    .filter((store) => store.refresh_requested_at)
    .sort(oldestFirst((store) => at(store.refresh_requested_at)));
  if (requested.length > 0) return requested[0];

  const unfinished = eligible
    .filter((store) => store.bookmark !== null)
    .sort(oldestFirst((store) => at(store.last_completed_at)));
  if (unfinished.length > 0) return unfinished[0];

  const due = eligible
    .filter((store) => {
      const success = at(store.last_success_at);
      return success === null || success <= nowMs - DAILY_MS;
    })
    .sort(oldestFirst((store) => at(store.last_success_at)));
  return due[0] ?? null;
}
