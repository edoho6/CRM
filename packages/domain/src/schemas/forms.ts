import { z } from 'zod';
import { optionalText, requiredText, uuidField } from './common';

/**
 * The questionnaire builder.
 *
 * A practitioner defines their own forms — intake, follow-up, an outcome scale —
 * so what is modelled is the shape of a question rather than any particular set
 * of them.
 *
 * Nine types, chosen because each one changes what an answer *is* rather than
 * only how it looks. A dropdown and a set of radio buttons both produce one
 * choice from a list, and are separate here for the same reason they are
 * separate in every form tool: five options read better as buttons and fifty
 * read better as a list, and that is the author's call rather than ours.
 */
export const FORM_FIELD_TYPES = [
  'short_text',
  'long_text',
  'number',
  'dropdown',
  'single_choice',
  'multi_choice',
  'yes_no',
  'scale',
  'date',
  /** Not a question: a heading or a paragraph of instructions between them. */
  'section',
] as const;
export type FormFieldType = (typeof FORM_FIELD_TYPES)[number];

/** Which types need an option list to make sense. */
export const CHOICE_FIELD_TYPES: readonly FormFieldType[] = [
  'dropdown',
  'single_choice',
  'multi_choice',
];

export function isChoiceField(type: FormFieldType): boolean {
  return CHOICE_FIELD_TYPES.includes(type);
}

export const formFieldSchema = z
  .object({
    /** Stable for the life of the field: answers are keyed by it. */
    id: z.string().min(1).max(40),
    type: z.enum(FORM_FIELD_TYPES),
    label: requiredText(300),
    /** Shown under the field — an example, a unit, a clarification. */
    help: optionalText(300),
    required: z.boolean().default(false),
    /** For dropdown, single choice and multi choice. */
    options: z.array(requiredText(160)).max(60).default([]),
    /** For `scale`: the ends of the range, and what they mean. */
    scale_min: z.number().int().min(0).max(100).default(0),
    scale_max: z.number().int().min(1).max(100).default(10),
    scale_min_label: optionalText(60),
    scale_max_label: optionalText(60),
  })
  .refine((field) => !isChoiceField(field.type) || field.options.length >= 2, {
    // A choice of one is not a choice, and an empty dropdown is a dead end that
    // the person filling the form cannot get past.
    error: 'choice_field_needs_two_options',
    path: ['options'],
  })
  .refine((field) => field.type !== 'scale' || field.scale_max > field.scale_min, {
    error: 'scale_max_must_exceed_min',
    path: ['scale_max'],
  });

export type FormField = z.output<typeof formFieldSchema>;

export const formTemplateSchema = z.object({
  title: requiredText(200),
  description: optionalText(1000),
  fields: z.array(formFieldSchema).max(200),
  is_active: z.boolean().default(true),
});

export type FormTemplateValues = z.input<typeof formTemplateSchema>;
export type FormTemplateData = z.output<typeof formTemplateSchema>;

/**
 * One filled-in form.
 *
 * Answers are validated against the template's own fields at submit time rather
 * than by a fixed schema here — the shape depends entirely on the form, so the
 * check lives in `validateAnswers` below, which both the browser and the Server
 * Action call.
 */
export const formSubmissionSchema = z.object({
  template_id: uuidField,
  patient_id: uuidField,
  encounter_id: z
    .union([uuidField, z.literal(''), z.null()])
    .transform((value) => (value ? value : null)),
  answers: z.record(z.string(), z.unknown()),
  notes: optionalText(2000),
});

export type FormSubmissionValues = z.input<typeof formSubmissionSchema>;

export type FormAnswer = string | number | string[] | boolean | null;

/**
 * Checks a set of answers against the questions that were asked.
 *
 * Returns the field ids that are wrong, so the form can mark them rather than
 * showing one message at the top. A section is skipped: it asks nothing, so it
 * cannot be answered wrongly.
 *
 * Required means "not empty", and empty has a different meaning per type — an
 * unticked multi-choice is an empty array, an untouched scale is undefined, and
 * a whitespace-only text box is empty however it looks.
 */
export function validateAnswers(fields: FormField[], answers: Record<string, unknown>): string[] {
  const problems: string[] = [];

  for (const field of fields) {
    if (field.type === 'section') continue;

    const value = answers[field.id];
    const empty =
      value === undefined ||
      value === null ||
      (typeof value === 'string' && value.trim() === '') ||
      (Array.isArray(value) && value.length === 0);

    if (field.required && empty) {
      problems.push(field.id);
      continue;
    }
    if (empty) continue;

    if (field.type === 'number' || field.type === 'scale') {
      if (typeof value !== 'number' || !Number.isFinite(value)) problems.push(field.id);
      else if (field.type === 'scale' && (value < field.scale_min || value > field.scale_max)) {
        problems.push(field.id);
      }
      continue;
    }

    if (field.type === 'multi_choice') {
      if (!Array.isArray(value) || value.some((entry) => !field.options.includes(String(entry)))) {
        problems.push(field.id);
      }
      continue;
    }

    if (isChoiceField(field.type)) {
      if (!field.options.includes(String(value))) problems.push(field.id);
      continue;
    }

    if (field.type === 'yes_no') {
      if (typeof value !== 'boolean') problems.push(field.id);
    }
  }

  return problems;
}
