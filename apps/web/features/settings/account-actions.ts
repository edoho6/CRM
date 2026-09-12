'use server';

import { getClinicScope } from '@/lib/session';
import { actionError, actionOk, type ActionResult } from '@/lib/errors';

export type DeletionOutcome =
  | { status: 'deleted' }
  | { status: 'needs_review'; blocker: 'clinic_has_records' | 'clinic_needs_owner' };

/**
 * Deleting one's own account.
 *
 * The database does the deleting (`request_account_deletion`, migration 40)
 * and decides what that means for this person: a member of staff leaves a
 * tombstone the signed records point at; a clinic's only owner is refused
 * while the clinic has patients or other members, and told why. The reason
 * is optional and kept with the request, nothing more.
 *
 * On success the session is already dead on the server; the cookies are
 * cleared here and the page sends the person to the sign-in form.
 */
export async function deleteOwnAccount(reason: string): Promise<ActionResult<DeletionOutcome>> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));

  const { data, error } = await scope.supabase.rpc('request_account_deletion', {
    p_reason: reason.trim().slice(0, 500) || null,
  });
  if (error) return actionError(error);

  const outcome = (data ?? {}) as { status?: string; blocker?: string };
  if (outcome.status === 'deleted') {
    await scope.supabase.auth.signOut({ scope: 'local' });
    return actionOk({ status: 'deleted' });
  }
  const blocker = outcome.blocker === 'clinic_needs_owner' ? 'clinic_needs_owner' : 'clinic_has_records';
  return actionOk({ status: 'needs_review', blocker });
}
