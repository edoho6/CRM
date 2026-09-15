'use server';

import { revalidatePath } from 'next/cache';
import { acupuncturePointFormSchema } from '@clinic/domain';
import { getClinicScope } from '@/lib/session';
import { actionError, actionOk, type ActionResult } from '@/lib/errors';

/**
 * Editing a catalogued point. Row-level security keeps the write inside the
 * practitioner's own clinic; the trigger on the table clears the review flag
 * when the clinical text changes, exactly as it does for a herb.
 */
export async function updateAcupuncturePoint(id: string, input: unknown): Promise<ActionResult> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));

  const parsed = acupuncturePointFormSchema.safeParse(input);
  if (!parsed.success) return actionError(new Error('validation'));

  const { error } = await scope.supabase
    .from('acupuncture_points')
    .update({ ...parsed.data, code: parsed.data.code.toUpperCase() })
    .eq('id', id);
  if (error) return actionError(error);

  revalidatePath('/[locale]/(app)/reference/points/[id]', 'page');
  revalidatePath('/[locale]/(app)/reference/points', 'page');
  return actionOk();
}
