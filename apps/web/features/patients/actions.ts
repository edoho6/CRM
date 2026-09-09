'use server';

import { z } from 'zod';
import {
  TREATMENT_STATUSES,
  patientFormSchema,
  patientMedicalHistorySchema,
  patientTagLinksSchema,
} from '@clinic/domain';
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
export async function saveMedicalHistory(patientId: string, input: unknown): Promise<ActionResult> {
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

/**
 * Sets the patient's status, from the list or from anywhere else.
 *
 * `is_active` is not written here: a trigger derives it from the status, so the
 * two cannot drift apart no matter which code path did the update. That is also
 * why the old `setPatientActive` is gone — writing the flag directly was exactly
 * the thing that let a file be active and "stopped partway" at once.
 *
 * The value is re-validated even though the caller is a `<select>` with a fixed
 * option list, because a Server Action is a public endpoint and the option list
 * is a suggestion to the browser rather than a constraint on the request.
 */
export async function setPatientStatus(id: string, status: unknown): Promise<ActionResult> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));

  const parsed = z.enum(TREATMENT_STATUSES).safeParse(status);
  if (!parsed.success) return actionError(new Error('validation'));

  const { error } = await scope.supabase
    .from('patients')
    .update({ treatment_status: parsed.data })
    .eq('id', id);

  if (error) return actionError(error);
  return actionOk();
}

/**
 * Sets the whole set of tags on one file.
 *
 * Replace rather than toggle: the picker shows every tag with a tick, and
 * "save what is ticked" cannot drift out of step with the screen the way a
 * sequence of add/remove calls can when one of them fails halfway.
 *
 * Removals first, then additions, each as one statement. The unique
 * constraint on (patient, tag) makes a repeat harmless.
 */
export async function setPatientTags(input: unknown): Promise<ActionResult> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));

  const parsed = patientTagLinksSchema.safeParse(input);
  if (!parsed.success) return actionError(new Error('validation'));

  const { patient_id, tag_ids } = parsed.data;
  const wanted = new Set(tag_ids);

  const { data: current, error: readError } = await scope.supabase
    .from('patient_tag_links')
    .select('tag_id')
    .eq('patient_id', patient_id)
    .returns<{ tag_id: string }[]>();
  if (readError) return actionError(readError);

  const have = new Set((current ?? []).map((row) => row.tag_id));
  const toRemove = [...have].filter((id) => !wanted.has(id));
  const toAdd = [...wanted].filter((id) => !have.has(id));

  if (toRemove.length > 0) {
    const { error } = await scope.supabase
      .from('patient_tag_links')
      .delete()
      .eq('patient_id', patient_id)
      .in('tag_id', toRemove);
    if (error) return actionError(error);
  }

  if (toAdd.length > 0) {
    const { error } = await scope.supabase.from('patient_tag_links').insert(
      toAdd.map((tag_id) => ({
        patient_id,
        tag_id,
        clinic_id: scope.context.clinic.id,
        created_by: scope.context.membership.user_id,
      })),
    );
    if (error) return actionError(error);
  }

  return actionOk();
}

/** A tag typed into the picker that does not exist yet: made, and returned so it can be ticked. */
export async function createPatientTagInline(name: string): Promise<ActionResult<{ id: string }>> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));

  const trimmed = name.trim();
  if (trimmed.length === 0 || trimmed.length > 60) return actionError(new Error('validation'));

  const { data, error } = await scope.supabase
    .from('patient_tags')
    .insert({ name: trimmed, clinic_id: scope.context.clinic.id })
    .select('id')
    .single<{ id: string }>();

  if (error) return actionError(error);
  return actionOk({ id: data.id });
}
