import { describe, expect, it } from 'vitest';
import {
  CanonNameIndex,
  TCM_GLOSSARY,
  answerFromCanon,
  canonAnswerSystem,
  applyPinyinNames,
  applySafetyFixes,
  canonKey,
  canonNameRows,
  canonPlanFrom,
  canonPointCode,
  checkCanonDoses,
  finishCanonAnswer,
  pregnancyPointsNote,
  pregnancyStage,
  strikePregnancyPoints,
  safetyInScope,
  withBaraDoses,
  type CanonDeps,
  type CanonEntry,
  type CanonModelCall,
} from '@clinic/domain';

// Fictional entries in the canon's own shape; the text is made up for the tests.
const chaiHu: CanonEntry = {
  id: 'herbs:bupleuriradix',
  book: 'herbs',
  kind: 'herb',
  page: 1,
  associatedWith: null,
  names: { pinyin: 'chái hú', latin: 'Bupleuri Radix', english: 'bupleurum' },
  sections: { dosage: '3-9g', cautions: 'Use with caution in liver yang rising.', actions: 'Releases the exterior.' },
};
const fuZi: CanonEntry = {
  id: 'herbs:aconitiradixlateralispreparata',
  book: 'herbs',
  kind: 'herb',
  page: 2,
  associatedWith: null,
  names: { pinyin: 'zhì fù zǐ', latin: 'Aconiti Radix lateralis preparata', english: 'processed aconite' },
  sections: { dosage: '3-15g', cautions: 'Contraindicated during pregnancy.' },
};
const baiShao: CanonEntry = {
  id: 'herbs:paeoniaeradixalba',
  book: 'herbs',
  kind: 'herb',
  page: 3,
  associatedWith: null,
  names: { pinyin: 'bái sháo', latin: 'Paeoniae Radix alba', english: 'white peony' },
  sections: { dosage: '6-15g' },
};
const xiaoYao: CanonEntry = {
  id: 'formulas:xiaoyaosan',
  book: 'formulas',
  kind: 'formula',
  page: 4,
  associatedWith: null,
  names: { pinyin: 'xiāo yáo sǎn', english: 'Rambling Powder' },
  sections: { composition: 'Bupleuri Radix (chái hú) — 30g (9g)\nPaeoniae Radix alba (bái sháo) — 30g (9g)', actions: 'Spreads the Liver qi.' },
};
const variation: CanonEntry = { ...xiaoYao, id: 'formulas:xiaoyaosan~2', associatedWith: 'xiāo yáo sǎn', names: { pinyin: 'xiao yao san', english: 'Rambling Powder variation' } };
const sp6: CanonEntry = {
  id: 'points:SP-6',
  book: 'points',
  kind: 'point',
  page: 5,
  associatedWith: null,
  names: { pinyin: 'Sanyinjiao', code: 'SP-6', english: 'Three Yin Intersection' },
  sections: { location: 'On the medial side of the lower leg, 3 cun superior to the medial malleolus.', needling: 'Perpendicular insertion 1 to 1.5 cun. Caution: contraindicated in pregnancy.' },
};
const bl67: CanonEntry = {
  id: 'points:BL-67',
  book: 'points',
  kind: 'point',
  page: 6,
  associatedWith: null,
  names: { pinyin: 'Zhiyin', code: 'BL-67', english: 'Reaching Yin' },
  sections: { commentary: 'Moxa on this point is used to turn the foetus late in pregnancy.' },
};
const ALL = [chaiHu, fuZi, baiShao, xiaoYao, variation, sp6, bl67];
const rows = canonNameRows(ALL);
const index = new CanonNameIndex(rows);
const byId = new Map(ALL.map((e) => [e.id, e]));
const mentioned = (text: string) => index.mentioned(text).map((id) => byId.get(id)!);

