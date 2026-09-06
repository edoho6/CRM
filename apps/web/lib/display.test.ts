import { describe, expect, it } from 'vitest';
import {
  ageFromDateOfBirth,
  appointmentTypeName,
  formulaPrimaryName,
  herbPrimaryName,
  herbSecondaryName,
  patientFullName,
} from './display';

/**
 * Naming rules for reference data.
 *
 * Herbs and formulas are named in English and Chinese whatever the interface
 * language is: that is how the materia medica is shared internationally and how
 * a supplier labels a jar. The tests below pin that behaviour so a future
 * "translate everything" change cannot quietly undo it.
 */
describe('herb naming', () => {
  const fullyNamed = {
    pinyin_name: 'Huang Qi',
    chinese_name: '黄芪',
    english_name: 'Astragalus root',
    hebrew_name: 'חואנג צ׳י',
  };

  it('shows the English name in both interface languages', () => {
    expect(herbPrimaryName(fullyNamed, 'he')).toBe('Astragalus root');
    expect(herbPrimaryName(fullyNamed, 'en')).toBe('Astragalus root');
  });

  it('falls back to pinyin, then Chinese, when there is no English name', () => {
    expect(herbPrimaryName({ ...fullyNamed, english_name: null }, 'he')).toBe('Huang Qi');
    expect(
      herbPrimaryName({ ...fullyNamed, english_name: null, pinyin_name: null }, 'he'),
    ).toBe('黄芪');
  });

  it('uses a Hebrew name only when nothing else exists', () => {
    expect(
      herbPrimaryName(
        { pinyin_name: null, chinese_name: null, english_name: null, hebrew_name: 'חואנג צ׳י' },
        'he',
      ),
    ).toBe('חואנג צ׳י');
  });

  it('returns an empty string for a missing herb rather than throwing', () => {
    expect(herbPrimaryName(null, 'he')).toBe('');
    expect(herbPrimaryName(undefined, 'en')).toBe('');
  });

  it('shows pinyin and Chinese underneath, never repeating the primary', () => {
    expect(herbSecondaryName(fullyNamed, 'he')).toBe('Huang Qi · 黄芪');
    expect(herbSecondaryName(fullyNamed, 'en')).toBe('Huang Qi · 黄芪');
    // When pinyin is promoted to primary it must not also appear beneath itself.
    expect(herbSecondaryName({ ...fullyNamed, english_name: null }, 'he')).toBe('黄芪');
  });
});

describe('formula naming', () => {
  it('follows the same English-then-pinyin chain', () => {
    expect(
      formulaPrimaryName(
        { name_pinyin: 'Xiao Yao San', name_chinese: null, name_english: null, name_hebrew: null },
        'he',
      ),
    ).toBe('Xiao Yao San');
    expect(
      formulaPrimaryName(
        {
          name_pinyin: 'Xiao Yao San',
          name_chinese: '逍遥散',
          name_english: 'Free and Easy Wanderer',
          name_hebrew: 'שיאו יאו סאן',
        },
        'he',
      ),
    ).toBe('Free and Easy Wanderer');
  });
});

describe('appointmentTypeName', () => {
  it('falls back to the other language when one is blank', () => {
    expect(appointmentTypeName({ name_he: '', name_en: 'Follow-up' }, 'he')).toBe('Follow-up');
  });
});

describe('ageFromDateOfBirth', () => {
  it('returns null when the date is missing or unparseable', () => {
    expect(ageFromDateOfBirth(null)).toBeNull();
    expect(ageFromDateOfBirth('not a date')).toBeNull();
  });

  it('does not count a birthday that has not happened yet this year', () => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const dob = `${today.getFullYear() - 30}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(
      tomorrow.getDate(),
    ).padStart(2, '0')}`;
    const age = ageFromDateOfBirth(dob);
    expect(age === 29 || age === 30).toBe(true);
  });

  it('rejects an implausible age rather than showing a wrong number', () => {
    expect(ageFromDateOfBirth('1500-01-01')).toBeNull();
  });
});

describe('patientFullName', () => {
  it('uses the generated full name when present', () => {
    expect(patientFullName({ first_name: 'א', last_name: 'ב', full_name: 'א ב' })).toBe('א ב');
  });

  it('composes from the parts when the generated column is absent', () => {
    expect(patientFullName({ first_name: 'Dana', last_name: 'Levi' })).toBe('Dana Levi');
  });

  it('handles a missing patient', () => {
    expect(patientFullName(null)).toBe('');
  });
});
