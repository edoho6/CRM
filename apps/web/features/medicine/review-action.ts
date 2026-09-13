'use server';

import { revalidatePath } from 'next/cache';
import { getClinicScope } from '@/lib/session';
import { actionError, actionOk, type ActionResult } from '@/lib/errors';

/** verified and flagged are verdicts; clear takes the entry back to what its sources said. */
export type MedicineVerdict = 'verified' | 'flagged' | 'clear';

/** Enough for a reviewer to say what is wrong; a treatise belongs in the sources. */
const MAX_NOTE = 2000;

/**
 * A person's verdict on an entry, written by med_set_status (migration 44),
 * which checks the platform list itself — the check here only spares a
 * round trip. The pages that show the status are revalidated: the entry,
 * the list, and the platform's card.
 */
export async function setMedicineStatus(id: string, verdict: MedicineVerdict, note: string): Promise<ActionResult> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));
  if (!scope.context.isPlatformAdmin) return actionError(new Error('forbidden'));
  const clean = String(note ?? '').trim().slice(0, MAX_NOTE);
  if (verdict === 'flagged' && !clean) return actionError(new Error('note_required'));

  const { error } = await scope.supabase.rpc('med_set_status', { p_id: id, p_status: verdict, p_note: clean || null });
  if (error) return actionError(error);

  revalidatePath('/[locale]/(app)/reference/medicine/[slug]', 'page');
  revalidatePath('/[locale]/(app)/reference/medicine', 'page');
  revalidatePath('/[locale]/(app)/platform', 'page');
  return actionOk();
}