describe('canon names', () => {
  it('meet however the pinyin is written, and point codes in any of their spellings', () => {
    expect(canonKey('Xiāo Yáo Sǎn')).toBe(canonKey('xiao yao san'));
    expect(canonPointCode('sp6')).toBe('SP-6');
    expect(canonPointCode('CV 4')).toBe('REN-4');
    expect(canonPointCode('TE5')).toBe('SJ-5');
    expect(canonPointCode('Sanyinjiao')).toBeNull();
  });

  it('find an entry by pinyin, Latin, a code, one letter off, and the plain name of a processed herb', () => {
    expect(index.find('herb', 'Chai Hu')).toBe(chaiHu.id);
    expect(index.find('herb', 'Bupleuri Radix')).toBe(chaiHu.id);
    expect(index.find('herb', 'Fu Zi')).toBe(fuZi.id);
    expect(index.find('herb', 'Chai Huu')).toBe(chaiHu.id);
    expect(index.find('point', 'Sp-6')).toBe(sp6.id);
    expect(index.find('herb', 'Nothing Like It')).toBeNull();
  });

  it('keep the principal formula when a variation shares its name', () => {
    expect(index.find('formula', 'Xiao Yao San')).toBe(xiaoYao.id);
  });

  it('name every entry a text mentions', () => {
    expect(new Set(index.mentioned('Chai Hu ו-Bai Shao, ו-SP-6 Sanyinjiao, וגם Xiao Yao San'))).toEqual(new Set([chaiHu.id, baiShao.id, sp6.id, xiaoYao.id]));
  });

  it("add Bara's own dose to a herb, and only its own", () => {
    const withDoses = withBaraDoses(ALL, rows, [
      { pinyin: 'Chai Hu', dose: { min: 3, max: 12, unit: 'g', source: 'bara' } },
      { pinyin: 'Bai Shao', dose: { min: 6, max: 15, unit: 'g', source: 'americandragon' } },
    ]);
    expect(withDoses.find((e) => e.id === chaiHu.id)!.sections.dosage_second).toBe('3-12g');
    expect(withDoses.find((e) => e.id === baiShao.id)!.sections.dosage_second).toBeUndefined();
  });
});

describe('canon plan and scope', () => {
  it('falls back to the question when the planner answers nonsense', () => {
    const plan = canonPlanFrom(null, 'מה המינון של Chai Hu?');
    expect(plan.english).toBe('מה המינון של Chai Hu?');
    expect(plan.type).toBe('other');
    expect(plan.entities).toEqual([]);
  });

  it('drops entities of unknown kinds', () => {
    const plan = canonPlanFrom({ type: 'fact', entities: [{ kind: 'herb', name: 'Chai Hu', aspects: ['dosage'] }, { kind: 'mineral', name: 'x' }] }, 'q');
    expect(plan.entities).toEqual([{ kind: 'herb', name: 'Chai Hu', aspects: ['dosage'] }]);
  });

  it('brings cautions in only when safety is asked or the question states a situation', () => {
    const plain = canonPlanFrom({ type: 'fact' }, 'q');
    expect(safetyInScope(plain, 'מה המינון של Chai Hu?')).toBe(false);
    expect(safetyInScope({ ...plain, safety: true }, 'האם Fu Zi בטוח?')).toBe(true);
    expect(safetyInScope(plain, 'מטופלת בהיריון עם נדודי שינה')).toBe(true);
  });
});

describe('pregnancyPointsNote', () => {
  it('lists a point forbidden in pregnancy apart from one only mentioned with it', () => {
    const note = pregnancyPointsNote([sp6, bl67]);
    const [forbidden, onlyMentioned] = note.split('</note>');
    expect(forbidden).toContain('SP-6');
    expect(forbidden).not.toContain('BL-67');
    expect(onlyMentioned).toContain('BL-67');
  });
});

