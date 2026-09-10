import { z } from 'zod';
import {
  BODY_VIEWS,
  CONSENT_KINDS,
  CONSENT_METHODS,
  DOSE_TIMINGS,
  HERB_PREPARATIONS,
  HERB_UNITS,
  ORDER_LIST_STATUSES,
  POINT_BODY_AREAS,
  POINT_CHANNELS,
  POINT_REGIONS,
} from '../enums';
import { optionalNumber, optionalText, positiveQuantity, requiredText, uuidField } from './common';

/**
 * The reference library and the stock room.
 *
 * These two live in one file because they are defined by their separation: the
 * clinic setting below decides whether the stock room exists at all, and every
 * other schema here belongs to one side of that line or the other.
 */

/** Clinic-wide preferences the practitioner can change. */
export const clinicSettingsSchema = z.object({
  name: requiredText(160),
  /**
   * False for a practitioner who prescribes but holds nothing. Turning it off
   * hides every stock surface rather than deleting anything, so it is safe to
   * change your mind.
   */
  tracks_inventory: z.boolean().default(true),
});

export type ClinicSettingsValues = z.input<typeof clinicSettingsSchema>;

/** A point in the catalogue. Clinical text is optional — most of it is empty for now. */
export const acupuncturePointFormSchema = z.object({
  code: requiredText(16),
  channel: z.enum(POINT_CHANNELS),
  point_number: optionalNumber,
  pinyin_name: optionalText(80),
  chinese_name: optionalText(40),
  english_name: optionalText(120),
  hebrew_name: optionalText(120),
  body_view: z.enum(BODY_VIEWS).default('front'),
  x: optionalNumber,
  y: optionalNumber,
  bilateral: z.boolean().default(true),
  default_region: z.enum(POINT_REGIONS).default('upper'),
  body_area: z
    .union([z.enum(POINT_BODY_AREAS), z.literal(''), z.null()])
    .optional()
    .transform((value) => (value ? value : null)),
  location: optionalText(2000),
  actions: optionalText(2000),
  indications: optionalText(2000),
  needling: optionalText(1000),
  cautions: optionalText(1000),
  is_active: z.boolean().default(true),
});

export type AcupuncturePointFormValues = z.input<typeof acupuncturePointFormSchema>;

/**
 * A line on the order list.
 *
 * Exactly one of `herb_id` / `formula_id` is set. For a formula the quantity
 * counts doses, because that is the only unit in which a formula can be wanted.
 */
export const orderListEntrySchema = z
  .object({
    herb_id: z.union([uuidField, z.literal(''), z.null()]).transform((v) => (v ? v : null)),
    formula_id: z.union([uuidField, z.literal(''), z.null()]).transform((v) => (v ? v : null)),
    quantity: z
      .union([z.string(), z.number(), z.null()])
      .optional()
      .transform((v) => (v === null || v === undefined || v === '' ? null : Number(v)))
      .refine((v) => v === null || (Number.isFinite(v) && v > 0), { error: 'invalid_quantity' }),
    // `dose` used to be appended here because the unit list did not carry it.
    // It does now, so appending it again would list the same value twice.
    unit: z.enum(HERB_UNITS).default('gram'),
    /**
     * Part of the identity of a line, not a detail of it: dried root and powder
     * of the same herb are two orders, and were previously treated as one.
     */
    preparation: z
      .union([z.enum(HERB_PREPARATIONS), z.literal(''), z.null()])
      .transform((v) => (v ? v : null))
      .optional(),
    supplier_id: z.union([uuidField, z.literal(''), z.null()]).transform((v) => (v ? v : null)),
    status: z.enum(ORDER_LIST_STATUSES).default('pending'),
    notes: optionalText(500),
  })
  .refine((value) => Boolean(value.herb_id) !== Boolean(value.formula_id), {
    error: 'exactly_one_target_required',
    path: ['herb_id'],
  });

export type OrderListEntryValues = z.input<typeof orderListEntrySchema>;

/** Editing a low-stock threshold straight from the stock table. */
export const thresholdUpdateSchema = z.object({
  reorder_threshold: optionalNumber,
  reorder_quantity: optionalNumber,
});

export type ThresholdUpdateValues = z.input<typeof thresholdUpdateSchema>;

export const formulaThresholdUpdateSchema = z.object({
  reorder_threshold_doses: optionalNumber,
});

/**
 * One line of a prescription.
 *
 * Either a catalogue herb or a name typed by hand — a patent remedy, a
 * supplement, something the catalogue has never carried. Refusing the second
 * kind does not stop it being prescribed; it moves the record onto paper.
 */
