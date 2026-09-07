import { z } from 'zod';

/**
 * Shared zod building blocks.
 *
 * HTML inputs submit `''` for an empty field, but the database wants NULL. Every
 * optional text field goes through `optionalText()` so we never store empty strings
 * (which would break "is this field filled in?" queries later).
 */

export const optionalText = (max = 500) =>
  z.union([z.string().max(max), z.null(), z.undefined()]).transform((value) => {
    if (value === null || value === undefined) return null;
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  });

export const requiredText = (max = 255, min = 1) =>
  z
    .string()
    .transform((value) => value.trim())
    .pipe(z.string().min(min).max(max));

export const optionalEmail = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => {
    if (value === null || value === undefined) return null;
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  })
  .refine((value) => value === null || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), {
    error: 'invalid_email',
  });

/** ISO date string, `YYYY-MM-DD`, as produced by `<input type="date">`. */
export const optionalDate = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => {
    if (value === null || value === undefined) return null;
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  })
  .refine((value) => value === null || /^\d{4}-\d{2}-\d{2}$/.test(value), {
    error: 'invalid_date',
  });

/** Accepts `''`/null from a numeric input and normalises to null. */
export const optionalNumber = z
  .union([z.string(), z.number(), z.null(), z.undefined()])
  .transform((value) => {
    if (value === null || value === undefined || value === '') return null;
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  });

/** Positive quantity used across inventory (grams, capsules, bottles). */
export const positiveQuantity = z
  .union([z.string(), z.number()])
  .transform((value) => (typeof value === 'number' ? value : Number(value)))
  .pipe(z.number().positive().finite());

export const uuidField = z.string().uuid();
