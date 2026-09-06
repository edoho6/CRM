'use server';

import { appointmentFormSchema, type AppointmentStatus } from '@clinic/domain';
import { getClinicScope } from '@/lib/session';
import { actionError, actionOk, type ActionResult } from '@/lib/errors';

/**
 * Appointment mutations.
 *
 * None of these check for a clashing booking first. The database enforces that with
 * an exclusion constraint, so a clash comes back as error 23P01 and is translated
 * into "this practitioner already has an overlapping appointment". Checking in
 * application code as well would add a race window without adding safety.
 */

export async function createAppointment(input: unknown): Promise<ActionResult<{ id: string }>> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));

  const parsed = appointmentFormSchema.safeParse(input);
  if (!parsed.success) return actionError(new Error('validation'));

  const { data, error } = await scope.supabase
    .from('appointments')
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

export async function updateAppointment(id: string, input: unknown): Promise<ActionResult> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));

  const parsed = appointmentFormSchema.safeParse(input);
  if (!parsed.success) return actionError(new Error('validation'));

  const { error } = await scope.supabase.from('appointments').update(parsed.data).eq('id', id);

  if (error) return actionError(error);
  return actionOk();
}

export async function setAppointmentStatus(
  id: string,
  status: AppointmentStatus,
  cancelledReason?: string | null,
): Promise<ActionResult> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));

  const { error } = await scope.supabase
    .from('appointments')
    .update({
      status,
      // The database trigger stamps cancelled_at and clears both fields when a
      // booking is un-cancelled, so only the reason is set here.
      cancelled_reason: status === 'cancelled' ? (cancelledReason ?? null) : null,
    })
    .eq('id', id);

  if (error) return actionError(error);
  return actionOk();
}

export async function deleteAppointment(id: string): Promise<ActionResult> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));

  const { error } = await scope.supabase.from('appointments').delete().eq('id', id);
  if (error) return actionError(error);
  return actionOk();
}
