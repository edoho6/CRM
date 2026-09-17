import { describe, expect, it } from 'vitest';
import {
  LIBRARY_DISCLAIMER_HE,
  checkGrounding,
  citationNumbers,
  distinctByContent,
  dropCitations,
  dropUnknownCitations,
  findPii,
  isIsraeliId,
  narrowedQuery,
  numbersIn,
  parsePlan,
  planFallback,
  removeDoses,
  removeSentences,
  removeUnsupportedNumbers,
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

  it('lists the numbers an answer states, a single digit only inside an amount with its unit, never the markers', () => {
    expect(numbersIn('9 גרם [1] ליום, 12.5 מ״ג [2], 1,000 שנה')).toEqual(['9', '12.5', '1000']);
    expect(numbersIn('Chai Hu 3–9g; Bai Zhu 6 גר׳; 0.5 עד 1 צון; 3 ל-6 מ״ל')).toEqual(['3', '9', '6', '0.5', '1']);
    // A count, a translation of "twice daily", or a digit before a word that only starts like a unit.
    expect(numbersIn('2 פעמים ביום, 3 צמחים, פי 2, 5 מגנונים')).toEqual([]);
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
    expect(checkGrounding('באי שאו 15 גרם [1]', passages).problems).toEqual([{ kind: 'number_not_in_sources', detail: '15', sentence: 'באי שאו 15 גרם [1]' }]);
  });

  it('checks a single-digit dose, which used to pass unread', () => {
    const passages = [{ n: 1, content: 'Chai Hu: 3-9g.' }];
    expect(checkGrounding('צ׳אי הו במינון 3–9 גרם [1]', passages).ok).toBe(true);
    expect(checkGrounding('צ׳אי הו במינון 6 גרם [1]', passages).problems).toEqual([{ kind: 'number_not_in_sources', detail: '6', sentence: 'צ׳אי הו במינון 6 גרם [1]' }]);
  });

  it('does not credit a number to a passage the answer did not cite', () => {
    const passages = [
      { n: 1, content: 'Bai Shao 9g.' },
      { n: 2, content: 'Huang Qi 30g.' },
    ];
    expect(checkGrounding('חואנג צ׳י 30 גרם [1]', passages).ok).toBe(false);
  });

  it('holds each sentence to the passages it cites itself, not to every passage the answer cites', () => {
    const passages = [
      { n: 1, content: 'Bai Shao 9g.' },
      { n: 2, content: 'Huang Qi 30g.' },
    ];
    // Both passages are cited, and 30 is in one of them — but not in the one beside Bai Shao.
    const { problems } = checkGrounding('Bai Shao 30 גרם [1]. Huang Qi 30 גרם [2].', passages);
    expect(problems).toEqual([{ kind: 'number_not_in_sources', detail: '30', sentence: 'Bai Shao 30 גרם [1].' }]);
    // A sentence without a marker of its own takes the marker that closes its paragraph.
    expect(checkGrounding('ל-Huang Qi מינון של 30 גרם במצבים קשים. הוא מחזק צ׳י [2].', passages).ok).toBe(true);
  });

  it('finds a number only whole in the passage: 12 is not in 120', () => {
    expect(checkGrounding('מבשלים ב-12 מ״ל מים [1]', [{ n: 1, content: 'Decoct in 120 ml of water.' }]).ok).toBe(false);
  });

  it('counts a number from the cited passage’s title or page as evidence', () => {
    const passages = [{ n: 1, content: 'Tao Ren: not recommended in pregnancy.', title: 'טבלת אינטראקציה 2014', page: 31 }];
    expect(checkGrounding('לפי טבלת האינטראקציות 2014, עמוד 31: Tao Ren לא מומלץ בהיריון [1]', passages)).toEqual({ ok: true, problems: [] });
    expect(checkGrounding('לפי טבלת 2019 [1]', passages).problems).toEqual([{ kind: 'number_not_in_sources', detail: '2019', sentence: 'לפי טבלת 2019 [1]' }]);
  });
});

