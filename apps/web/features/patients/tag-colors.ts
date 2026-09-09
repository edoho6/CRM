import type { TagColor } from '@clinic/domain';

/**
 * How each tag tone is painted.
 *
 * Whole class strings, because Tailwind only emits what it can read in the
 * source. The pairs are the same ones the status badges use, so a tag and a
 * badge of the same tone sit together without a visible seam. Every pair
 * clears AA on white and on the card surface in both themes — the contrast
 * checker measures them.
 */
export const TAG_CLASSES: Record<TagColor, string> = {
  ink: 'bg-ink-100 text-ink-700',
  jade: 'bg-jade-100 text-jade-800',
  sky: 'bg-sky-100 text-sky-800',
  amber: 'bg-amber-100 text-amber-800',
  red: 'bg-red-100 text-red-700',
};

/** The swatch in the picker: solid, so the tone can be told apart at a glance. */
export const TAG_SWATCH_CLASSES: Record<TagColor, string> = {
  ink: 'bg-ink-500',
  jade: 'bg-jade-600',
  sky: 'bg-sky-600',
  amber: 'bg-amber-500',
  red: 'bg-red-600',
};
