'use server';

import { consentDocumentSchema, patientConsentSchema, signatureSchema } from '@clinic/domain';
import { getClinicScope } from '@/lib/session';
import { actionError, actionOk, type ActionResult } from '@/lib/errors';

/**
 * Consent.
 *
 * Both writes here are one-way. Publishing a document allocates its version in
 * the database rather than in this process, so two people publishing at once
 * cannot land on the same number. Recording a decision only ever inserts —
 * withdrawing is its own decision, and the table refuses updates outright.
 */

export async function publishConsentDocument(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));

  const parsed = consentDocumentSchema.safeParse(input);
  if (!parsed.success) return actionError(new Error('validation'));

  const { data, error } = await scope.supabase.rpc('publish_consent_document', {
    p_kind: parsed.data.kind,
    p_locale: parsed.data.locale,
    p_title: parsed.data.title,
    p_body: parsed.data.body,
  });

  if (error) return actionError(error);
  return actionOk({ id: data as string });
}

/**
 * Records that a patient granted or withdrew a consent.
 *
 * The document is required to grant and not to withdraw: a consent that cites
 * no text is the checkbox this replaces, but a patient may withdraw a consent
 * given before the clinic versioned anything.
 */
export async function recordConsent(
  input: unknown,
  signature?: unknown,
): Promise<ActionResult<{ id: string }>> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));

  const parsed = patientConsentSchema.safeParse(input);
  if (!parsed.success) return actionError(new Error('validation'));

  const parsedSignature =
    signature === undefined || signature === null ? null : signatureSchema.safeParse(signature);
  if (parsedSignature && !parsedSignature.success) return actionError(new Error('validation'));

  const { data, error } = await scope.supabase
    .from('patient_consents')
    .insert({
      ...parsed.data,
      clinic_id: scope.context.clinic.id,
      recorded_by: scope.context.membership.user_id,
    })
    .select('id')
    .single<{ id: string }>();

  if (error) return actionError(error);

  /*
   * The signature goes in second, and a failure here does not undo the consent.
   *
   * The decision is the thing that has to be recorded — a patient who withdrew
   * consent and whose signature failed to save has still withdrawn it, and
   * rolling the decision back to keep the two in step would be the wrong way
   * round. The consent simply carries no signature, which is exactly how every
   * consent recorded before this feature existed reads.
   */
  if (parsedSignature?.success) {
    await scope.supabase.from('signatures').insert({
      clinic_id: scope.context.clinic.id,
      patient_id: parsed.data.patient_id,
      consent_id: data.id,
      method: parsedSignature.data.method,
      content: parsedSignature.data.content,
      witnessed_by: scope.context.membership.user_id,
    });
  }

  return actionOk({ id: data.id });
}
