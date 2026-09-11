import type { FormField } from '../schemas/forms';

/**
 * A questionnaire in steps, one section per screen.
 *
 * On a phone a thirty-question intake on one page is a wall; the sections
 * the clinic already writes into it are natural screens. A section field
 * begins a step and stays inside it, so the renderer still shows its
 * paragraph at the top; the questions before the first section form an
 * untitled first step; a section with no questions after it is dropped,
 * because a heading with nothing under it is not a step. A questionnaire
 * without sections is one step, which is exactly what it was.
 */
export interface FormStep {
  /** The section's text, or null for the questions before any section. */
  title: string | null;
  fields: FormField[];
}

export function splitIntoSteps(fields: readonly FormField[]): FormStep[] {
  const steps: FormStep[] = [];
  let current: FormStep = { title: null, fields: [] };
  const hasQuestions = (step: FormStep) => step.fields.some((field) => field.type !== 'section');

  for (const field of fields) {
    if (field.type === 'section') {
      if (hasQuestions(current)) steps.push(current);
      current = { title: field.label, fields: [field] };
      continue;
    }
    current.fields.push(field);
  }
  if (hasQuestions(current)) steps.push(current);

  return steps.length > 0 ? steps : [{ title: null, fields: [...fields] }];
}

/** The first step holding any of these field ids — where to send someone back to. */
export function firstStepWith(steps: readonly FormStep[], ids: readonly string[]): number {
  const wanted = new Set(ids);
  const index = steps.findIndex((step) => step.fields.some((field) => wanted.has(field.id)));
  return Math.max(0, index);
}

/** The ids of the fields on one step, for validating that step alone. */
export function stepFieldIds(step: FormStep): string[] {
  return step.fields.map((field) => field.id);
}