export const prescriptionItemSchema = z
  .object({
    herb_id: z.union([uuidField, z.literal(''), z.null()]).transform((v) => (v ? v : null)),
    name: optionalText(120),
    quantity: positiveQuantity,
    preparation: z.enum(HERB_PREPARATIONS).optional(),
    unit: z.enum(HERB_UNITS).default('gram'),
  })
  .refine((value) => Boolean(value.herb_id) || Boolean(value.name), {
    error: 'herb_or_name_required',
    path: ['herb_id'],
  });

/** Prescribing without stock: the same shape as a dispense, minus the allocation. */
export const prescriptionRequestSchema = z
  .object({
    encounter_id: uuidField,
    formula_id: z.union([uuidField, z.literal(''), z.null()]).transform((v) => (v ? v : null)),
    /** A formula that is not in the catalogue, recorded as one named line. */
    custom_formula: optionalText(160),
    multiplier: z
      .union([z.string(), z.number()])
      .transform((v) => (typeof v === 'number' ? v : Number(v)))
      .pipe(z.number().positive().max(1000))
      .default(1),
    /** How the whole prescription is made up. The unit follows from it. */
    preparation: z.enum(HERB_PREPARATIONS).optional(),
    /**
     * Free text, not a number of days. Practitioners write "10 days", "שבועיים
     * ואז נראה", "until the next visit" — and the part that carries the
     * instruction is exactly the part an integer would throw away.
     */
    days_supply: optionalText(80),
    /**
     * How the patient takes it: how much at a time, in what unit, and when
     * relative to eating. Three fields because they are three separate facts,
     * and all three end up on the label.
     */
    dose_amount: optionalNumber,
    dose_unit: z
      .union([z.enum(HERB_UNITS), z.literal(''), z.null()])
      .transform((v) => (v ? v : null))
      .optional(),
    dose_timing: z
      .union([z.enum(DOSE_TIMINGS), z.literal(''), z.null()])
      .transform((v) => (v ? v : null))
      .optional(),
    doses_per_day: optionalNumber,
    items: z.array(prescriptionItemSchema).default([]),
    notes: optionalText(1000),
  })
  .refine(
    (value) => Boolean(value.formula_id) || Boolean(value.custom_formula) || value.items.length > 0,
    {
      error: 'formula_or_items_required',
      path: ['formula_id'],
    },
  );

export type PrescriptionRequestValues = z.input<typeof prescriptionRequestSchema>;

/* ---------------------------------------------------------------------------
 * Consent
 * ------------------------------------------------------------------------- */

/** Publishing a new version of a document. Once published the text is frozen. */
export const consentDocumentSchema = z.object({
  kind: z.enum(CONSENT_KINDS),
  locale: z.enum(['he', 'en']).default('he'),
  title: requiredText(200),
  body: requiredText(50_000, 20),
});

export type ConsentDocumentValues = z.input<typeof consentDocumentSchema>;

/**
 * Recording one decision.
 *
 * `document_id` is required when granting — a consent that cites no text is the
 * checkbox this system exists to replace. Withdrawing needs no document,
 * because you can withdraw a consent given before the clinic versioned anything.
 */
export const patientConsentSchema = z
  .object({
    patient_id: uuidField,
    document_id: z.union([uuidField, z.literal(''), z.null()]).transform((v) => (v ? v : null)),
    kind: z.enum(CONSENT_KINDS),
    granted: z.boolean(),
    method: z.enum(CONSENT_METHODS).default('in_person'),
    notes: optionalText(1000),
  })
  .refine((value) => !value.granted || Boolean(value.document_id), {
    error: 'document_required_to_grant',
    path: ['document_id'],
  });

export type PatientConsentValues = z.input<typeof patientConsentSchema>;

/**
 * A treatment type a practitioner defines for their own practice.
 *
 * The price is optional on purpose: a type without one is still usable, and the
 * invoice line stays editable for the times the standard price is wrong. Making
 * it required would mean inventing a number to get past the form.
 */
export const appointmentTypeSchema = z.object({
  name_he: requiredText(80),
  /**
   * Optional, and falls back to the Hebrew name.
   *
   * A single-practitioner Hebrew clinic has no reason to name every treatment
   * twice, and requiring it meant either an invented translation or a copy of
   * the Hebrew — both of which the calendar then displays to an English reader
   * as though they were meant. Falling back is the honest version of the same
   * thing, and it costs nothing to fill in later.
   */
  name_en: optionalText(80),
  default_duration_minutes: z
    .union([z.string(), z.number()])
    .transform((v) => (typeof v === 'number' ? v : Number(v)))
    .pipe(z.number().int().min(5).max(480))
    .default(60),
  price: optionalNumber,
  /** Hex, because that is what the calendar and the colour input both speak. */
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, { error: 'invalid_colour' })
    .default('#0e7490'),
  notes: optionalText(500),
  is_active: z.boolean().default(true),
  /** Offered on the public booking page. Off until the practitioner says so. */
  online_bookable: z.boolean().default(false),
});

export type AppointmentTypeValues = z.input<typeof appointmentTypeSchema>;
