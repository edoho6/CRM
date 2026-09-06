/**
 * Supabase environment access.
 *
 * The app deliberately boots without credentials so `pnpm dev` works the moment the
 * repo is cloned: every entry point checks `isSupabaseConfigured()` first and renders
 * the setup guide instead of crashing with a stack trace nobody can act on.
 */

export const SUPABASE_URL_VAR = 'NEXT_PUBLIC_SUPABASE_URL';
export const SUPABASE_ANON_KEY_VAR = 'NEXT_PUBLIC_SUPABASE_ANON_KEY';

export interface SupabaseEnv {
  url: string;
  anonKey: string;
}

/** Reads the public Supabase settings, or null when either is missing/blank. */
export function readSupabaseEnv(): SupabaseEnv | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

export function isSupabaseConfigured(): boolean {
  return readSupabaseEnv() !== null;
}

/** Names of the variables that still need a value — shown on the setup screen. */
export function missingSupabaseEnvVars(): string[] {
  const missing: string[] = [];
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) missing.push(SUPABASE_URL_VAR);
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()) missing.push(SUPABASE_ANON_KEY_VAR);
  return missing;
}

/** Use only where a client is genuinely required; callers must guard first. */
export function requireSupabaseEnv(): SupabaseEnv {
  const env = readSupabaseEnv();
  if (!env) {
    throw new Error(
      `Supabase is not configured. Set ${SUPABASE_URL_VAR} and ${SUPABASE_ANON_KEY_VAR} in .env.local.`,
    );
  }
  return env;
}

/** Absolute site URL, needed to build magic-link redirects. */
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, '');
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel}`;
  return 'http://localhost:3000';
}
