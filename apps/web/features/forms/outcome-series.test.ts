import { describe, expect, it } from 'vitest';
import type { FormField } from '@clinic/domain';
import { buildOutcomeSeries, type SubmissionLike } from './outcome-series';

function scale(id: string, label: string, extra: Partial<FormField> = {}): FormField {
  return {
    id,
    type: 'scale',
    label,
    help: '',
    required: false,
    options: [],
    scale_min: 0,
    scale_max: 10,
    scale_min_label: '',
    scale_max_label: '',
    ...extra,
  } as FormField;
}

function text(id: string, label: string): FormField {
  return { ...scale(id, label), type: 'short_text' } as FormField;
}

function submission(
  date: string,
  fields: FormField[],
  answers: Record<string, unknown>,
): SubmissionLike {
  return { fields, answers, submitted_at: date };
}

describe('buildOutcomeSeries', () => {
  it('collects one scale question across submissions, oldest first', () => {
    const fields = [scale('pain', 'Pain')];
    const series = buildOutcomeSeries([
      submission('2026-03-01T10:00:00Z', fields, { pain: 4 }),
      submission('2026-01-01T10:00:00Z', fields, { pain: 8 }),
      submission('2026-02-01T10:00:00Z', fields, { pain: 6 }),
    ]);

    expect(series).toHaveLength(1);
    expect(series[0]!.points.map((point) => point.value)).toEqual([8, 6, 4]);
  });

  it('ignores questions that are not scales', () => {
    const fields = [scale('pain', 'Pain'), text('notes', 'Notes')];
    const series = buildOutcomeSeries([
      submission('2026-01-01T10:00:00Z', fields, { pain: 5, notes: 'worse in the morning' }),
    ]);

    expect(series.map((entry) => entry.fieldId)).toEqual(['pain']);
  });

  it('treats an unanswered scale as a gap rather than a zero', () => {
    const fields = [scale('pain', 'Pain')];
    const series = buildOutcomeSeries([
      submission('2026-01-01T10:00:00Z', fields, { pain: 7 }),
      submission('2026-02-01T10:00:00Z', fields, {}),
      submission('2026-03-01T10:00:00Z', fields, { pain: 3 }),
    ]);

    expect(series[0]!.points).toHaveLength(2);
    expect(series[0]!.points.map((point) => point.value)).toEqual([7, 3]);
  });

  it('ignores an answer that is not a number', () => {
    const fields = [scale('pain', 'Pain')];
    const series = buildOutcomeSeries([
      submission('2026-01-01T10:00:00Z', fields, { pain: 'quite bad' }),
    ]);

    expect(series).toEqual([]);
  });

  it('keeps a value of zero, which is a real answer', () => {
    const fields = [scale('pain', 'Pain')];
    const series = buildOutcomeSeries([submission('2026-01-01T10:00:00Z', fields, { pain: 0 })]);

    expect(series[0]!.points).toEqual([{ date: '2026-01-01T10:00:00Z', value: 0 }]);
  });

  it('separates two different scale questions', () => {
    const fields = [scale('pain', 'Pain'), scale('sleep', 'Sleep')];
    const series = buildOutcomeSeries([
      submission('2026-01-01T10:00:00Z', fields, { pain: 8, sleep: 3 }),
      submission('2026-02-01T10:00:00Z', fields, { pain: 5, sleep: 6 }),
    ]);

    expect(series).toHaveLength(2);
    expect(series.find((entry) => entry.fieldId === 'sleep')!.points.map((p) => p.value)) //
      .toEqual([3, 6]);
  });

  it('reads a renamed question by its current wording, keeping older answers', () => {
    const older = [scale('pain', 'How bad is the pain?')];
    const newer = [scale('pain', 'Pain level')];
    const series = buildOutcomeSeries([
      submission('2026-01-01T10:00:00Z', older, { pain: 9 }),
      submission('2026-02-01T10:00:00Z', newer, { pain: 4 }),
    ]);

    expect(series[0]!.label).toBe('Pain level');
    expect(series[0]!.points).toHaveLength(2);
  });

  it('takes the bounds and end labels from the latest version of the question', () => {
    const older = [scale('pain', 'Pain', { scale_max: 10, scale_max_label: 'unbearable' })];
    const newer = [scale('pain', 'Pain', { scale_max: 100, scale_max_label: 'worst possible' })];
    const series = buildOutcomeSeries([
      submission('2026-01-01T10:00:00Z', older, { pain: 9 }),
      submission('2026-02-01T10:00:00Z', newer, { pain: 40 }),
    ]);

    expect(series[0]!.max).toBe(100);
    expect(series[0]!.maxLabel).toBe('worst possible');
  });

  it('returns nothing when no form has a scale question', () => {
    expect(buildOutcomeSeries([submission('2026-01-01T10:00:00Z', [text('a', 'A')], { a: 'x' })])) //
      .toEqual([]);
  });

  it('returns nothing when there are no submissions', () => {
    expect(buildOutcomeSeries([])).toEqual([]);
  });
});
