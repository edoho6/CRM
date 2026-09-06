'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { readSupabaseEnv } from './env';

let cached: SupabaseClient | null = null;

/**
 * Browser Supabase client (singleton).
 *
 * Returns null when the app has no credentials yet, so client components can render
 * a disabled state instead of throwing during the initial setup phase.
 */
export function getBrowserClient(): SupabaseClient | null {
  if (cached) return cached;
  const env = readSupabaseEnv();
  if (!env) return null;
  cached = createBrowserClient(env.url, env.anonKey);
  return cached;
}
