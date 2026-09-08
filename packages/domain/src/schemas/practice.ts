import { z } from 'zod';
import { optionalText, requiredText, uuidField } from './common';

/**
 * Signatures, packages and treatment confirmations.
 *
 * Grouped by what they serve rather than by table: all three exist because a
 * clinic in Israel has to be able to hand a patient a piece of paper — a signed
 * consent, a punch card with a balance, a statement of the dates they were
 * treated for their health fund to accept.
 */

/* ---------------------------------------------------------------------------
 * Signatures
 * ------------------------------------------------------------------------ */

export const SIGNATURE_METHODS = ['drawn', 'typed'] as const;
export type SignatureMethod = (typeof SIGNATURE_METHODS)[number];

/**
 * `content` is a PNG data URL when drawn and the typed name when not.
 *
 * The data URL is checked for shape rather than decoded: this is written by our
 * own canvas, and the useful guard is against something that is plainly not an
 * image arriving in a column the print view will put inside an `<img>`.
 */
export const signatureSchema = z
  .object({
    method: z.enum(SIGNATURE_METHODS),
    content: z.string().min(1).max(262144),
  })
  .refine(
    (value) =>
      value.method === 'typed'
        ? value.content.trim().length >= 2
        : /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(value.content),
    { error: 'invalid_signature', path: ['content'] },
  );

export type SignatureValues = z.input<typeof signatureSchema>;

/* ---------------------------------------------------------------------------
 * The practitioner's own details
 * ------------------------------------------------------------------------ */

/**
 * What goes on a treatment confirmation.
 *
 * The national ID is validated for shape only — nine digits — and not against
 * the check digit. A practitioner typing their own number into their own
 * profile is not the threat model, and refusing a legitimate number because the
 * checksum implementation is wrong is a worse failure than accepting a typo
 * they can see on the printed page.
 */
export const practitionerProfileSchema = z.object({
  full_name: requiredText(120),
  national_id: z
    .union([z.string().regex(/^\d{9}$/, { error: 'invalid_national_id' }), z.literal('')])
    .transform((value) => (value ? value : null)),
  phone: optionalText(40),
  email: optionalText(160),
  address: optionalText(200),
});

export type PractitionerProfileValues = z.input<typeof practitionerProfileSchema>;

/* ---------------------------------------------------------------------------
 * Treatment packages
 * ------------------------------------------------------------------------ */

export const patientPackageSchema = z
  .object({
    patient_id: uuidField,
    name: requiredText(120),
    total_sessions: z
      .union([z.string(), z.number()])
      .transform((v) => (typeof v === 'number' ? v : Number(v)))
      .pipe(z.number().int().min(1).max(200)),
    price: z
      .union([z.string(), z.number(), z.null()])
      .transform((v) => (v === '' || v === null ? null : Number(v)))
      .pipe(z.number().min(0).nullable()),
    purchased_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: 'invalid_date' }),
    // Blank means it does not expire, which is the common case and must not be
    // turned into a date far in the future.
    expires_on: z
      .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal(''), z.null()])
      .transform((value) => (value ? value : null)),
    notes: optionalText(1000),
    is_active: z.boolean().default(true),
  })
  .refine((value) => !value.expires_on || value.expires_on >= value.purchased_on, {
    error: 'expiry_before_purchase',
    path: ['expires_on'],
  });

export type PatientPackageValues = z.input<typeof patientPackageSchema>;

export const packageRedemptionSchema = z.object({
  package_id: uuidField,
  // Optional: a treatment recorded before the card was set up is still
  // redeemable, and a late cancellation charged to the card has no treatment.
  encounter_id: z
    .union([uuidField, z.literal(''), z.null()])
    .transform((value) => (value ? value : null)),
  redeemed_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: 'invalid_date' }),
  notes: optionalText(500),
});

export type PackageRedemptionValues = z.input<typeof packageRedemptionSchema>;

/* ---------------------------------------------------------------------------
 * Treatment confirmations
 * ------------------------------------------------------------------------ */

/**
 * The dates a confirmation attests to.
 *
 * Sorted and de-duplicated here rather than in the form: the dates arrive from
 * two places — ticked off the record and typed by hand — and a document that
 * lists the fourth of March twice is a document a health fund will query.
 */
export const treatmentConfirmationSchema = z.object({
  patient_id: uuidField,
  treatment_dates: z
    .array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: 'invalid_date' }))
    .min(1)
    .max(200)
    .transform((dates) => [...new Set(dates)].sort()),
  purpose: optionalText(200),
  notes: optionalText(1000),
});

export type TreatmentConfirmationValues = z.input<typeof treatmentConfirmationSchema>;

/* ---------------------------------------------------------------------------
 * Tasks
 * ------------------------------------------------------------------------ */

/**
 * One item on the to-do list.
 *
 * `due_on` accepts an empty string and stores null, because "no date" is a real
 * answer and the alternative — inventing one — produces a list that nags on days
 * nobody chose until none of the dates are believed.
 */
export const clinicTaskSchema = z.object({
  title: requiredText(200),
  notes: optionalText(1000),
  due_on: z
    .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal(''), z.null()])
    .transform((value) => (value ? value : null)),
  is_urgent: z.boolean().default(false),
  patient_id: z
    .union([uuidField, z.literal(''), z.null()])
    .transform((value) => (value ? value : null)),
});

export type ClinicTaskValues = z.input<typeof clinicTaskSchema>;
