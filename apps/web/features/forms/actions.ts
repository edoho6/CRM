'use server';

import {
  formSubmissionSchema,
  formTemplateSchema,
  validateAnswers,
  type FormField,
} from '@clinic/domain';
import { getClinicScope } from '@/lib/session';
import { libraryEntry } from './library';
import { actionError, actionOk, type ActionResult } from '@/lib/errors';

/**
 * Questionnaire mutations.
 *
 * Both actions re-validate on the server. That is not belt-and-braces: a Server
 * Action is a public endpoint, and the browser-side check exists to give a red
 * outline quickly, not to keep anything out.
 */

/**
 * Saves a template, bumping its version when the questions have changed.
 *
 * The version is what lets an old submission still be read against the form it
 * was actually answered on. Renaming a form or turning it off does not bump it —
 * only a change to the questions can make an existing answer ambiguous.
 */
export async function saveFormTemplate(
  id: string | null,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));

  const parsed = formTemplateSchema.safeParse(input);
  if (!parsed.success) return actionError(new Error('validation'));

  const { fields, ...template } = parsed.data;

  if (id) {
    const { data: existing } = await scope.supabase
      .from('form_templates')
      .select('fields, version')
      .eq('id', id)
      .maybeSingle<{ fields: FormField[]; version: number }>();

    const questionsChanged = JSON.stringify(existing?.fields ?? []) !== JSON.stringify(fields);

    const { error } = await scope.supabase
      .from('form_templates')
      .update({
        ...template,
        fields,
        version: (existing?.version ?? 1) + (questionsChanged ? 1 : 0),
      })
      .eq('id', id);

    if (error) return actionError(error);
    return actionOk({ id });
  }

  const { data, error } = await scope.supabase
    .from('form_templates')
    .insert({
      ...template,
      fields,
      clinic_id: scope.context.clinic.id,
      created_by: scope.context.membership.user_id,
    })
    .select('id')
    .single<{ id: string }>();

  if (error) return actionError(error);
  return actionOk({ id: data.id });
}

export async function deleteFormTemplate(id: string): Promise<ActionResult> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));

  const { count } = await scope.supabase
    .from('form_submissions')
    .select('id', { count: 'exact', head: true })
    .eq('template_id', id);

  // A form that has been filled in cannot be deleted without taking the answers
  // with it, so it is retired instead: it stops being offered and every past
  // submission stays readable.
  if ((count ?? 0) > 0) {
    const { error } = await scope.supabase
      .from('form_templates')
      .update({ is_active: false })
      .eq('id', id);
    if (error) return actionError(error);
    return actionError(new Error('form_has_submissions_deactivated'));
  }

  const { error } = await scope.supabase.from('form_templates').delete().eq('id', id);
  if (error) return actionError(error);
  return actionOk();
}

/**
 * Records one filled-in form.
 *
 * The questions are copied onto the submission along with the version they came
 * from. That duplication is deliberate: a template edited next year must not
 * change what a patient appears to have answered this year, and a foreign key
 * to a mutable template cannot promise that.
 */
export async function submitForm(input: unknown): Promise<ActionResult<{ id: string }>> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));

  const parsed = formSubmissionSchema.safeParse(input);
  if (!parsed.success) return actionError(new Error('validation'));

  const { data: template, error: templateError } = await scope.supabase
    .from('form_templates')
    .select('fields, version')
    .eq('id', parsed.data.template_id)
    .maybeSingle<{ fields: FormField[]; version: number }>();

  if (templateError) return actionError(templateError);
  if (!template) return actionError(new Error('form_not_found'));

  const problems = validateAnswers(template.fields, parsed.data.answers);
  if (problems.length > 0) return actionError(new Error('answers_invalid'));

  const { data, error } = await scope.supabase
    .from('form_submissions')
    .insert({
      clinic_id: scope.context.clinic.id,
      template_id: parsed.data.template_id,
      patient_id: parsed.data.patient_id,
      encounter_id: parsed.data.encounter_id,
      template_version: template.version,
      fields: template.fields,
      answers: parsed.data.answers,
      notes: parsed.data.notes,
      submitted_by: scope.context.membership.user_id,
    })
    .select('id')
    .single<{ id: string }>();

  if (error) return actionError(error);
  return actionOk({ id: data.id });
}

/**
 * Adds one of the ready-made questionnaires to the clinic, as a form of its
 * own that can be edited afterwards. The library entry is looked up on the
 * server: the browser sends a key, never a template.
 */
export async function addFormFromLibrary(key: string): Promise<ActionResult<{ id: string }>> {
  const entry = libraryEntry(key);
  if (!entry) return actionError(new Error('not_found'));
  return saveFormTemplate(null, entry.template);
}
