import { z } from 'zod';
import { REMIND_CHANNELS, TAG_COLORS } from '../enums';
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
  /**
   * The moment the reminder fires, as an ISO instant. Optional on top of
   * nullable so the one-line add on the dashboard need not know it exists.
   */
  due_at: z
    .union([
      z.string().refine((value) => value === '' || !Number.isNaN(Date.parse(value)), {
        error: 'invalid_datetime',
      }),
      z.null(),
      z.undefined(),
    ])
    .transform((value) => (value ? new Date(value).toISOString() : null)),
  remind_via: z.enum(REMIND_CHANNELS).default('app'),
});

export type ClinicTaskValues = z.input<typeof clinicTaskSchema>;

/* ---------------------------------------------------------------------------
 * Rooms, patient tags, reminder wording
 * ------------------------------------------------------------------------ */


export const roomSchema = z.object({
  name: requiredText(80),
  location_id: z
    .union([uuidField, z.literal(''), z.null(), z.undefined()])
    .transform((value) => (value ? value : null)),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  is_active: z.boolean().default(true),
});

export type RoomValues = z.input<typeof roomSchema>;

export const locationSchema = z.object({
  name: requiredText(80),
  address: optionalText(200),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  is_active: z.boolean().default(true),
});

export type LocationValues = z.input<typeof locationSchema>;

export const patientTagSchema = z.object({
  name: requiredText(60),
  color: z.enum(TAG_COLORS).default('ink'),
});

export type PatientTagValues = z.input<typeof patientTagSchema>;

/** Which tags a file carries — the whole set, replaced at once. */
export const patientTagLinksSchema = z.object({
  patient_id: uuidField,
  tag_ids: z.array(uuidField).max(50),
});

/**
 * The clinic's own reminder wording. Empty means the built-in text. The
 * placeholders are documented beside the field; unknown ones are left as typed
 * rather than rejected, because a practitioner writing "{שם}" by mistake should
 * see it in the preview, not be refused.
 */
export const reminderSettingsSchema = z.object({
  reminder_template: optionalText(1000),
  reminders_enabled: z.boolean().default(true),
  reminder_hours_before: z.coerce.number().int().min(1).max(168).default(24),
  reminder_channel: z.enum(['sms', 'whatsapp', 'email']).default('whatsapp'),
});

export type ReminderSettingsValues = z.input<typeof reminderSettingsSchema>;

export const bookingSettingsSchema = z.object({
  booking_enabled: z.boolean().default(false),
  booking_slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/, { error: 'invalid_slug' }),
  booking_intro: optionalText(2000),
  booking_lead_hours: z.coerce.number().int().min(0).max(720).default(24),
  booking_horizon_days: z.coerce.number().int().min(1).max(365).default(60),
  booking_verify_sms: z.boolean().default(false),
});

export type BookingSettingsValues = z.input<typeof bookingSettingsSchema>;

/**
 * Hours away on one day. The date and two clock times, as the dialog
 * speaks them; the action turns them into instants in the browser's zone,
 * which is the clinic's.
 */
export const scheduleBlockSchema = z
  .object({
    start_at: z.string().refine((value) => !Number.isNaN(Date.parse(value)), { error: 'invalid_datetime' }),
    end_at: z.string().refine((value) => !Number.isNaN(Date.parse(value)), { error: 'invalid_datetime' }),
    reason: optionalText(160),
  })
  .refine((value) => Date.parse(value.end_at) > Date.parse(value.start_at), {
    error: 'end_before_start',
    path: ['end_at'],
  });

export const scheduleBlocksSchema = z.array(scheduleBlockSchema).min(1).max(12);

export type ScheduleBlockValues = z.input<typeof scheduleBlockSchema>;
