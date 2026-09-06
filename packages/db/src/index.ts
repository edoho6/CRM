/**
 * Server-side entry point for the data layer.
 *
 * This barrel pulls in `client-server`, which is marked `server-only`. Client
 * components must import from `@clinic/db/browser` (the browser client) or
 * `@clinic/db/types` (types only) instead — importing this module from the client
 * fails the build on purpose, rather than shipping server code to the browser.
 */
export {
  readSupabaseEnv,
  isSupabaseConfigured,
  missingSupabaseEnvVars,
  requireSupabaseEnv,
  siteUrl,
  SUPABASE_URL_VAR,
  SUPABASE_ANON_KEY_VAR,
  type SupabaseEnv,
} from './env';

export { createServerSupabase, tryCreateServerSupabase, getCurrentUser } from './client-server';

export * from './types';
