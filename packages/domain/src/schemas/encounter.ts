import { z } from 'zod';
import {
  NEEDLE_TECHNIQUES,
  POINT_PLACEMENTS,
  POINT_SIDES,
  TREATMENT_MODALITIES,
  toPointPlacement,
} from '../enums';
import { optionalNumber, optionalText, requiredText } from './common';

/**
 * One acupuncture point selected during a treatment, stored inside
 * `tcm_notes.points_used`.
 *
 * `point` is whatever the practitioner typed and is the only required part, so
 * a point that is not in the catalogue — an extra point, an ashi point, a
 * personal shorthand — can still be recorded. `point_id` is set only when the
 * entry was chosen from the catalogue, and it is what lets the body map draw a
 * dot and the note link through to the point's page.
 *
 * `side` is still read so notes written before regions existed keep opening.
 */
export const acupuncturePointSchema = z.object({
  point: requiredText(24),
  point_id: z
    .union([z.string().uuid(), z.literal(''), z.null(), z.undefined()])
    .transform((value) => (value ? value : null)),
  // Read leniently: a note saved before placements existed carries one of the
  // five old flat regions, and it has to keep opening. The translation happens
  // here rather than in the editor so every reader of a note gets it.
  region: z
    .unknown()
    .transform(toPointPlacement)
    .pipe(z.enum(POINT_PLACEMENTS))
    .default('right'),
  side: z.enum(POINT_SIDES).optional(),
  technique: z.enum(NEEDLE_TECHNIQUES).default('even'),
  retention_minutes: optionalNumber,
  notes: optionalText(200),
});

export type AcupuncturePoint = z.output<typeof acupuncturePointSchema>;

/**
 * The structured TCM treatment note.
 *
 * Field set follows the standard TCM intake/treatment flow: complaint, the four
 * examinations (with tongue and pulse split out because they are the two that get
 * looked up historically), pattern differentiation, treatment principle, then what
 * was actually done.
 */
export const tcmNoteSchema = z.object({
  chief_complaint: optionalText(1000),
  history_of_present_illness: optionalText(4000),

  // Inspection / palpation
  tongue_body_color: optionalText(120),
  tongue_shape: optionalText(120),
  tongue_coating: optionalText(120),
  tongue_notes: optionalText(1000),
  pulse_left: optionalText(120),
  pulse_right: optionalText(120),
  pulse_qualities: z.array(z.string().max(40)).default([]),
  pulse_notes: optionalText(1000),

  // Differentiation
  tcm_pattern_diagnosis: optionalText(1000),
  western_diagnosis: optionalText(1000),
  treatment_principle: optionalText(1000),

  // Treatment delivered
  modalities_used: z.array(z.enum(TREATMENT_MODALITIES)).default([]),
  points_used: z.array(acupuncturePointSchema).default([]),
  treatment_notes: optionalText(4000),
  recommendations: optionalText(4000),
  follow_up_plan: optionalText(2000),
});

export type TcmNoteValues = z.input<typeof tcmNoteSchema>;
export type TcmNoteData = z.output<typeof tcmNoteSchema>;

export const encounterFormSchema = z.object({
  patient_id: z.string().uuid(),
  appointment_id: z
    .union([z.string().uuid(), z.literal(''), z.null()])
    .transform((v) => (v ? v : null)),
  encounter_date: z.string().min(1),
  note: tcmNoteSchema,
});

export type EncounterFormValues = z.input<typeof encounterFormSchema>;

/* ---------------------------------------------------------------------------
 * Treatment protocols
 * ------------------------------------------------------------------------- */

/** One herb in a protocol's prescription, in the shape `record_prescription` takes. */
export const protocolHerbSchema = z.object({
  herb_id: z
    .union([z.string().uuid(), z.literal(''), z.null(), z.undefined()])
    .transform((value) => (value ? value : null)),
  // Kept alongside the id so a protocol still reads correctly if the herb is
  // later removed from the catalogue, and so a herb that was never in it — a
  // practitioner's own shorthand — can be listed at all.
  name: requiredText(120),
  quantity: optionalNumber,
  preparation: optionalText(40),
});

export type ProtocolHerb = z.output<typeof protocolHerbSchema>;

/**
 * A reusable point combination and prescription.
 *
 * Everything except the name is optional, because a protocol is often only half
 * of a treatment: some are a set of points with no herbs, some a formula with no
 * points. Requiring both would push practitioners into inventing filler.
 */
export const treatmentProtocolSchema = z.object({
  name: requiredText(120),
  description: optionalText(1000),
  indications: optionalText(1000),
  treatment_principle: optionalText(1000),
  points_used: z.array(acupuncturePointSchema).default([]),
  formula_id: z
    .union([z.string().uuid(), z.literal(''), z.null()])
    .transform((value) => (value ? value : null)),
  herbs: z.array(protocolHerbSchema).default([]),
  preparation: optionalText(40),
  days_supply: optionalText(40),
  dose_amount: optionalNumber,
  dose_unit: optionalText(20),
  dose_timing: optionalText(20),
  doses_per_day: optionalNumber,
  is_active: z.boolean().default(true),
});

export type TreatmentProtocolValues = z.input<typeof treatmentProtocolSchema>;
export type TreatmentProtocolData = z.output<typeof treatmentProtocolSchema>;
