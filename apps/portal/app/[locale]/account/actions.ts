'use server';

import { redirect } from '@clinic/i18n/navigation';
import { createServerSupabase, isSupabaseConfigured } from '@clinic/db';
import type { Locale } from '@clinic/domain';

export interface DeletePortalAccountState {
  status: 'idle' | 'error';
}

/**
 * A patient deleting their sign-in to the portal.
 *
 * The database does it (`request_account_deletion`, migration 40): the
 * sign-in goes, the invitation is closed, the medical file stays with the
 * clinic under its own duty to keep it. The session is dead on the server
 * by the time this returns, so only the cookies are cleared here, and the
 * sign-in page says what happened.
 */
export async function deletePortalAccount(
  locale: Locale,
  _prevState: DeletePortalAccountState,
  formData: FormData,
): Promise<DeletePortalAccountState> {
  if (!isSupabaseConfigured()) return { status: 'error' };

  const reason = String(formData.get('reason') ?? '').trim().slice(0, 500);
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc('request_account_deletion', { p_reason: reason || null });
  const outcome = (data ?? {}) as { status?: string };
  if (error || outcome.status !== 'deleted') return { status: 'error' };

  await supabase.auth.signOut({ scope: 'local' });
  redirect({ href: '/login?deleted=1', locale });
  return { status: 'idle' };
}
