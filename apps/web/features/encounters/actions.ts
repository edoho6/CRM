'use server';

import { tcmNoteSchema, dayBoundsIn } from '@clinic/domain';
import { getScopeWithAbility } from '@/lib/session';
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
  const scope = await getScopeWithAbility('clinicalRecords');
  if (!scope) return actionError(new Error('unauthorized'));

  // Re-open the existing draft rather than creating a second record for the same
  // appointment — clicking "start treatment" twice is a normal thing to do.
  if (appointmentId) {
    const { data: existing } = await scope.supabase
      .from('encounters')
      .select('id')
      .eq('appointment_id', appointmentId)
      .limit(1)
      .returns<{ id: string }[]>();
    if (existing?.[0]) return actionOk({ id: existing[0].id });
  }

  /*
   * Started from the patient's file rather than from the diary, so no
   * appointment was named — but there almost always is one, and it is the thing
   * that knows what time the patient was actually seen.
   *
   * So it is looked up: today's appointment for this patient, not cancelled, not
   * already attached to another record. That makes the link a fact about the
   * visit rather than an artefact of which button was pressed, and it is what
   * lets the treatment list show the booked time instead of the moment someone
   * started typing.
   *
   * Only when exactly one candidate exists. Two appointments in one day is a
   * real thing, and guessing between them would put the wrong time on a record.
   */
  let resolvedAppointmentId = appointmentId ?? null;

  if (!resolvedAppointmentId) {
    // Today in the clinic's zone. The server runs in UTC, and its "today"
    // began at 02:00 or 03:00 Israel time, so an appointment at 01:30 — or any
    // treatment started before three in the morning — looked for yesterday's.
    const { start: startOfDay, end: endOfDay } = dayBoundsIn(
      new Date(),
      scope.context.clinic.timezone,
    );

    const { data: candidates } = await scope.supabase
      .from('appointments')
      .select('id, encounter:encounters(id)')
      .eq('patient_id', patientId)
      .neq('status', 'cancelled')
      .gte('start_at', startOfDay.toISOString())
      .lt('start_at', endOfDay.toISOString())
      .limit(3)
      .returns<{ id: string; encounter: { id: string } | null }[]>();

    const unattached = (candidates ?? []).filter((row) => !row.encounter);
    if (unattached.length === 1) resolvedAppointmentId = unattached[0]!.id;
  }

  const { data, error } = await scope.supabase
    .from('encounters')
    .insert({
      clinic_id: scope.context.clinic.id,
      patient_id: patientId,
      appointment_id: resolvedAppointmentId,
      practitioner_id: scope.context.membership.user_id,
      created_by: scope.context.membership.user_id,
    })
    .select('id')
    .single<{ id: string }>();

  if (error) {
    // Two clicks in quick succession, or two tabs: the second insert loses on
    // the one-record-per-appointment rule, and the right answer is the record
    // the first one made — not an error for a thing that has just succeeded.
    if (error.code === '23505' && resolvedAppointmentId) {
      const { data: winner } = await scope.supabase
        .from('encounters')
        .select('id')
        .eq('appointment_id', resolvedAppointmentId)
        .limit(1)
        .returns<{ id: string }[]>();
      if (winner?.[0]) return actionOk({ id: winner[0].id });
    }
    return actionError(error);
  }

  // The note row is created by hand and is the record's body; an encounter
  // without one is a header with no page. Losing that race to a concurrent
  // click is fine — the row exists either way.
  const { error: noteError } = await scope.supabase.from('tcm_notes').insert({
    clinic_id: scope.context.clinic.id,
    encounter_id: data.id,
  });

  if (noteError && noteError.code !== '23505') return actionError(noteError);

  return actionOk({ id: data.id });
}

export async function saveEncounterNote(
  encounterId: string,
  input: unknown,
): Promise<ActionResult> {
  const scope = await getScopeWithAbility('clinicalRecords');
  if (!scope) return actionError(new Error('unauthorized'));

  const parsed = tcmNoteSchema.safeParse(input);
  if (!parsed.success) return actionError(new Error('validation'));

  const { data, error } = await scope.supabase
    .from('tcm_notes')
    .update(parsed.data)
    .eq('encounter_id', encounterId)
    .select('id');

  // The database refuses edits to a signed record; surface that as a translated
  // message rather than a generic failure.
  if (error) return actionError(error);

  // Nothing was updated: the record has no note row (a start that lost its
  // second insert), or the row is not this person's to write. The autosave
  // used to say "saved" either way while nothing was kept. The row is made
  // now, with what was typed; if that is refused too, the screen says so.
  if (!data || data.length === 0) {
    const { error: insertError } = await scope.supabase.from('tcm_notes').insert({
      ...parsed.data,
      clinic_id: scope.context.clinic.id,
      encounter_id: encounterId,
    });
    if (insertError) return actionError(insertError);
  }
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
  const scope = await getScopeWithAbility('clinicalRecords');
  if (!scope) return actionError(new Error('unauthorized'));

  const { error } = await scope.supabase.rpc('sign_encounter', {
    p_encounter_id: encounterId,
  });

  if (error) return actionError(error);
  return actionOk();
}

/**
 * Reopens a signed record for editing, with a reason.
 *
 * The database function keeps the earlier signature in encounter_signatures
 * and puts the record back to draft; the audit log records every change
 * after that, and the record has to be signed again.
 */
export async function reopenEncounter(encounterId: string, reason: string): Promise<ActionResult> {
  const scope = await getScopeWithAbility('clinicalRecords');
  if (!scope) return actionError(new Error('unauthorized'));
  const trimmed = reason.trim();
  if (!trimmed || trimmed.length > 500) return actionError(new Error('validation'));

  const { error } = await scope.supabase.rpc('reopen_encounter', {
    p_encounter_id: encounterId,
    p_reason: trimmed,
  });

  if (error) return actionError(error);
  return actionOk();
}

export async function updateEncounterDate(
  encounterId: string,
  encounterDate: string,
): Promise<ActionResult> {
  const scope = await getScopeWithAbility('clinicalRecords');
  if (!scope) return actionError(new Error('unauthorized'));

  if (!/^\d{4}-\d{2}-\d{2}$/.test(encounterDate)) return actionError(new Error('validation'));

  const { data, error } = await scope.supabase
    .from('encounters')
    .update({ encounter_date: encounterDate })
    .eq('id', encounterId)
    .select('id')
    .maybeSingle<Pick<Encounter, 'id'>>();

  if (error) return actionError(error);
  // No row came back: the date was not changed, whatever the reason. Saying
  // "saved" here was the silent kind of failure.
  if (!data) return actionError(new Error('not_found'));
  return actionOk();
}