describe('checkCanonDoses', () => {
  it('keeps a dose that is the herb’s own', () => {
    const { text, removed } = checkCanonDoses('המינון היומי של Chai Hu הוא 3-9 גרם.', [chaiHu], [], [chaiHu], mentioned);
    expect(text).toBe('המינון היומי של Chai Hu הוא 3-9 גרם.');
    expect(removed).toEqual([]);
  });

  it('removes a sentence whose dose is not the herb’s, even when the number is written elsewhere', () => {
    const { text, removed } = checkCanonDoses('המינון היומי הוא 3-9 גרם. במקרים חריפים עד 150 גרם.', [chaiHu], ['Some give up to 150g in acute cases.'], [chaiHu], mentioned);
    expect(text).toBe('המינון היומי הוא 3-9 גרם.');
    expect(removed[0]!.doses).toEqual(['150 גרם']);
  });

  it('removes any dose in a sentence about pregnancy, with the sentence', () => {
    const { text } = checkCanonDoses('- Fu Zi: 3-15 גרם.\n- בהיריון מפחיתים ל-2 גרם.', [fuZi], [], [fuZi], mentioned);
    expect(text).toBe('- Fu Zi: 3-15 גרם.');
  });

  it("gives a composition line the formula book's own amount instead of an invented one", () => {
    const { text } = checkCanonDoses('- Bai Shao — 9-12g', [xiaoYao, baiShao], [], [], mentioned);
    expect(text).toBe('- Bai Shao — 30g (9g)');
  });

  it('never takes a dose from a sentence about an exception, even in the herb’s own dosage section', () => {
    const acute: CanonEntry = { ...fuZi, sections: { dosage: '3-15g. In cases of acute collapse up to 150g has been used.' } };
    const { text, removed } = checkCanonDoses('- Fu Zi: 3-15 גרם.\n- במקרים חריפים ניתן להעלות עד 150 גרם.\nבפועל נותנים 150 גרם.', [acute], [], [acute], mentioned);
    expect(text).toBe('- Fu Zi: 3-15 גרם.');
    expect(removed.map((r) => r.doses[0])).toEqual(['150 גרם', '150 גרם']);
  });

  it('keeps a decimal dose whole while it looks for exception sentences', () => {
    const decimal: CanonEntry = { ...chaiHu, sections: { dosage: '1.5-4.5g. Up to 30g in severe cases.' } };
    const { removed } = checkCanonDoses('המינון היומי של Chai Hu הוא 1.5-4.5 גרם.', [decimal], [], [decimal], (t) => mentioned(t).map((e) => (e.id === decimal.id ? decimal : e)));
    expect(removed).toEqual([]);
  });

  it('accepts a dose written on the same line as the herb in a passage that was read', () => {
    const { removed } = checkCanonDoses('- Chai Hu — 12 גרם', [chaiHu], ['• Chai Hu Radix Bupleuri 12 g\n• Dang Gui 9 g'], [], mentioned);
    expect(removed).toEqual([]);
  });
});

describe('pregnancy and the abdominal points', () => {
  it('reads the stage from a week, a month or a trimester', () => {
    expect(pregnancyStage('מטופלת בשבוע 20 להיריון')).toBe('later');
    expect(pregnancyStage('שבוע 8 להריון')).toBe('first');
    expect(pregnancyStage('בחודש השני? חודש 2')).toBe('first');
    expect(pregnancyStage('בשליש השלישי')).toBe('later');
    expect(pregnancyStage('מטופלת בהיריון')).toBe('unknown');
  });

  it('takes an upper abdominal point out of a week-20 recommendation, and keeps the warning about another', () => {
    const answer = 'נקודות (בשיטת פיזור, למעט הנקודה שיש להימנע ממנה): LIV-2 Xingjian (מנקז אש הכבד), REN-15 Jiuwei (מרגיע נפש), ST-40 Fenglong. יש להימנע מ-REN-12 Zhongwan בשלב זה.\n- REN-4 Guanyuan מחזק את הכליות.';
    const { text, removed } = strikePregnancyPoints(answer, 'later');
    expect(removed).toEqual(['REN-15', 'REN-4']);
    expect(text).toBe('נקודות (בשיטת פיזור, למעט הנקודה שיש להימנע ממנה): LIV-2 Xingjian (מנקז אש הכבד), ST-40 Fenglong. יש להימנע מ-REN-12 Zhongwan בשלב זה.');
  });

  it('reads the codes however they are written, and keeps a list the line forbids', () => {
    const { text, removed } = strikePregnancyPoints('בנוסף אסורות LI-4 Hegu, SP-6 Sanyinjiao, ומוקסה על REN-8 Shenque.\n- נקודות: HE-7 Shenmen, Ren-15 Jiuwei (מרגיע נפש).', 'unknown');
    expect(removed).toEqual(['REN-15']);
    expect(text).toBe('בנוסף אסורות LI-4 Hegu, SP-6 Sanyinjiao, ומוקסה על REN-8 Shenque.\n- נקודות: HE-7 Shenmen.');
  });

  it('leaves the upper abdomen to a first-trimester question, never the lower', () => {
    const { removed } = strikePregnancyPoints('- REN-12 Zhongwan ו-REN-4 Guanyuan, PC-6 Neiguan', 'first');
    expect(removed).toEqual(['REN-4']);
  });
});

