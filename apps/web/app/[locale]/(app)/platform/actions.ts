'use server';

import { revalidatePath } from 'next/cache';
import { getClinicScope } from '@/lib/session';
import { actionError, actionOk, type ActionResult } from '@/lib/errors';

/**
 * Marks a deletion request as handled — after the clinic was handed over
 * or closed by hand. The database checks the platform list again; this
 * only carries the note.
 */
export async function resolveDeletionRequest(id: string, note: string): Promise<ActionResult> {
  const scope = await getClinicScope();
  if (!scope || !scope.context.isPlatformAdmin) return actionError(new Error('forbidden'));
  if (!/^[0-9a-f-]{36}$/i.test(id)) return actionError(new Error('validation'));

  const { error } = await scope.supabase.rpc('platform_resolve_deletion_request', {
    p_id: id,
    p_note: note.trim().slice(0, 500) || null,
  });
  if (error) return actionError(error);
  revalidatePath('/[locale]/platform', 'page');
  return actionOk();
}
