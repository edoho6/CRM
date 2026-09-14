import { describe, expect, it } from 'vitest';
import {
  LIBRARY_DISCLAIMER_HE,
  checkGrounding,
  citationNumbers,
  distinctByContent,
  findPii,
  isIsraeliId,
  numbersIn,
  rrfMerge,
} from '@clinic/domain';

describe('findPii', () => {
  it('finds an Israeli identity number by its check digit, with or without leading zeros', () => {
    // 000000018 works out; 123456789 does not.
    expect(isIsraeliId('000000018')).toBe(true);
    expect(isIsraeliId('18')).toBe(false); // too short to be one
    expect(isIsraeliId('123456789')).toBe(false);
    expect(findPii('המטופלת עם ת.ז 000000018 סובלת מכאבי ראש').map((f) => f.kind)).toEqual(['id_keyword', 'id']);
    expect(findPii('מספר זהות: 3 שאלות').map((f) => f.kind)).toEqual(['id_keyword']);
  });

  it('finds phones, emails and card numbers', () => {
    expect(findPii('הטלפון שלו 052-1234567').map((f) => f.kind)).toEqual(['phone']);
    expect(findPii('call +972 52 123 4567').map((f) => f.kind)).toEqual(['phone']);
    expect(findPii('write to dana@example.com').map((f) => f.kind)).toEqual(['email']);
    expect(findPii('card 4580 1234 5678 9012').map((f) => f.kind)).toEqual(['card']);
  });

  it('leaves a clinical question alone: doses, years, page numbers are not identifiers', () => {
    expect(findPii('מה המינון של דן גווי בפורמולה, 500 מ״ג פעמיים ביום?')).toEqual([]);
    expect(findPii('What does the 2019 guideline say about 12.5 mg per day over 14 days?')).toEqual([]);
    expect(findPii('Gui Zhi Tang: Gui Zhi 9g, Bai Shao 9g, Zhi Gan Cao 6g, Sheng Jiang 9g, Da Zao 12 pieces')).toEqual([]);
    expect(findPii('page 1234567 of the book')).toEqual([]); // 1234567 is not a valid identity number
  });
});

describe('grounding', () => {
  it('reads the citation markers in every shape they come in', () => {
    expect(citationNumbers('לפי המקור [1], ובניגוד ל-[2, 3] ו-[4][1]')).toEqual([1, 2, 3, 4]);
    expect(citationNumbers('no markers here')).toEqual([]);
  });

  it('lists the numbers an answer states, without single digits or the markers', () => {
    expect(numbersIn('9 גרם [1] ליום, 12.5 מ״ג [2], 1,000 שנה')).toEqual(['12.5', '1000']);
  });

  it('passes an answer whose citations exist and whose numbers are in them', () => {
    const passages = [
      { n: 1, content: 'Gui Zhi Tang: Gui Zhi 9g, Bai Shao 9g, decocted in 1,000 ml of water.' },
      { n: 2, content: 'Take 12.5 mg twice daily.' },
    ];
    expect(checkGrounding('גווי ג׳י 9 גרם ובאי שאו 9 גרם ב-1000 מ״ל מים [1]; 12.5 מ״ג פעמיים ביום [2]', passages)).toEqual({ ok: true, problems: [] });
  });

  it('fails an answer that cites nothing, cites a passage that was not retrieved, or invents a number', () => {
    const passages = [{ n: 1, content: 'Bai Shao 9g.' }];
    expect(checkGrounding('באי שאו 9 גרם', passages).problems.map((p) => p.kind)).toEqual(['no_citation']);
    expect(checkGrounding('באי שאו 9 גרם [7]', passages).problems.map((p) => p.kind)).toEqual(['unknown_citation']);
    expect(checkGrounding('באי שאו 15 גרם [1]', passages).problems).toEqual([{ kind: 'number_not_in_sources', detail: '15' }]);
  });

  it('does not credit a number to a passage the answer did not cite', () => {
    const passages = [
      { n: 1, content: 'Bai Shao 9g.' },
      { n: 2, content: 'Huang Qi 30g.' },
    ];
    expect(checkGrounding('חואנג צ׳י 30 גרם [1]', passages).ok).toBe(false);
  });
});

describe('rrfMerge', () => {
  it('lifts what both rankings hold, and keeps what only one does', () => {
    const merged = rrfMerge([
      ['a', 'b', 'c'],
      ['c', 'a', 'd'],
    ]);
    expect(merged.map((m) => m.id)).toEqual(['a', 'c', 'b', 'd']);
    expect(merged[0]!.score).toBeGreaterThan(merged[2]!.score);
  });
});

describe('distinctByContent', () => {
  it('folds passages with the same text to the first, ignoring whitespace, and keeps the rest', () => {
    const rows = [
      { id: 'first', content: 'Sheng Jiang warms the middle.' },
      { id: 'copy', content: 'Sheng  Jiang warms the middle.\n' },
      { id: 'other', content: 'Sheng Jiang warms the lung.' },
    ];
    expect(distinctByContent(rows).map((r) => r.id)).toEqual(['first', 'other']);
    expect(distinctByContent([])).toEqual([]);
  });
});

describe('disclaimer', () => {
  it('is Hebrew, names the practitioner as the one responsible, and forbids patient details', () => {
    expect(LIBRARY_DISCLAIMER_HE).toMatch(/כלי עזר/);
    expect(LIBRARY_DISCLAIMER_HE).toMatch(/האחריות/);
    expect(LIBRARY_DISCLAIMER_HE).toMatch(/מטופלים/);
  });
});
