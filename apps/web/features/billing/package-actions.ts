'use server';

import { packageRedemptionSchema, patientPackageSchema } from '@clinic/domain';
import { getClinicScope } from '@/lib/session';
import { actionError, actionOk, type ActionResult } from '@/lib/errors';

/**
 * Punch cards: sessions bought up front and drawn down one visit at a time.
 *
 * Nothing here counts the remaining balance before writing. The database refuses
 * a redemption past the total, in a trigger that locks the package row first —
 * checking here as well would add a race window without adding safety, which is
 * the same reasoning the appointment overlap constraint already follows.
 */

export async function createPackage(input: unknown): Promise<ActionResult<{ id: string }>> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));

  const parsed = patientPackageSchema.safeParse(input);
  if (!parsed.success) return actionError(new Error('validation'));

  const { data, error } = await scope.supabase
    .from('patient_packages')
    .insert({
      ...parsed.data,
      clinic_id: scope.context.clinic.id,
      created_by: scope.context.membership.user_id,
    })
    .select('id')
    .single<{ id: string }>();

  if (error) return actionError(error);
  return actionOk({ id: data.id });
}

export async function updatePackage(id: string, input: unknown): Promise<ActionResult> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));

  const parsed = patientPackageSchema.safeParse(input);
  if (!parsed.success) return actionError(new Error('validation'));

  const { error } = await scope.supabase
    .from('patient_packages')
    .update(parsed.data)
    .eq('id', id);

  if (error) return actionError(error);
  return actionOk();
}

/**
 * Draws one session off a card.
 *
 * `package_exhausted` comes back from the trigger, not from a check here, and is
 * translated into a message rather than shown as a generic failure — running out
 * is an ordinary thing that happens on the tenth visit of a ten-visit card.
 */
export async function redeemSession(input: unknown): Promise<ActionResult> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));

  const parsed = packageRedemptionSchema.safeParse(input);
  if (!parsed.success) return actionError(new Error('validation'));

  const { error } = await scope.supabase.from('package_redemptions').insert({
    ...parsed.data,
    clinic_id: scope.context.clinic.id,
    created_by: scope.context.membership.user_id,
  });

  if (error) {
    if (error.message?.includes('package_exhausted')) {
      return actionError(new Error('package_exhausted'));
    }
    // The unique index on (package_id, encounter_id): this treatment has
    // already been drawn off this card, which is worth saying plainly.
    if (error.code === '23505') return actionError(new Error('already_redeemed'));
    return actionError(error);
  }
  return actionOk();
}

/**
 * Puts a session back.
 *
 * A redemption is not append-only, unlike a consent. It records an
 * administrative fact rather than a clinical one, and a session drawn off the
 * wrong card has to be returnable — the audit log keeps the trace either way.
 */
export async function undoRedemption(id: string): Promise<ActionResult> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));

  const { error } = await scope.supabase.from('package_redemptions').delete().eq('id', id);
  if (error) return actionError(error);
  return actionOk();
}

export async function deletePackage(id: string): Promise<ActionResult> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));

  const { error } = await scope.supabase.from('patient_packages').delete().eq('id', id);
  if (error) return actionError(error);
  return actionOk();
}
