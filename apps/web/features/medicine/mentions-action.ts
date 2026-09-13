'use server';

import { findMentions, type MedicineMention } from '@clinic/domain';
import { getClinicScope } from '@/lib/session';
import { actionError, actionOk, type ActionResult } from '@/lib/errors';
import { loadMedicineNameIndex } from './name-index';

/** More than a medical-history field ever holds; anything longer is not a field. */
const MAX_CHARS = 4000;
/** Chips are a hint, not an inventory: a paragraph that names twelve drugs shows twelve. */
const MAX_MENTIONS = 12;

/**
 * The entries a piece of a patient's file mentions. The text is patient data:
 * it is matched here, in memory, against the reference's names, and goes
 * nowhere else — not into a log, not to a service.
 */
export async function findMedicineMentions(text: string): Promise<ActionResult<MedicineMention[]>> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));
  const clean = String(text ?? '').slice(0, MAX_CHARS);
  if (clean.trim().length < 3) return actionOk([]);
  try {
    const index = await loadMedicineNameIndex(scope.supabase);
    return actionOk(findMentions(clean, index).slice(0, MAX_MENTIONS));
  } catch (error) {
    return actionError(error as Error);
  }
}
