import 'server-only';

import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { readSupabaseEnv, requireSupabaseEnv } from './env';

/**
 * Server-side Supabase client bound to the request's cookies.
 *
 * Call this inside Server Components, Server Actions and Route Handlers. Every query
 * made through it runs as the signed-in user, so Row Level Security — not application
 * code — decides which rows come back.
 */
export async function createServerSupabase(): Promise<SupabaseClient> {
  const env = requireSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot set cookies. The middleware already refreshed the
          // session for this request, so ignoring this is safe.
        }
      },
    },
  });
}

/** Same as `createServerSupabase`, but returns null instead of throwing when unconfigured. */
export async function tryCreateServerSupabase(): Promise<SupabaseClient | null> {
  if (!readSupabaseEnv()) return null;
  return createServerSupabase();
}

/**
 * The signed-in user, or null. Never throws — an unconfigured or signed-out app both
 * come back as "no user" so layouts can redirect rather than error.
 */
export async function getCurrentUser() {
  const supabase = await tryCreateServerSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user ?? null;
}
