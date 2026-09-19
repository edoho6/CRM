'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getBrowserClient } from '@clinic/db/browser';

/** Memoised browser Supabase client. Null while the app is unconfigured. */
export function useSupabase(): SupabaseClient | null {
  return useMemo(() => getBrowserClient(), []);
}

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/**
 * Small data-fetching hook used by dashboard widgets.
 *
 * Widgets fetch their own data rather than receiving it from the dashboard page.
 * That is what keeps the registry honest: adding a widget must not require editing
 * a central query. Row Level Security is what makes it safe to query from the
 * browser at all.
 *
 * `initial` is the same data, computed by the page on the server for the
 * widgets it knows how to (see `features/dashboard/loaders.ts`). With it the
 * widget renders its numbers in the first HTML and never shows a spinner;
 * the first fetch is skipped, and `reload` — or a change in `deps` — fetches
 * as before. Without it, the widget loads in the browser exactly as it
 * always did, which is also what happens when the server's query failed.
 */
export function useAsyncData<T>(
  fetcher: (supabase: SupabaseClient) => Promise<T>,
  deps: unknown[] = [],
  options: { initial?: T } = {},
): AsyncState<T> {
  const supabase = useSupabase();
  const hasInitial = options.initial !== undefined;
  const [data, setData] = useState<T | null>(hasInitial ? (options.initial as T) : null);
  const [loading, setLoading] = useState(!hasInitial && supabase !== null);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const skipFirstFetch = useRef(hasInitial);

  const reload = useCallback(() => setNonce((value) => value + 1), []);

  // A new question (a reload, or a change in `deps`) is "loading" from the render
  // that asks it — set here, not in the effect below, which only fetches and
  // answers from its callbacks.
  const asked = [nonce, ...deps];
  const [seenAsked, setSeenAsked] = useState(asked);
  if (asked.length !== seenAsked.length || asked.some((value, index) => !Object.is(value, seenAsked[index]))) {
    setSeenAsked(asked);
    if (supabase) {
      setLoading(true);
      setError(null);
    }
  }

  useEffect(() => {
    if (!supabase) return;
    if (skipFirstFetch.current) {
      skipFirstFetch.current = false;
      return;
    }

    let cancelled = false;

    fetcher(supabase)
      .then((result) => {
        if (cancelled) return;
        setData(result);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : 'error');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, nonce, ...deps]);

  return { data, loading, error, reload };
}
