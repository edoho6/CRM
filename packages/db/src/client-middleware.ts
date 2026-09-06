import { createServerClient } from '@supabase/ssr';
import type { NextRequest, NextResponse } from 'next/server';
import { readSupabaseEnv } from './env';

/**
 * Refreshes the Supabase auth session on every request.
 *
 * Access tokens are short lived. Without this the user gets signed out mid-visit,
 * so the refreshed cookies are written onto the response the locale middleware already
 * produced — that keeps one response object and avoids losing the `/he` `/en` rewrite.
 *
 * Returns the user (or null) so the caller can gate routes without a second round trip.
 */
export async function refreshSession(
  request: NextRequest,
  response: NextResponse,
): Promise<{ userId: string | null }> {
  const env = readSupabaseEnv();
  if (!env) return { userId: null };

  const supabase = createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  try {
    const { data } = await supabase.auth.getUser();
    return { userId: data.user?.id ?? null };
  } catch {
    // A network blip while refreshing must not take the whole app down; treat as signed out.
    return { userId: null };
  }
}
