import {
  TREATMENT_STATUS_TONES,
  type Locale,
  type StatusTone,
  type TreatmentStatus,
} from '@clinic/domain';

/**
 * Naming helpers.
 *
 * Herbs, formulas and points are named in pinyin, Chinese and English
 * regardless of which language the interface is in. That is deliberate: the
 * materia medica is shared internationally in those forms, and a supplier's
 * label is in Chinese. A Hebrew transliteration is not an identifier — two
 * practitioners spell the same herb three ways — so the interface does not
 * carry one (15.9).
 *
 * The `locale` argument is kept so callers stay uniform and so a future language
 * with its own established herb naming can be honoured without touching them.
 */

interface HerbNames {
  pinyin_name?: string | null;
  chinese_name?: string | null;
  english_name?: string | null;
  botanical_name?: string | null;
}

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

interface FormulaNames {
  name_pinyin?: string | null;
  name_chinese?: string | null;
  name_english?: string | null;
}

/** Pinyin leads here too: a formula is known by its classical name, Xiao Yao San. */
export function formulaPrimaryName(formula: FormulaNames | null | undefined, _locale?: Locale): string {
  if (!formula) return '';
  return (
    formula.name_pinyin?.trim() ||
    formula.name_english?.trim() ||
    formula.name_chinese?.trim() ||
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
 * Blue for in-treatment, green for a full recovery, red only for a course that
 * did not help, amber for someone who stopped partway — the one state worth
 * noticing — and neutral for the rest. Colour is never the only signal: the
 * badge always carries its label.
 *
 * In-treatment and recovered used to share the green, which made the two
 * outcomes a practitioner most needs to tell apart look identical on the
 * patient list. "Still going" is the in-progress blue; green is reserved for
 * done.
 */
export function patientStatusTone(
  status: TreatmentStatus | null | undefined,
): StatusTone {
  // Null is a file nobody has classified yet, which is a file in treatment.
  return TREATMENT_STATUS_TONES[status ?? 'active'];
}