describe('finishCanonAnswer', () => {
  it("writes the practitioner's words and no hint of a search", () => {
    const { text } = finishCanonAnswer('לפי החומרים שנמצאו, מינון Chai Hu בדיקוקט הוא 3-9 גרם. העשבים האלה מרים. הרשימה נאספה מהמקורות שנמצאו ואינה בהכרח שלמה.');
    expect(text).toBe('מינון Chai Hu במרתח הוא 3-9 גרם. הצמחים האלה מרים.');
  });

  it('removes book names and talk of sources, and keeps "original"', () => {
    const { text, removed } = finishCanonAnswer('Chi Shao מר (בחלק מהמקורות: חמוץ). לפי Bensky הוא קריר. במקור הפורמולה ניתנת כאבקה (מרשם מקורי).');
    expect(text).not.toContain('Bensky');
    expect(text).not.toContain('מהמקורות');
    expect(text).toContain('(מרשם מקורי)');
    expect(removed.length).toBeGreaterThan(0);
  });

  it("writes Reidman's words: פורמולה, plain Hebrew, pulse qualities joined with ו", () => {
    const { text } = finishCanonAnswer('הנוסחה מתאימה לאג\'יטציה וכאב בהיפוגסטריום. דופק: עמוק-חלש, או מתגלגל-מהיר-מיתרי. אי-שקט. רוח-קור נשארת.');
    expect(text).toBe('הפורמולה מתאימה לאי שקט וכאב בבטן התחתונה. דופק: עמוק וחלש, או מתגלגל, מהיר ומיתרי. אי שקט. רוח-קור נשארת.');
  });

  it('writes point codes one way and pinyin without tone marks', () => {
    expect(finishCanonAnswer('L.I.-11 Quchi ו-Xiāo Yáo Sǎn').text).toBe('LI-11 Quchi ו-Xiao Yao San');
    expect(finishCanonAnswer('Ren-14, KI-14, TB-6 ו-Du Zhong').text).toBe('REN-14, KID-14, SJ-6 ו-Du Zhong');
  });
});

describe('applySafetyFixes and applyPinyinNames', () => {
  it('replaces a contradicting sentence in place, and ignores a fix it cannot find or that is not Hebrew', () => {
    const answer = '- SP-6 Sanyinjiao מותרת בהיריון.\n- HE-7 Shenmen מרגיעה.';
    const { text, applied } = applySafetyFixes(answer, [
      { quote: '- SP-6 Sanyinjiao מותרת בהיריון.', replacement: 'SP-6 Sanyinjiao אסורה בהיריון.' },
      { quote: 'משפט שלא קיים בתשובה', replacement: 'משהו' },
      { quote: 'HE-7 Shenmen מרגיעה.', replacement: 'قد يكون' },
    ]);
    expect(text).toBe('- SP-6 Sanyinjiao אסורה בהיריון.\n- HE-7 Shenmen מרגיעה.');
    expect(applied).toHaveLength(1);
  });

  it('puts pinyin back for a name written in Hebrew letters, only when it is a canon entry', () => {
    const { text, fixed } = applyPinyinNames('מוסיפים צ\'אי הו ו-טאנג קוי.', [
      { hebrew: "צ'אי הו", pinyin: 'Chai Hu' },
      { hebrew: 'טאנג קוי', pinyin: 'Not A Herb' },
    ], index);
    expect(text).toBe('מוסיפים Chai Hu ו-טאנג קוי.');
    expect(fixed).toEqual([{ hebrew: "צ'אי הו", pinyin: 'Chai Hu' }]);
  });
});

