import { describe, expect, it } from 'vitest';
import { findMentions, mentionPattern, normalizeMentionText, prepareMentionIndex, type MentionCandidate } from '@clinic/domain';

const corpus: MentionCandidate[] = [
  { id: '1', slug: 'metformin', kind: 'drug', label: 'מטפורמין', names: ['מטפורמין', 'metformin', 'Glucophage'] },
  { id: '2', slug: 'type-2-diabetes', kind: 'condition', label: 'סוכרת מסוג 2', names: ['סוכרת מסוג 2', 'type 2 diabetes', 'T2DM'] },
  { id: '3', slug: 'diabetes', kind: 'condition', label: 'סוכרת', names: ['סוכרת', 'diabetes'] },
  { id: '4', slug: 'asthma', kind: 'condition', label: 'אסתמה', names: ['אסתמה', 'asthma'] },
  { id: '5', slug: 'methotrexate', kind: 'drug', label: 'מתוטרקסט', names: ['מתוטרקסט', 'methotrexate'] },
  { id: '6', slug: 'alzheimers', kind: 'condition', label: 'אלצהיימר', names: ['אלצהיימר', "Alzheimer's disease", 'AD'] },
  { id: '7', slug: 'statin', kind: 'drug', label: 'סטטין', names: ['סטטין', 'statin'] },
  { id: '8', slug: 'gout', kind: 'condition', label: 'גאוט', names: ['גאוט', 'gout', 'גב'] },
];
const index = prepareMentionIndex(corpus);
const labels = (text: string) => findMentions(text, index).map((m) => m.label);

describe('findMentions', () => {
  it('finds Hebrew names with a prefix letter, in the order of the text', () => {
    expect(labels('סובל מסוכרת ולאסתמה; לוקח מטפורמין 850 פעמיים ביום')).toEqual(['סוכרת', 'אסתמה', 'מטפורמין']);
  });

  it('finds Latin names as whole words, plural included, and never inside another word', () => {
    expect(labels('Type 2 diabetes, on metformin and statins.')).toEqual(['סוכרת מסוג 2', 'סוכרת', 'מטפורמין', 'סטטין']);
    expect(labels('meth use, no methotrexat')).toEqual([]);
  });

  it('ignores names too short to trust', () => {
    // "AD" would match any "ad"; "גב" (two letters) would match every back.
    expect(labels('ad libitum, כאבי גב')).toEqual([]);
    expect(mentionPattern('AD')).toBeNull();
    expect(mentionPattern('גב')).toBeNull();
    expect(mentionPattern('גאוט')).not.toBeNull();
  });

  it('names an entry once however many of its names appear', () => {
    expect(labels('metformin (Glucophage), מטפורמין')).toEqual(['מטפורמין']);
  });

  it('is quiet on empty or tiny text', () => {
    expect(labels('')).toEqual([]);
    expect(labels('  a ')).toEqual([]);
  });

  it('normalises punctuation and case', () => {
    expect(normalizeMentionText("  Alzheimer’s  Disease!! ")).toBe("alzheimer's disease");
    expect(labels("dx: ALZHEIMER'S DISEASE")).toEqual(['אלצהיימר']);
  });
});
