import { describe, expect, it } from 'vitest';
import { mentionsPatientFullName } from '@/features/library/patient-names';

const patients = [
  { first_name: 'רחל', last_name: 'כהן' },
  { first_name: 'דן', last_name: 'לוי' },
  { first_name: 'שרה', last_name: 'בן-דוד' },
];

describe('a library question that names a patient in full', () => {
  it('stops a first and a last name side by side, in either order', () => {
    expect(mentionsPatientFullName('רחל כהן סובלת מכאבי ראש, מה לתת?', patients)).toBe(true);
    expect(mentionsPatientFullName('מה מתאים לכהן רחל עם עייפות?', patients)).toBe(true);
  });

  it('sees through a prefix, niqqud and a final letter', () => {
    expect(mentionsPatientFullName('מה לתת לרחל כהן', patients)).toBe(true);
    expect(mentionsPatientFullName('רָחֵל כֹּהֵן', patients)).toBe(true);
  });

  it('matches each part of a hyphenated surname', () => {
    expect(mentionsPatientFullName('שרה דוד מתלוננת על נדודי שינה', patients)).toBe(true);
  });

  it('lets a first name alone pass — the user chose the narrow check', () => {
    expect(mentionsPatientFullName('איך לטפל ברחל שסובלת ממיגרנות?', patients)).toBe(false);
  });

  it('never stops pinyin, even when a patient is called דן', () => {
    expect(mentionsPatientFullName('Dan Shen and Chuan Xiong for blood stasis', patients)).toBe(
      false,
    );
    expect(mentionsPatientFullName('מה ההבדל בין Dan Shen לבין Hong Hua?', patients)).toBe(false);
  });

  it('does not join two different patients into one', () => {
    expect(mentionsPatientFullName('רחל לוי', patients)).toBe(false);
  });

  it('passes a clinical question with no names at all', () => {
    expect(mentionsPatientFullName('טיפול בכאב גב תחתון אצל אישה בת 40', patients)).toBe(false);
    expect(mentionsPatientFullName('', patients)).toBe(false);
    expect(mentionsPatientFullName('רחל כהן', [])).toBe(false);
  });
});
