import { z } from 'zod';
import { APPOINTMENT_STATUSES } from '../enums';
import { optionalText, requiredText, uuidField } from './common';

export const appointmentFormSchema = z
  .object({
    patient_id: uuidField,
    practitioner_id: uuidField,
    appointment_type_id: z
      .union([uuidField, z.literal(''), z.null()])
      .transform((v) => (v ? v : null)),
    /** ISO 8601 instant, e.g. `2026-09-06T09:30:00.000Z`. */
    start_at: z.string().min(1),
    end_at: z.string().min(1),
    status: z.enum(APPOINTMENT_STATUSES).default('scheduled'),
    location: optionalText(160),
    notes: optionalText(2000),
  })
  .refine((value) => new Date(value.end_at).getTime() > new Date(value.start_at).getTime(), {
    error: 'end_must_be_after_start',
    path: ['end_at'],
  });

export type AppointmentFormValues = z.input<typeof appointmentFormSchema>;
export type AppointmentFormData = z.output<typeof appointmentFormSchema>;

export const appointmentTypeFormSchema = z.object({
  name_he: requiredText(80),
  name_en: requiredText(80),
  default_duration_minutes: z
    .union([z.string(), z.number()])
    .transform((v) => (typeof v === 'number' ? v : Number(v)))
    .pipe(z.number().int().min(5).max(480)),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, { error: 'invalid_color' })
    .default('#0ea5e9'),
  is_active: z.boolean().default(true),
});

export type AppointmentTypeFormValues = z.input<typeof appointmentTypeFormSchema>;

/** Weekly recurring availability for a practitioner. */
export const practitionerScheduleSchema = z
  .object({
    weekday: z
      .union([z.string(), z.number()])
      .transform((v) => (typeof v === 'number' ? v : Number(v)))
      .pipe(z.number().int().min(0).max(6)),
    /** `HH:MM` as produced by `<input type="time">`. */
    start_time: z.string().regex(/^\d{2}:\d{2}$/, { error: 'invalid_time' }),
    end_time: z.string().regex(/^\d{2}:\d{2}$/, { error: 'invalid_time' }),
    is_active: z.boolean().default(true),
  })
  .refine((value) => value.end_time > value.start_time, {
    error: 'end_must_be_after_start',
    path: ['end_time'],
  });

export type PractitionerScheduleValues = z.input<typeof practitionerScheduleSchema>;