describe('removeSentences', () => {
  const answer = [
    '**צמחים שאסורים בהיריון:**',
    '- Tao Ren – לא מומלץ בהיריון [5]',
    '- Yi Yi Ren – קונטרה אינדיקציה בהיריון (בפורמולת shen ling bai zhu san) [1][6]',
    '- Rou Gui – אסור בהיריון [6]',
    '',
    'הערה: חלק מהצמחים מופיעים ברמות זהירות שונות [1]. יש לבחון כל פורמולה לפי ההקשר שלה. Suan Zao Ren מסומן גם כזהירות בלבד [7].',
  ].join('\n');

  it('strikes the bullet a quote sits in, whole, and leaves the rest', () => {
    const { text, removed } = removeSentences(answer, ['Yi Yi Ren – קונטרה אינדיקציה בהיריון (בפורמולת shen ling bai zhu san)']);
    expect(removed).toBe(1);
    expect(text).not.toContain('Yi Yi Ren');
    expect(text).toContain('- Tao Ren – לא מומלץ בהיריון [5]');
    expect(text).toContain('- Rou Gui – אסור בהיריון [6]');
  });

  it('strikes one sentence of a paragraph by its first forty characters or by most of its words', () => {
    const { text, removed } = removeSentences(answer, [
      'הערה: חלק מהצמחים מופיעים ברמות זהירות שונות במקורות אחרים',
      'Suan Zao Ren מסומן כזהירות בלבד ולא כאיסור',
    ]);
    expect(removed).toBe(2);
    expect(text).toContain('- Rou Gui – אסור בהיריון [6]');
    expect(text.endsWith('יש לבחון כל פורמולה לפי ההקשר שלה.')).toBe(true);
    expect(text).not.toContain('הערה:');
    expect(text).not.toContain('Suan Zao Ren');
  });

  it('removes nothing for a quote that matches nothing, and drops a heading left with nothing under it', () => {
    expect(removeSentences(answer, ['Ma Huang is contraindicated in hypertension'])).toEqual({ text: answer, removed: 0 });
    const { text } = removeSentences(answer, ['Tao Ren – לא מומלץ בהיריון', 'Yi Yi Ren – קונטרה אינדיקציה בהיריון', 'Rou Gui – אסור בהיריון']);
    expect(text).not.toContain('צמחים שאסורים בהיריון');
    expect(text.startsWith('הערה:')).toBe(true);
  });

  it('drops a marker that points at no passage and keeps the words', () => {
    expect(dropCitations('Bai Shao 9 גרם [1, 12]. Gan Cao [12] מתוק [2][12].', [12])).toBe('Bai Shao 9 גרם [1]. Gan Cao מתוק [2].');
  });

  it('strikes a sentence whose only markers point at no passage, and keeps one that still has a real marker', () => {
    const result = dropUnknownCitations('Huang Qi 30 גרם [12]. Bai Shao 9 גרם [1, 12]. Gan Cao מתוק [2].', [12]);
    expect(result.text).toBe('Bai Shao 9 גרם [1]. Gan Cao מתוק [2].');
    expect(result.removed).toBe(1);
    expect(result.struck).toEqual(['Huang Qi 30 גרם [12].']);
  });

  it('strikes the sentences that state a number their own passages do not hold, and only those', () => {
    const passages = [
      { n: 1, content: 'Bai Shao 9g. Gan Cao 6g.' },
      { n: 2, content: 'Huang Qi 30g.' },
    ];
    const result = removeUnsupportedNumbers('Bai Shao 9 גרם [1]. Huang Qi 9 גרם [2]. Gan Cao 6 גרם [1].', passages);
    expect(result.text).toBe('Bai Shao 9 גרם [1]. Gan Cao 6 גרם [1].');
    expect(result.struck).toEqual(['Huang Qi 9 גרם [2].']);
  });

  it('takes every dose out of text no source checked, and leaves the rest', () => {
    const result = removeDoses(['**ידע כללי:**', '- Fu Zi רעיל ודורש בישול ממושך.', '- המינון המקובל 3–9 גרם.', '- נהוג לשלב אותו עם Gan Cao.'].join('\n'));
    expect(result.removed).toBe(1);
    expect(result.text).not.toContain('3–9');
    expect(result.text).toContain('Fu Zi רעיל');
    expect(result.text).toContain('Gan Cao');
  });
});

describe('parsePlan', () => {
  it('takes what the planner gave and falls back for the rest', () => {
    const plan = parsePlan({ standalone: ' אילו צמחים אסורים בהיריון? ', english: 'Which herbs are contraindicated in pregnancy?', keywords: ['contraindicated pregnancy', '', 'abortifacient'], kind: 'list' }, 'q');
    expect(plan).toEqual({ standalone: 'אילו צמחים אסורים בהיריון?', english: 'Which herbs are contraindicated in pregnancy?', keywords: ['contraindicated pregnancy', 'abortifacient'], kind: 'list' });
    expect(parsePlan(null, 'מה זה?')).toEqual(planFallback('מה זה?'));
    expect(parsePlan({ kind: 'nonsense', keywords: 'x' }, 'q')).toEqual({ standalone: 'q', english: 'q', keywords: [], kind: 'fact' });
  });
});

describe('narrowedQuery', () => {
  it('keeps the first three terms, and asks for nothing when there is nothing to narrow', () => {
    // The strict search wants one passage holding every term, and for most
    // questions there is none; three terms still name the subject.
    expect(narrowedQuery(['Xiao', 'Yao', 'San', 'formula', 'composition'])).toBe('Xiao Yao San');
    expect(narrowedQuery([' kidney ', 'yin', '', 'deficiency', 'signs'])).toBe('kidney yin deficiency');
    // Counted in words, not in the planner's entries: an entry is a short
    // phrase, and three of those were six words — which is what found
    // nothing in the first place (measured against the real library).
    expect(narrowedQuery(['Xiao Yao San', 'composition formula', 'ingredients Chinese medicine'])).toBe('Xiao Yao San');
    expect(narrowedQuery(['contraindicated pregnancy', 'abortifacient herbs'])).toBe('contraindicated pregnancy abortifacient');
    // Three words or fewer would only repeat the search that just found nothing.
    expect(narrowedQuery(['Shang', 'Han', 'Lun'])).toBeNull();
    expect(narrowedQuery(['Shang Han Lun'])).toBeNull();
    expect(narrowedQuery([])).toBeNull();
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
