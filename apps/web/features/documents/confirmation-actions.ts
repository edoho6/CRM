'use server';

import { treatmentConfirmationSchema } from '@clinic/domain';
import type { Patient, Profile } from '@clinic/db/types';
import { getClinicScope } from '@/lib/session';
import { actionError, actionOk, type ActionResult } from '@/lib/errors';

/**
 * Issuing a treatment confirmation.
 *
 * Every printed detail is copied onto the row rather than left to be looked up
 * again. That is the whole design: a confirmation is a statement made to a third
 * party on a particular day, and it has to keep saying what it said. A patient
 * who later changes their surname, a practitioner who updates their
 * certification number, a visit that is corrected or deleted — none of those may
 * silently rewrite a document that has already been handed over.
 *
 * It is not a receipt and not a tax document. Those come from a licensed
 * invoicing provider, and the printed page says so on its face.
 */
export async function issueTreatmentConfirmation(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));

  const parsed = treatmentConfirmationSchema.safeParse(input);
  if (!parsed.success) return actionError(new Error('validation'));

  const [patientResult, profileResult] = await Promise.all([
    scope.supabase
      .from('patients')
      .select('id, full_name, national_id')
      .eq('id', parsed.data.patient_id)
      .maybeSingle<Pick<Patient, 'id' | 'full_name' | 'national_id'>>(),
    scope.supabase
      .from('profiles')
      .select('id, full_name, title, license_number, national_id')
      .eq('id', scope.context.membership.user_id)
      .maybeSingle<Pick<Profile, 'id' | 'full_name' | 'title' | 'license_number' | 'national_id'>>(),
  ]);

  const patient = patientResult.data;
  const profile = profileResult.data;

  if (!patient) return actionError(new Error('patient_not_found'));

  // A confirmation with no practitioner name is not a confirmation of anything.
  // Refused here rather than printed blank, with a message that says where to
  // go and fix it.
  if (!profile?.full_name?.trim()) {
    return actionError(new Error('practitioner_details_missing'));
  }

  const { data, error } = await scope.supabase
    .from('treatment_confirmations')
    .insert({
      clinic_id: scope.context.clinic.id,
      patient_id: patient.id,
      practitioner_id: profile.id,
      treatment_dates: parsed.data.treatment_dates,
      practitioner_name: profile.full_name,
      practitioner_national_id: profile.national_id,
      practitioner_title: profile.title,
      practitioner_license: profile.license_number,
      patient_name: patient.full_name,
      patient_national_id: patient.national_id,
      purpose: parsed.data.purpose,
      notes: parsed.data.notes,
      issued_by: scope.context.membership.user_id,
    })
    .select('id')
    .single<{ id: string }>();

  if (error) return actionError(error);
  return actionOk({ id: data.id });
}

/**
 * Deletes one.
 *
 * Offered because a confirmation issued to the wrong patient, or with the wrong
 * dates, is a document that should not stay on the record as if it were correct.
 * The deletion is written to the audit log by the table's own trigger, so
 * removing it is itself recorded.
 */
export async function deleteTreatmentConfirmation(id: string): Promise<ActionResult> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));

  const { error } = await scope.supabase.from('treatment_confirmations').delete().eq('id', id);
  if (error) return actionError(error);
  return actionOk();
}
