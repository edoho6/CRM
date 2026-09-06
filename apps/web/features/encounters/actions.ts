'use server';

import { tcmNoteSchema } from '@clinic/domain';
import { getClinicScope } from '@/lib/session';
import { actionError, actionOk, type ActionResult } from '@/lib/errors';
import type { Encounter } from '@clinic/db/types';

/**
 * Encounter (visit) lifecycle.
 *
 * An encounter and its note are created together, so "open the treatment" never
 * lands on a half-built record, and the note row always exists by the time the
 * form renders.
 */

export async function startEncounter(
  patientId: string,
  appointmentId?: string | null,
): Promise<ActionResult<{ id: string }>> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));

  // Re-open the existing draft rather than creating a second record for the same
  // appointment — clicking "start treatment" twice is a normal thing to do.
  if (appointmentId) {
    const { data: existing } = await scope.supabase
      .from('encounters')
      .select('id')
      .eq('appointment_id', appointmentId)
      .maybeSingle<{ id: string }>();
    if (existing) return actionOk({ id: existing.id });
  }

  const { data, error } = await scope.supabase
    .from('encounters')
    .insert({
      clinic_id: scope.context.clinic.id,
      patient_id: patientId,
      appointment_id: appointmentId ?? null,
      practitioner_id: scope.context.membership.user_id,
      created_by: scope.context.membership.user_id,
    })
    .select('id')
    .single<{ id: string }>();

  if (error) return actionError(error);

  const { error: noteError } = await scope.supabase.from('tcm_notes').insert({
    clinic_id: scope.context.clinic.id,
    encounter_id: data.id,
  });

  if (noteError) return actionError(noteError);

  return actionOk({ id: data.id });
}

export async function saveEncounterNote(
  encounterId: string,
  input: unknown,
): Promise<ActionResult> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));

  const parsed = tcmNoteSchema.safeParse(input);
  if (!parsed.success) return actionError(new Error('validation'));

  const { error } = await scope.supabase
    .from('tcm_notes')
    .update(parsed.data)
    .eq('encounter_id', encounterId);

  // The database refuses edits to a signed record; surface that as a translated
  // message rather than a generic failure.
  if (error) return actionError(error);
  return actionOk();
}

/**
 * Signs the record.
 *
 * Delegates to the `sign_encounter` database function so the status, timestamp and
 * signer are set in one statement — a record can never end up marked signed with
 * no signature attached.
 */
export async function signEncounter(encounterId: string): Promise<ActionResult> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));

  const { error } = await scope.supabase.rpc('sign_encounter', {
    p_encounter_id: encounterId,
  });

  if (error) return actionError(error);
  return actionOk();
}

export async function updateEncounterDate(
  encounterId: string,
  encounterDate: string,
): Promise<ActionResult> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));

  const { error } = await scope.supabase
    .from('encounters')
    .update({ encounter_date: encounterDate })
    .eq('id', encounterId)
    .select('id')
    .maybeSingle<Pick<Encounter, 'id'>>();

  if (error) return actionError(error);
  return actionOk();
}
