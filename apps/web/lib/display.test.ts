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
 * Naming rules for bilingual reference data. The requirement these encode: a
 * practitioner must be able to find a herb by whichever of its four names is in
 * their head, and must never see a blank row because one language is missing.
 */
describe('herb naming', () => {
  const fullyNamed = {
    pinyin_name: 'Huang Qi',
    chinese_name: '黄芪',
    english_name: 'Astragalus root',
    hebrew_name: 'חואנג צ׳י',
  };

  it('prefers the reader’s language', () => {
    expect(herbPrimaryName(fullyNamed, 'he')).toBe('חואנג צ׳י');
    expect(herbPrimaryName(fullyNamed, 'en')).toBe('Astragalus root');
  });

  it('falls back to pinyin when the localised name is missing', () => {
    expect(herbPrimaryName({ ...fullyNamed, hebrew_name: null }, 'he')).toBe('Huang Qi');
  });

  it('never returns an empty string when any name exists', () => {
    expect(
      herbPrimaryName(
        { pinyin_name: null, chinese_name: '黄芪', english_name: null, hebrew_name: null },
        'he',
      ),
    ).toBe('黄芪');
  });

  it('returns an empty string for a missing herb rather than throwing', () => {
    expect(herbPrimaryName(null, 'he')).toBe('');
    expect(herbPrimaryName(undefined, 'en')).toBe('');
  });

  it('keeps pinyin visible as the secondary line without repeating the primary', () => {
    expect(herbSecondaryName(fullyNamed, 'he')).toBe('Huang Qi · 黄芪');
    // In English the primary is the English name, so pinyin still shows.
    expect(herbSecondaryName(fullyNamed, 'en')).toBe('Huang Qi · 黄芪');
    // When pinyin *is* the primary it must not be repeated underneath itself.
    expect(herbSecondaryName({ ...fullyNamed, hebrew_name: null }, 'he')).toBe('黄芪');
  });
});

describe('formula naming', () => {
  it('follows the same fallback chain', () => {
    expect(
      formulaPrimaryName(
        { name_pinyin: 'Xiao Yao San', name_chinese: null, name_english: null, name_hebrew: null },
        'he',
      ),
    ).toBe('Xiao Yao San');
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
