'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
 */
export function useAsyncData<T>(
  fetcher: (supabase: SupabaseClient) => Promise<T>,
  deps: unknown[] = [],
): AsyncState<T> {
  const supabase = useSupabase();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((value) => value + 1), []);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

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
