'use server';

import { patientFormSchema, patientMedicalHistorySchema } from '@clinic/domain';
import { getClinicScope } from '@/lib/session';
import { actionError, actionOk, type ActionResult } from '@/lib/errors';

/**
 * Patient mutations.
 *
 * Every action re-validates with the same zod schema the form used. The client
 * copy is for fast feedback; this one is the one that counts, because a Server
 * Action is a public endpoint.
 */

export async function createPatient(input: unknown): Promise<ActionResult<{ id: string }>> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));

  const parsed = patientFormSchema.safeParse(input);
  if (!parsed.success) return actionError(new Error('validation'));

  const { data, error } = await scope.supabase
    .from('patients')
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

export async function updatePatient(id: string, input: unknown): Promise<ActionResult> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));

  const parsed = patientFormSchema.safeParse(input);
  if (!parsed.success) return actionError(new Error('validation'));

  const { error } = await scope.supabase.from('patients').update(parsed.data).eq('id', id);

  if (error) return actionError(error);
  return actionOk();
}

/**
 * Medical background lives in its own table, so this upserts rather than updates —
 * the row is created the first time anything is recorded, not when the patient is.
 */
export async function saveMedicalHistory(
  patientId: string,
  input: unknown,
): Promise<ActionResult> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));

  const parsed = patientMedicalHistorySchema.safeParse(input);
  if (!parsed.success) return actionError(new Error('validation'));

  const { error } = await scope.supabase.from('patient_medical_history').upsert(
    {
      ...parsed.data,
      patient_id: patientId,
      clinic_id: scope.context.clinic.id,
      updated_by: scope.context.membership.user_id,
    },
    { onConflict: 'patient_id' },
  );

  if (error) return actionError(error);
  return actionOk();
}

export async function setPatientActive(id: string, isActive: boolean): Promise<ActionResult> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));

  const { error } = await scope.supabase
    .from('patients')
    .update({ is_active: isActive })
    .eq('id', id);

  if (error) return actionError(error);
  return actionOk();
}
