import { describe, expect, it } from 'vitest';
import { answerBlocks, chatTitleFrom, displayAnswer, historyTurns, inlineRuns } from '@clinic/domain';

describe('historyTurns', () => {
  it('leaves out a question refused for an identifier, with its refusal, and keeps the rest of the conversation', () => {
    const messages = [
      { role: 'user' as const, status: null, content: 'מה ההרכב של Si Wu Tang?' },
      { role: 'assistant' as const, status: 'answered', content: 'Shu Di Huang, Dang Gui…' },
      { role: 'user' as const, status: null, content: 'והמטופלת עם ת.ז 000000018?' },
      { role: 'assistant' as const, status: 'refused_pii', content: 'השאלה כוללת פרט מזהה…' },
      { role: 'user' as const, status: null, content: 'ומה עם Ba Zhen Tang?' },
      { role: 'assistant' as const, status: 'answered', content: 'Si Wu Tang ועוד Si Jun Zi Tang…' },
    ];
    expect(historyTurns(messages).map((m) => m.content)).toEqual(['מה ההרכב של Si Wu Tang?', 'Shu Di Huang, Dang Gui…', 'ומה עם Ba Zhen Tang?', 'Si Wu Tang ועוד Si Jun Zi Tang…']);
  });
});

describe('displayAnswer', () => {
  it('drops the citation markers and the spaces they leave', () => {
    expect(displayAnswer('Sheng Jiang warms the middle [2][4]. Dose 3-9 g [1] .')).toBe('Sheng Jiang warms the middle. Dose 3-9 g.');
    expect(displayAnswer('שורה ראשונה [1, 2]\nשורה שנייה [3]')).toBe('שורה ראשונה\nשורה שנייה');
  });
});

describe('answerBlocks', () => {
  it('reads headings, paragraphs and both kinds of list, in order', () => {
    const blocks = answerBlocks(
      ['**הרכב:**', '', '## התוויות', 'שורה אחת [1]', 'שורה שתיים', '', '- Dang Gui 9 g [2]', '- Bai Shao 9 g', '', '1. ראשון', '2) שני', 'המשך של שני'].join('\n'),
    );
    expect(blocks).toEqual([
      { type: 'paragraph', text: '**הרכב:**' },
      { type: 'heading', text: 'התוויות' },
      { type: 'paragraph', text: 'שורה אחת\nשורה שתיים' },
      { type: 'list', ordered: false, items: ['Dang Gui 9 g', 'Bai Shao 9 g'] },
      { type: 'list', ordered: true, items: ['ראשון', 'שני\nהמשך של שני'] },
    ]);
  });

  it('gives an empty answer no blocks', () => {
    expect(answerBlocks('')).toEqual([]);
    expect(answerBlocks('  \n [1] \n')).toEqual([]);
  });
});

describe('inlineRuns', () => {
  it('splits bold from plain and leaves a lone marker alone', () => {
    expect(inlineRuns('מינון **9 גרם** ליום')).toEqual([
      { text: 'מינון ', bold: false },
      { text: '9 גרם', bold: true },
      { text: ' ליום', bold: false },
    ]);
    expect(inlineRuns('בלי **הדגשה')).toEqual([{ text: 'בלי **הדגשה', bold: false }]);
  });
});

describe('chatTitleFrom', () => {
  it('names a conversation after the first line of its first question, cut at a word', () => {
    expect(chatTitleFrom('מה ההרכב של Si Wu Tang?\nועוד שאלה')).toBe('מה ההרכב של Si Wu Tang?');
    const long = 'אילו נקודות דיקור מומלצות לכאב ראש מעליית יאנג הכבד ומה ההסבר לכל אחת מהן לפי המקורות';
    const title = chatTitleFrom(long);
    expect(title.length).toBeLessThanOrEqual(61);
    expect(title.endsWith('…')).toBe(true);
    expect(title).not.toMatch(/\s…$/);
    expect(chatTitleFrom('   ')).toBe('');
  });
});
