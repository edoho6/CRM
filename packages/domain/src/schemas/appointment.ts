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

/* ---------------------------------------------------------------------------
 * When the practitioner works
 * ------------------------------------------------------------------------- */

/**
 * One weekly working block.
 *
 * A day can have more than one — a practice that breaks for two hours at midday
 * is two rows, not one row with a gap, because a gap is not a thing a single
 * start-and-end can express.
 *
 * Sunday is 0, matching `practitioner_schedules.weekday` and the Israeli week
 * the calendar already draws.
 */
export const workingHoursSchema = z
  .object({
    weekday: z
      .union([z.string(), z.number()])
      .transform((v) => (typeof v === 'number' ? v : Number(v)))
      .pipe(z.number().int().min(0).max(6)),
    start_time: z.string().regex(/^\d{2}:\d{2}$/, { error: 'invalid_time' }),
    end_time: z.string().regex(/^\d{2}:\d{2}$/, { error: 'invalid_time' }),
    is_active: z.boolean().default(true),
  })
  .refine((value) => value.end_time > value.start_time, {
    error: 'end_must_be_after_start',
    path: ['end_time'],
  });

export type WorkingHoursValues = z.input<typeof workingHoursSchema>;

/**
 * A day that breaks the weekly pattern.
 *
 * Either closed outright — a holiday, a day off — or open at different hours.
 * The check constraint in the database says the same thing: partial hours need
 * both ends, and a closed day needs neither.
 */
export const scheduleExceptionSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: 'invalid_date' }),
    is_closed: z.boolean().default(true),
    start_time: optionalText(5),
    end_time: optionalText(5),
    reason: optionalText(160),
  })
  .refine(
    (value) =>
      value.is_closed ||
      (Boolean(value.start_time) && Boolean(value.end_time) && value.end_time! > value.start_time!),
    { error: 'partial_day_needs_both_times', path: ['start_time'] },
  );

export type ScheduleExceptionValues = z.input<typeof scheduleExceptionSchema>;

/**
 * Closing the diary over a stretch of days.
 *
 * A holiday is one decision, not fourteen. It is stored as one row per day,
 * because `schedule_exceptions` is keyed by date and everything that reads it —
 * the calendar shading, the booking warning, the series generator — already
 * asks "is this day closed"; a range type would mean teaching all three about
 * intervals to express something they can already answer.
 *
 * A single day is a range whose end equals its start, so there is one path
 * rather than two.
 */
export const closurePeriodSchema = z
  .object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: 'invalid_date' }),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: 'invalid_date' }),
    /**
     * Hours, for a closure that is not the whole day.
     *
     * Both blank closes every day in the range outright, which is a holiday.
     * Both given closes only those hours on each day — an afternoon off, a
     * course that runs 14:00 to 18:00 all week. `schedule_exceptions` already
     * models the difference through `is_closed` plus a time pair, and its own
     * CHECK says the same thing: partial hours need both ends.
     */
    start_time: z
      .union([z.string().regex(/^\d{2}:\d{2}$/), z.literal(''), z.null()])
      .transform((value) => (value ? value : null)),
    end_time: z
      .union([z.string().regex(/^\d{2}:\d{2}$/), z.literal(''), z.null()])
      .transform((value) => (value ? value : null)),
    reason: optionalText(160),
  })
  .refine((value) => value.to >= value.from, {
    error: 'end_before_start',
    path: ['to'],
  })
  .refine(
    (value) =>
      (value.start_time === null) === (value.end_time === null) &&
      (value.end_time === null || value.end_time > value.start_time!),
    { error: 'partial_day_needs_both_times', path: ['end_time'] },
  )
  .refine(
    (value) => {
      // A year is past anything a clinic closes for in one go, and the cap is
      // what stops a mistyped year writing thousands of rows.
      const days =
        (Date.parse(value.to) - Date.parse(value.from)) / 86_400_000;
      return Number.isFinite(days) && days <= 366;
    },
    { error: 'closure_too_long', path: ['to'] },
  );

export type ClosurePeriodValues = z.input<typeof closurePeriodSchema>;

/* ---------------------------------------------------------------------------
 * A course of treatment
 * ------------------------------------------------------------------------- */

/**
 * "Every N weeks, M times" — the shape of a course of treatment.
 *
 * The cap of 52 is not a business rule, it is a brake: a typo in the count field
 * should not turn into four hundred rows and four hundred round trips. A year of
 * weekly appointments is past anything a practitioner books in one sitting.
 */
export const appointmentSeriesSchema = z.object({
  every_weeks: z
    .union([z.string(), z.number()])
    .transform((v) => (typeof v === 'number' ? v : Number(v)))
    .pipe(z.number().int().min(1).max(12)),
  occurrences: z
    .union([z.string(), z.number()])
    .transform((v) => (typeof v === 'number' ? v : Number(v)))
    .pipe(z.number().int().min(2).max(52)),
});

export type AppointmentSeriesValues = z.input<typeof appointmentSeriesSchema>;
