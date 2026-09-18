'use server';

import { z } from 'zod';
import { VISIT_PAYMENT_METHODS } from '@clinic/domain';
import { getAbilities, getScopeWithAbility } from '@/lib/session';
import { actionError, actionOk, type ActionResult } from '@/lib/errors';

/**
 * "Paid" without an invoice (migration 20260919100000).
 *
 * A visit paid in cash or by Bit is marked on the booking itself: when, how,
 * and by whom. The appointment's own policies decide whether this person may
 * write that row; the money check here is so a role that never sees money
 * cannot set it through the action either — the screens do not offer it, and
 * an action is an address anyone signed in can post to.
 */

const markSchema = z.object({
  appointmentId: z.string().uuid(),
  method: z.enum(VISIT_PAYMENT_METHODS).nullable(),
});

export async function markAppointmentPaid(
  appointmentId: string,
  method: string | null,
): Promise<ActionResult> {
  const parsed = markSchema.safeParse({ appointmentId, method });
  if (!parsed.success) return actionError(new Error('validation'));

  const scope = await getScopeWithAbility('money');
  if (!scope) return actionError(new Error('unauthorized'));
  if (!(await getAbilities()).money) return actionError(new Error('forbidden'));

  const { data, error } = await scope.supabase
    .from('appointments')
    .update({
      paid_at: new Date().toISOString(),
      paid_method: parsed.data.method,
      paid_by: scope.context.membership.user_id,
    })
    .eq('id', parsed.data.appointmentId)
    .select('id');
  if (error) return actionError(error);
  // No row back means the policy hid it: not this clinic's, or not this person's.
  if (!data || data.length === 0) return actionError(new Error('not_found'));
  return actionOk();
}

/** Takes the hand mark away; an invoice, if there is one, speaks for itself again. */
export async function unmarkAppointmentPaid(appointmentId: string): Promise<ActionResult> {
  const parsed = z.string().uuid().safeParse(appointmentId);
  if (!parsed.success) return actionError(new Error('validation'));

  const scope = await getScopeWithAbility('money');
  if (!scope) return actionError(new Error('unauthorized'));
  if (!(await getAbilities()).money) return actionError(new Error('forbidden'));

  const { data, error } = await scope.supabase
    .from('appointments')
    .update({ paid_at: null, paid_method: null, paid_by: null })
    .eq('id', parsed.data)
    .select('id');
  if (error) return actionError(error);
  if (!data || data.length === 0) return actionError(new Error('not_found'));
  return actionOk();
}
