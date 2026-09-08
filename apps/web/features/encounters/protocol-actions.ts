'use server';

import { treatmentProtocolSchema } from '@clinic/domain';
import type { DispensingRecord, Herb, TcmNote } from '@clinic/db/types';
import { getClinicScope } from '@/lib/session';
import { actionError, actionOk, type ActionResult } from '@/lib/errors';

/** Just enough of a dispensing record to rebuild a protocol's prescription. */
interface PrescriptionSnapshot
  extends Pick<
    DispensingRecord,
    | 'formula_id'
    | 'preparation'
    | 'days_supply'
    | 'dose_amount'
    | 'dose_unit'
    | 'dose_timing'
    | 'doses_per_day'
  > {
  items: {
    herb_id: string | null;
    custom_name: string | null;
    quantity: number;
    preparation: string | null;
    herb: Pick<Herb, 'id' | 'pinyin_name' | 'english_name' | 'hebrew_name'> | null;
  }[];
}

/**
 * Treatment protocols — saving one, editing it, retiring it.
 *
 * Applying a protocol needs no action of its own: it is a copy from one form's
 * state into another's, which happens in the browser and is saved by the note's
 * own save. Routing it through the server would make an un-saved fill-in look
 * like a committed change.
 */

/**
 * Saves the treatment on screen as a protocol.
 *
 * Reads the record from the database rather than taking the form's current
 * state, which is the point: what is saved is the treatment that was actually
 * given, not whatever is half-typed in an unsaved field. It also lets one button
 * capture both halves — the note's points live in `tcm_notes`, the prescription
 * in `dispensing_records`, and no single component on the page holds both.
 *
 * The most recent prescription is the one taken. A visit with two is a
 * correction far more often than it is two prescriptions, and the later one is
 * the correction.
 */
export async function saveProtocolFromEncounter(
  encounterId: string,
  name: string,
  description: string,
): Promise<ActionResult<{ id: string }>> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));

  if (!name.trim()) return actionError(new Error('validation'));

  const [noteResult, dispensingResult] = await Promise.all([
    scope.supabase
      .from('tcm_notes')
      .select('points_used, treatment_principle, tcm_pattern_diagnosis')
      .eq('encounter_id', encounterId)
      .maybeSingle<
        Pick<TcmNote, 'points_used' | 'treatment_principle' | 'tcm_pattern_diagnosis'>
      >(),
    scope.supabase
      .from('dispensing_records')
      .select(
        'formula_id, preparation, days_supply, dose_amount, dose_unit, dose_timing, doses_per_day,' +
          ' items:dispensing_items(herb_id, custom_name, quantity, preparation,' +
          ' herb:herbs(id, pinyin_name, english_name, hebrew_name))',
      )
      .eq('encounter_id', encounterId)
      .order('dispensed_at', { ascending: false })
      .limit(1)
      .maybeSingle<PrescriptionSnapshot>(),
  ]);

  const note = noteResult.data;
  const prescription = dispensingResult.data;

  const payload = {
    name: name.trim(),
    description: description.trim(),
    // The pattern is what the protocol is *for*, which is how it will be looked
    // for later — so it seeds the indications rather than being dropped.
    indications: note?.tcm_pattern_diagnosis ?? '',
    treatment_principle: note?.treatment_principle ?? '',
    points_used: note?.points_used ?? [],
    formula_id: prescription?.formula_id ?? null,
    herbs: (prescription?.items ?? [])
      .map((item) => ({
        herb_id: item.herb_id,
        /*
         * The name is stored beside the id so a protocol still reads after a
         * herb is retired from the catalogue. Pinyin first because that is the
         * name a prescription is written in; the localised names are a fallback
         * for a herb that has no pinyin recorded, and a line the catalogue never
         * carried has only what was typed.
         */
        name:
          item.custom_name ??
          item.herb?.pinyin_name ??
          item.herb?.english_name ??
          item.herb?.hebrew_name ??
          '',
        quantity: item.quantity,
        preparation: item.preparation ?? '',
      }))
      // A line with no name at all would fail validation and take the whole
      // protocol down with it. There is nothing to save in such a line anyway.
      .filter((herb) => herb.name.trim().length > 0),
    preparation: prescription?.preparation ?? '',
    days_supply: prescription?.days_supply ?? '',
    dose_amount: prescription?.dose_amount ?? '',
    dose_unit: prescription?.dose_unit ?? '',
    dose_timing: prescription?.dose_timing ?? '',
    doses_per_day: prescription?.doses_per_day ?? '',
    is_active: true,
  };

  return createProtocol(payload);
}

export async function createProtocol(input: unknown): Promise<ActionResult<{ id: string }>> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));

  const parsed = treatmentProtocolSchema.safeParse(input);
  if (!parsed.success) return actionError(new Error('validation'));

  const { data, error } = await scope.supabase
    .from('treatment_protocols')
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

export async function updateProtocol(id: string, input: unknown): Promise<ActionResult> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));

  const parsed = treatmentProtocolSchema.safeParse(input);
  if (!parsed.success) return actionError(new Error('validation'));

  const { error } = await scope.supabase
    .from('treatment_protocols')
    .update(parsed.data)
    .eq('id', id);

  if (error) return actionError(error);
  return actionOk();
}

/**
 * Retires a protocol rather than deleting it.
 *
 * Deleting is offered too, below, but this is the one the button calls: a
 * protocol that is no longer used should stop appearing in the picker, and
 * "delete" is a heavier promise than the situation usually needs.
 */
export async function setProtocolActive(id: string, isActive: boolean): Promise<ActionResult> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));

  const { error } = await scope.supabase
    .from('treatment_protocols')
    .update({ is_active: isActive })
    .eq('id', id);

  if (error) return actionError(error);
  return actionOk();
}

export async function deleteProtocol(id: string): Promise<ActionResult> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));

  // Nothing references a protocol — a treatment started from one carries a copy,
  // not a link — so deleting cannot orphan a clinical record.
  const { error } = await scope.supabase.from('treatment_protocols').delete().eq('id', id);

  if (error) return actionError(error);
  return actionOk();
}
