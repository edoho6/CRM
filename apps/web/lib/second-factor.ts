import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Whether this session still owes its second factor.
 *
 * Supabase marks a session with `aal1` after the password and `aal2` after
 * the code from the authenticator app. An account that has enrolled a
 * factor has `nextLevel` = aal2; a session that has not given the code is
 * still at aal1. The database refuses such a session every clinic-scoped
 * row (migration 39), so this is only the question of where to send the
 * person — the answer to "may they see anything" is already no.
 */
export async function needsSecondFactor(supabase: SupabaseClient): Promise<boolean> {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error || !data) return false;
  return data.nextLevel === 'aal2' && data.currentLevel !== 'aal2';
}

/** The account's verified authenticator, if it has one. */
export async function verifiedTotpFactor(supabase: SupabaseClient): Promise<{ id: string } | null> {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error || !data) return null;
  const factor = data.totp.find((entry) => entry.status === 'verified');
  return factor ? { id: factor.id } : null;
}