describe('answerFromCanon', () => {
  const deps = (replies: Record<string, string>, calls: CanonModelCall[], searched: string[][]): CanonDeps => ({
    model: async (call) => {
      calls.push(call);
      return replies[call.label] ?? '{}';
    },
    search: async ({ queries }) => {
      searched.push(queries);
      return [];
    },
    names: index,
    entries: async (ids) => ids.map((id) => byId.get(id)).filter((e): e is CanonEntry => Boolean(e)),
    pregnancyNote: async () => pregnancyPointsNote([sp6, bl67]),
    glossary: TCM_GLOSSARY,
  });

  it('answers a dose question from the entry alone: no search, no safety check, no cautions in the notes', async () => {
    const calls: CanonModelCall[] = [];
    const searched: string[][] = [];
    const result = await answerFromCanon(
      'מה המינון של Chai Hu?',
      [],
      deps({ plan: JSON.stringify({ english: 'What is the dose of Chai Hu?', type: 'fact', entities: [{ kind: 'herb', name: 'Chai Hu', aspects: ['dosage'] }] }), answer: 'מינון יומי במרתח: 3-9 גרם.', names: '{"names": []}' }, calls, searched),
    );
    expect(result.answer).toBe('מינון יומי במרתח: 3-9 גרם.');
    expect(searched).toEqual([]);
    expect(calls.map((c) => c.label)).toEqual(['plan', 'answer', 'names']);
    const [notes] = calls.find((c) => c.label === 'answer')!.content as { text: string }[];
    expect(notes!.text).toContain('3-9g');
    expect(notes!.text).not.toContain('Use with caution');
  });

  it('checks safety when the question states a pregnancy, and corrects the answer in place', async () => {
    const calls: CanonModelCall[] = [];
    const result = await answerFromCanon(
      'איפה נמצאת SP-6 והאם מותר לדקר אותה בהיריון?',
      [],
      deps(
        {
          plan: JSON.stringify({ english: 'Where is SP-6 and may it be needled in pregnancy?', type: 'safety', safety: true, entities: [{ kind: 'point', name: 'SP-6', aspects: ['location'] }] }),
          answer: 'SP-6 Sanyinjiao נמצאת 3 צון מעל המלאולוס. מותר לדקר אותה בהיריון.',
          safety: JSON.stringify({ fixes: [{ quote: 'מותר לדקר אותה בהיריון.', replacement: 'אסור לדקר אותה בהיריון.' }] }),
          names: '{"names": []}',
        },
        calls,
        [],
      ),
    );
    expect(calls.map((c) => c.label)).toEqual(['plan', 'answer', 'safety', 'names']);
    expect(result.answer).toBe('SP-6 Sanyinjiao נמצאת 3 צון מעל המלאולוס. אסור לדקר אותה בהיריון.');
    expect(JSON.stringify(calls.find((c) => c.label === 'answer')!.content)).toContain('Points contraindicated or cautioned in pregnancy');
  });

  it('gives a complex question a second round before it is written', async () => {
    const calls: CanonModelCall[] = [];
    const searched: string[][] = [];
    await answerFromCanon(
      'גבר בן 48, הזעות לילה ועצבנות. מה האבחנה המבדלת?',
      [],
      deps({ plan: JSON.stringify({ english: 'Differential for night sweats and irritability', type: 'case', complex: true, patterns: ['Kidney-Yin deficiency'] }), 'what is missing': '{"entities": [], "searches": ["Liver-Qi stagnation with heat"]}', 'answer (complex)': 'תשובה', names: '{"names": []}' }, calls, searched),
    );
    expect(calls.map((c) => c.label)).toEqual(['plan', 'what is missing', 'answer (complex)', 'names']);
    expect(searched).toHaveLength(2);
    expect(calls.find((c) => c.label === 'answer (complex)')!.effort).toBe('medium');
    // The instructions are kept an hour, for the questions of a conversation; the notes five minutes.
    expect((calls.find((c) => c.label === 'answer (complex)')!.system as { cache_control?: { ttl?: string } }[])[0]!.cache_control).toEqual({ type: 'ephemeral', ttl: '1h' });
    expect(JSON.stringify(calls.find((c) => c.label === 'answer (complex)')!.content)).toContain('"cache_control":{"type":"ephemeral"}');
    // The same effort in both calls, or the notes cached by the first are written again by the second.
    expect(calls.find((c) => c.label === 'what is missing')!.effort).toBe('medium');
  });

  it('reads the course layer only on the switch: its own search, at most four marked notes, and never a dose from it', async () => {
    const course = Array.from({ length: 6 }, (_, i) => ({ id: String(i), entry: null, section: null, heading: 'דיאגנוזה', text: `קטע קורס ${i}: Chai Hu במינון 20 גרם.` }));
    const run = async (on: boolean) => {
      const calls: CanonModelCall[] = [];
      const searches: { course?: boolean; queries: string[] }[] = [];
      const result = await answerFromCanon('איך מטפלים בתקיעות צ\'י הכבד?', [], {
        ...deps({ plan: JSON.stringify({ english: 'Treating Liver-Qi stagnation', type: 'treatment' }), answer: 'Chai Hu מניע צ\'י. Chai Hu במינון 20 גרם.', names: '{"names": []}' }, calls, []),
        search: async (input) => {
          searches.push({ course: input.course, queries: input.queries });
          return input.course ? course : [];
        },
        course: on,
      });
      return { calls, searches, result };
    };
    const off = await run(false);
    expect(off.searches.every((s) => !s.course)).toBe(true);
    const on = await run(true);
    const courseSearch = on.searches.find((s) => s.course);
    expect(courseSearch!.queries[0]).toBe('איך מטפלים בתקיעות צ\'י הכבד?');
    const notes = JSON.stringify(on.calls.find((c) => c.label === 'answer')!.content);
    expect(notes.match(/about=\\"course: /g)).toHaveLength(4);
    expect(on.result.answer).toBe('Chai Hu מניע צ\'י.');
  });
});

describe('the answer instructions', () => {
  // The practitioner's corrections on a Bai Hu Tang answer (17.9): a composition is
  // name, amount, unit and nothing else; the words are Bara's.
  const system = canonAnswerSystem(TCM_GLOSSARY);

  it('does not label a decoction dose', () => {
    expect(system).not.toContain('always say which kind of amount');
    expect(system).toContain('- Shi Gao — 30-90 גרם');
  });

  it('names the stages and levels the way Israeli practitioners do', () => {
    for (const term of ['שכבת ה-Yang Ming', "רמת הצ'י", 'קיסר', 'משרת', 'מנקז אש']) expect(system).toContain(term);
    // Checked against Reidman's course material (17.9), and the practitioner's choices where it and Bara differ.
    for (const term of ['לחות חמה', 'מעטפת הלב', 'שלושת המחממים', 'מזין דם', 'דפוס', 'מכבה רוח פנימית', 'Wei Qi']) expect(system).toContain(term);
    for (const term of ['לחות-חום', 'קרום הלב', "סאן ג'יאו", 'מחזק דם']) expect(system).not.toContain(term);
    expect(system).not.toContain('סטגנציה');
  });
});
