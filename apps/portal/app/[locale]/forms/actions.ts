'use server';

import { formSubmissionSchema, signatureSchema, validateAnswers } from '@clinic/domain';
import type { FormTemplate } from '@clinic/db/types';
import { tryCreateServerSupabase } from '@clinic/db';

/**
 * A patient submitting their own questionnaire or consent, from the portal.
 *
 * Separate from the clinic's action rather than shared, and the difference is
 * the whole point: nothing here takes a patient id from the caller. It is read
 * from `current_patient_id()`, which resolves through the portal-access row for
 * the signed-in user. A patient cannot submit an answer against somebody else's
 * file even by editing the request, because the id never travels in it.
 *
 * The RLS policies for all of this already existed — `form_templates_patient_read`,
 * `form_submissions_patient_insert`, `consent_documents_patient_read`,
 * `patient_consents_patient_insert` — with no screen to use them.
 */

export interface PortalResult {
  ok: boolean;
  /** A key the caller translates. Never a database message. */
  error?: 'unauthorized' | 'validation' | 'failed';
}

export async function submitPortalForm(input: {
  template_id: string;
  answers: Record<string, unknown>;
  signature: { method: 'drawn' | 'typed'; content: string } | null;
}): Promise<PortalResult> {
  const supabase = await tryCreateServerSupabase();
  if (!supabase) return { ok: false, error: 'unauthorized' };

  const { data: patientId } = await supabase.rpc('current_patient_id');
  if (!patientId) return { ok: false, error: 'unauthorized' };

  // The template is re-read here rather than trusted from the browser: the
  // questions a submission records have to be the questions the clinic
  // published, not the ones the page happened to be holding.
  const { data: template } = await supabase
    .from('form_templates')
    .select('id, fields, version, is_active')
    .eq('id', input.template_id)
    .maybeSingle<Pick<FormTemplate, 'id' | 'fields' | 'version' | 'is_active'>>();

  if (!template?.is_active) return { ok: false, error: 'unauthorized' };

  // The same check the browser ran, against the same function. A Server Action
  // is a public endpoint; "the form would not let me" constrains nobody who
  // does not use the form.
  if (validateAnswers(template.fields, input.answers).length > 0) {
    return { ok: false, error: 'validation' };
  }

  const parsed = formSubmissionSchema.safeParse({
    template_id: template.id,
    patient_id: patientId,
    encounter_id: null,
    answers: input.answers,
    notes: '',
  });
  if (!parsed.success) return { ok: false, error: 'validation' };

  const { data, error } = await supabase
    .from('form_submissions')
    .insert({
      template_id: template.id,
      patient_id: patientId,
      template_version: template.version,
      fields: template.fields,
      answers: parsed.data.answers,
      submitted_by: null,
    })
    .select('id')
    .single<{ id: string }>();

  if (error) return { ok: false, error: 'failed' };

  if (input.signature) {
    const parsedSignature = signatureSchema.safeParse(input.signature);
    // A signature that fails to save does not undo the answers: the
    // questionnaire has still been filled in, and losing it would be the worse
    // outcome by far.
    if (parsedSignature.success) {
      await supabase.from('signatures').insert({
        patient_id: patientId,
        form_submission_id: data.id,
        method: parsedSignature.data.method,
        content: parsedSignature.data.content,
      });
    }
  }

  return { ok: true };
}

export async function recordPortalConsent(input: {
  document_id: string;
  kind: 'terms' | 'privacy' | 'treatment' | 'marketing';
  granted: boolean;
  signature: { method: 'drawn' | 'typed'; content: string } | null;
}): Promise<PortalResult> {
  const supabase = await tryCreateServerSupabase();
  if (!supabase) return { ok: false, error: 'unauthorized' };

  const { data: patientId } = await supabase.rpc('current_patient_id');
  if (!patientId) return { ok: false, error: 'unauthorized' };

  const { data, error } = await supabase
    .from('patient_consents')
    .insert({
      patient_id: patientId,
      document_id: input.granted ? input.document_id : null,
      kind: input.kind,
      // The policy requires this exact value, so a portal decision can never be
      // recorded as though it had been given in the room.
      method: 'portal',
      granted: input.granted,
    })
    .select('id')
    .single<{ id: string }>();

  if (error) return { ok: false, error: 'failed' };

  if (input.signature) {
    const parsedSignature = signatureSchema.safeParse(input.signature);
    if (parsedSignature.success) {
      await supabase.from('signatures').insert({
        patient_id: patientId,
        consent_id: data.id,
        method: parsedSignature.data.method,
        content: parsedSignature.data.content,
      });
    }
  }

  return { ok: true };
}
