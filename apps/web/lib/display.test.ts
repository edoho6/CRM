import { describe, expect, it } from 'vitest';
import {
  ageFromDateOfBirth,
  appointmentTypeName,
  formulaPrimaryName,
  herbBotanicalName,
  herbChineseName,
  herbPrimaryName,
  herbSecondaryName,
  patientFullName,
} from './display';

/**
 * Naming rules for reference data.
 *
 * Three names, three jobs: pinyin is what the practitioner says and leads;
 * Chinese characters are what the supplier's label shows and sit beside it; the
 * botanical binomial identifies the plant and stands alone. The interface
 * language does not change any of that, and these tests pin it so a future
 * "translate everything" change cannot quietly undo it.
 */
describe('herb naming', () => {
  const fullyNamed = {
    pinyin_name: 'Huang Qi',
    chinese_name: '黄芪',
    english_name: 'Astragalus root',
    botanical_name: 'Astragalus membranaceus (Radix)',
  };

  it('leads with pinyin in both interface languages', () => {
    expect(herbPrimaryName(fullyNamed, 'he')).toBe('Huang Qi');
    expect(herbPrimaryName(fullyNamed, 'en')).toBe('Huang Qi');
  });

  it('falls back to English, then Chinese, when there is no pinyin', () => {
    expect(herbPrimaryName({ ...fullyNamed, pinyin_name: null }, 'he')).toBe('Astragalus root');
    expect(
      herbPrimaryName({ ...fullyNamed, pinyin_name: null, english_name: null }, 'he'),
    ).toBe('黄芪');
  });

  it('never reads a Hebrew name, even from a row that still carries one', () => {
    // The column survives in the database, filled by older imports; nothing in
    // the interface reads it. A herb with no international name is nameless
    // here rather than named in a transliteration only this clinic would
    // recognise (15.9).
    const legacy: Record<string, string | null> = {
      pinyin_name: null,
      chinese_name: null,
      english_name: null,
      botanical_name: null,
      hebrew_name: 'חואנג צ׳י',
    };
    expect(herbPrimaryName(legacy, 'he')).toBe('');
  });

  it('returns an empty string for a missing herb rather than throwing', () => {
    expect(herbPrimaryName(null, 'he')).toBe('');
    expect(herbPrimaryName(undefined, 'en')).toBe('');
    expect(herbChineseName(null)).toBe('');
    expect(herbBotanicalName(undefined)).toBe('');
  });

  it('exposes the Chinese and botanical names separately', () => {
    expect(herbChineseName(fullyNamed)).toBe('黄芪');
    expect(herbBotanicalName(fullyNamed)).toBe('Astragalus membranaceus (Radix)');
  });

  it('never repeats the primary name in the Chinese slot', () => {
    // A herb with only Chinese characters has them promoted to primary; showing
    // them again beside themselves would be noise.
    const chineseOnly = {
      pinyin_name: null,
      english_name: null,
      botanical_name: null,
      chinese_name: '黄芪',
    };
    expect(herbPrimaryName(chineseOnly)).toBe('黄芪');
    expect(herbChineseName(chineseOnly)).toBe('');
  });

  it('packs the supporting names into one line for compact places', () => {
    expect(herbSecondaryName(fullyNamed, 'he')).toBe(
      '黄芪 · Astragalus membranaceus (Radix) · Astragalus root',
    );
  });
});

describe('formula naming', () => {
  it('leads with the classical pinyin name', () => {
    expect(
      formulaPrimaryName(
        { name_pinyin: 'Xiao Yao San', name_chinese: null, name_english: null },
        'he',
      ),
    ).toBe('Xiao Yao San');
    expect(
      formulaPrimaryName(
        {
          name_pinyin: 'Xiao Yao San',
          name_chinese: '逍遥散',
          name_english: 'Free and Easy Wanderer',
        },
        'he',
      ),
    ).toBe('Xiao Yao San');
  });

  it('falls back to English when there is no pinyin', () => {
    expect(
      formulaPrimaryName(
        {
          name_pinyin: null,
          name_chinese: null,
          name_english: 'Free and Easy Wanderer',
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
