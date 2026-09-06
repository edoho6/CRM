import type { Locale } from '@clinic/domain';

/**
 * Naming helpers.
 *
 * A herb has up to four names and a practitioner may know it by any of them. The
 * rule is: show the name in the reader's language when it exists, but always keep
 * pinyin visible as the secondary line, because pinyin is the identifier the
 * profession actually shares.
 */

interface HerbNames {
  pinyin_name?: string | null;
  chinese_name?: string | null;
  english_name?: string | null;
  hebrew_name?: string | null;
}

export function herbPrimaryName(herb: HerbNames | null | undefined, locale: Locale): string {
  if (!herb) return '';
  const localised = locale === 'he' ? herb.hebrew_name : herb.english_name;
  return (
    localised?.trim() ||
    herb.pinyin_name?.trim() ||
    herb.english_name?.trim() ||
    herb.hebrew_name?.trim() ||
    herb.chinese_name?.trim() ||
    ''
  );
}

export function herbSecondaryName(herb: HerbNames | null | undefined, locale: Locale): string {
  if (!herb) return '';
  const primary = herbPrimaryName(herb, locale);
  const parts = [herb.pinyin_name, herb.chinese_name]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value) && value !== primary);
  return parts.join(' · ');
}

/** Searchable haystack covering every name a user might type. */
export function herbSearchText(herb: HerbNames): string {
  return [herb.pinyin_name, herb.chinese_name, herb.english_name, herb.hebrew_name]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

interface FormulaNames {
  name_pinyin?: string | null;
  name_chinese?: string | null;
  name_english?: string | null;
  name_hebrew?: string | null;
}

export function formulaPrimaryName(formula: FormulaNames | null | undefined, locale: Locale): string {
  if (!formula) return '';
  const localised = locale === 'he' ? formula.name_hebrew : formula.name_english;
  return (
    localised?.trim() ||
    formula.name_pinyin?.trim() ||
    formula.name_english?.trim() ||
    formula.name_hebrew?.trim() ||
    formula.name_chinese?.trim() ||
    ''
  );
}

export function formulaSecondaryName(formula: FormulaNames | null | undefined, locale: Locale): string {
  if (!formula) return '';
  const primary = formulaPrimaryName(formula, locale);
  const parts = [formula.name_pinyin, formula.name_chinese]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value) && value !== primary);
  return parts.join(' · ');
}

export function appointmentTypeName(
  type: { name_he?: string | null; name_en?: string | null } | null | undefined,
  locale: Locale,
): string {
  if (!type) return '';
  return (locale === 'he' ? type.name_he : type.name_en)?.trim() || type.name_en?.trim() || type.name_he?.trim() || '';
}

/** Whole years between a date of birth and today; null when unknown. */
export function ageFromDateOfBirth(dateOfBirth: string | null | undefined): number | null {
  if (!dateOfBirth) return null;
  const born = new Date(dateOfBirth);
  if (Number.isNaN(born.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - born.getFullYear();
  const monthDelta = today.getMonth() - born.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < born.getDate())) {
    age -= 1;
  }
  return age >= 0 && age < 130 ? age : null;
}

export function patientFullName(
  patient: { first_name?: string | null; last_name?: string | null; full_name?: string | null } | null | undefined,
): string {
  if (!patient) return '';
  if (patient.full_name?.trim()) return patient.full_name.trim();
  return [patient.first_name, patient.last_name].filter(Boolean).join(' ').trim();
}
