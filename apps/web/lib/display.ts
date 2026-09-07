import type { Locale, TreatmentStatus } from '@clinic/domain';

/**
 * Naming helpers.
 *
 * Herbs and formulas are named in English and Chinese regardless of which
 * language the interface is in. That is deliberate: the materia medica is shared
 * internationally in those two forms, a supplier's label is in Chinese, and a
 * Hebrew transliteration is a local convenience rather than an identifier. Pinyin
 * rides along as the romanised form the profession speaks in.
 *
 * The `locale` argument is kept so callers stay uniform and so a future language
 * with its own established herb naming can be honoured without touching them.
 */

interface HerbNames {
  pinyin_name?: string | null;
  chinese_name?: string | null;
  english_name?: string | null;
  hebrew_name?: string | null;
  botanical_name?: string | null;
}

/* eslint-disable @typescript-eslint/no-unused-vars */

/**
 * The headline name: pinyin.
 *
 * Pinyin is what the practitioner says out loud and what a formula is written
 * in, so it leads. Chinese characters sit beside it and the botanical binomial
 * stands on its own line, because those answer different questions — what the
 * supplier's label says, and which plant this actually is.
 */
export function herbPrimaryName(herb: HerbNames | null | undefined, _locale?: Locale): string {
  if (!herb) return '';
  return (
    herb.pinyin_name?.trim() ||
    herb.english_name?.trim() ||
    herb.chinese_name?.trim() ||
    herb.hebrew_name?.trim() ||
    ''
  );
}

/** The Chinese characters, shown next to the pinyin. */
export function herbChineseName(herb: HerbNames | null | undefined): string {
  if (!herb) return '';
  const chinese = herb.chinese_name?.trim() ?? '';
  return chinese === herbPrimaryName(herb) ? '' : chinese;
}

/** The Latin binomial, kept on its own line as the unambiguous identifier. */
export function herbBotanicalName(herb: HerbNames | null | undefined): string {
  return herb?.botanical_name?.trim() ?? '';
}

/**
 * Supporting line for compact places (search results, pickers) where there is
 * room for one line rather than three: Chinese, then the botanical name, then
 * the English common name if it adds anything.
 */
export function herbSecondaryName(herb: HerbNames | null | undefined, _locale?: Locale): string {
  if (!herb) return '';
  const primary = herbPrimaryName(herb);
  const parts = [herb.chinese_name, herb.botanical_name, herb.english_name]
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

/** Pinyin leads here too: a formula is known by its classical name, Xiao Yao San. */
export function formulaPrimaryName(formula: FormulaNames | null | undefined, _locale?: Locale): string {
  if (!formula) return '';
  return (
    formula.name_pinyin?.trim() ||
    formula.name_english?.trim() ||
    formula.name_chinese?.trim() ||
    formula.name_hebrew?.trim() ||
    ''
  );
}

export function formulaChineseName(formula: FormulaNames | null | undefined): string {
  if (!formula) return '';
  const chinese = formula.name_chinese?.trim() ?? '';
  return chinese === formulaPrimaryName(formula) ? '' : chinese;
}

export function formulaSecondaryName(formula: FormulaNames | null | undefined, _locale?: Locale): string {
  if (!formula) return '';
  const primary = formulaPrimaryName(formula);
  const parts = [formula.name_chinese, formula.name_english]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value) && value !== primary);
  return parts.join(' · ');
}
/* eslint-enable @typescript-eslint/no-unused-vars */

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

/**
 * The badge colour for a patient's status.
 *
 * Green for in-treatment and for a full recovery, red only for a course that
 * did not help, amber for someone who stopped partway — the onestate worth
 * noticing — and neutral for the rest. Colour is never the only signal: the
 * badge always carries its label.
 */
export function patientStatusTone(
  status: TreatmentStatus | null | undefined,
): 'success' | 'danger' | 'warning' | 'neutral' | 'muted' {
  switch (status) {
    case 'full_success':
      return 'success';
    case 'active':
    case null:
    case undefined:
      return 'success';
    case 'unsuccessful':
      return 'danger';
    case 'dropped_out':
      return 'warning';
    case 'inactive':
      return 'muted';
    default:
      return 'neutral';
  }
}
