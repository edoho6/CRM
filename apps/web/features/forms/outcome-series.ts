import type { FormField } from '@clinic/domain';
import type { OutcomeSeries } from './outcome-chart';

/**
 * Turns a patient's submissions of one questionnaire into plottable series.
 *
 * A plain module rather than part of the chart, so it can be tested without
 * rendering anything — the arithmetic of "which answers belong to the same
 * question" is where this goes wrong, not the SVG.
 *
 * Scoped to a single template on purpose. Field ids are unique within a form and
 * nowhere else, so two questionnaires that both happen to call a question `q1`
 * would otherwise have their answers plotted as one line.
 */

export interface SubmissionLike {
  fields: FormField[];
  answers: Record<string, unknown>;
  submitted_at: string;
}

export function buildOutcomeSeries(submissions: SubmissionLike[]): OutcomeSeries[] {
  // Oldest first: a line read left to right is read as time passing.
  const ordered = [...submissions].sort(
    (a, b) => new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime(),
  );

  const byField = new Map<string, OutcomeSeries>();

  for (const submission of ordered) {
    for (const field of submission.fields) {
      if (field.type !== 'scale') continue;

      const value = submission.answers[field.id];
      // An unanswered scale is a gap in the series, not a zero. Plotting it as
      // zero would show an improvement that never happened.
      if (typeof value !== 'number' || !Number.isFinite(value)) continue;

      const existing = byField.get(field.id);
      if (existing) {
        existing.points.push({ date: submission.submitted_at, value });
        /*
         * The label and the bounds are taken from the most recent submission
         * that carried this question. A form edited to rename a question — or to
         * widen its scale — should read by its current wording; the older answers
         * are still answers to the same question, which is what the stable field
         * id means.
         */
        existing.label = field.label;
        existing.min = field.scale_min;
        existing.max = field.scale_max;
        existing.minLabel = field.scale_min_label || null;
        existing.maxLabel = field.scale_max_label || null;
        continue;
      }

      byField.set(field.id, {
        fieldId: field.id,
        label: field.label,
        min: field.scale_min,
        max: field.scale_max,
        minLabel: field.scale_min_label || null,
        maxLabel: field.scale_max_label || null,
        points: [{ date: submission.submitted_at, value }],
      });
    }
  }

  // One point is a reading, not a trend. It is kept: the first visit of a course
  // is exactly when a practitioner wants to see the baseline recorded, and the
  // chart says "1 answer" rather than pretending to a line.
  return [...byField.values()];
}
