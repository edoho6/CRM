import { describe, expect, it } from 'vitest';
import { firstStepWith, splitIntoSteps } from '@clinic/domain/forms/steps';
import type { FormField } from '@clinic/domain';

const question = (id: string): FormField =>
  ({ id, type: 'text', label: id, required: false }) as unknown as FormField;
const section = (id: string, label: string): FormField =>
  ({ id, type: 'section', label, required: false }) as unknown as FormField;

describe('splitIntoSteps', () => {
  it('starts a step at every section and keeps the section inside it', () => {
    const steps = splitIntoSteps([
      question('q1'),
      question('q2'),
      section('s1', 'About you'),
      question('q3'),
      section('s2', 'Nothing follows'),
    ]);
    expect(steps.map((step) => step.title)).toEqual([null, 'About you']);
    expect(steps[0]?.fields.map((field) => field.id)).toEqual(['q1', 'q2']);
    expect(steps[1]?.fields.map((field) => field.id)).toEqual(['s1', 'q3']);
  });

  it('is one step when there are no sections', () => {
    const steps = splitIntoSteps([question('a'), question('b')]);
    expect(steps).toHaveLength(1);
    expect(steps[0]?.title).toBeNull();
    expect(steps[0]?.fields).toHaveLength(2);
  });

  it('does not invent an empty first step when the questionnaire opens with a section', () => {
    const steps = splitIntoSteps([section('s', 'Intro'), question('a')]);
    expect(steps).toHaveLength(1);
    expect(steps[0]?.title).toBe('Intro');
  });

  it('keeps an all-sections questionnaire as one step rather than none', () => {
    expect(splitIntoSteps([section('s', 'Only text')])).toHaveLength(1);
  });
});

describe('firstStepWith', () => {
  it('points at the earliest step holding a named field, or the first step', () => {
    const steps = splitIntoSteps([question('a'), section('s', 'B'), question('b'), question('c')]);
    expect(firstStepWith(steps, ['c'])).toBe(1);
    expect(firstStepWith(steps, ['b', 'a'])).toBe(0);
    expect(firstStepWith(steps, ['zzz'])).toBe(0);
  });
});
