import { normalizeName } from '@/features/assistant/outbound';

/**
 * Whether a library question names one of the clinic's patients in full.
 *
 * The library sends its question to the model, and a question there is about a
 * condition, never about a person — so a patient's name has no business in it.
 * The assistant's check is stricter (first names alone, nicknames, the same name
 * in Latin letters), and here that would refuse the questions the library exists
 * for: its questions are full of pinyin, and a patient called דן would stop every
 * question about Dan Shen. So only the certain case stops a question: a first
 * and a last name of the same patient, side by side in either order, in Hebrew.
 * A first name alone passes (the user's decision, 19.9); the refusal asks for
 * the question again without the name.
 */
export interface PatientName {
  first_name: string | null;
  last_name: string | null;
}

/** One-letter Hebrew prefixes a name can carry: "לרחל", "ורחל", "מרחל". */
const PREFIXES = /^[ולבכמשה]/;

const HEBREW_WORD = /[א-ת֑-ׇ"'׳״-]+/g;

function forms(word: string): string[] {
  const plain = normalizeName(word);
  if (!plain) return [];
  // "לרחל" is "רחל" with a preposition; a two-letter name keeps its first
  // letter, or "בן" would be read as "ן".
  return plain.length > 2 && PREFIXES.test(plain) ? [plain, plain.slice(1)] : [plain];
}

function nameParts(value: string | null): string[] {
  return (value ?? '')
    .split(/[\s-]+/)
    .map((part) => normalizeName(part))
    .filter((part) => part.length > 1);
}

export function mentionsPatientFullName(text: string, patients: readonly PatientName[]): boolean {
  const words = String(text ?? '').match(HEBREW_WORD) ?? [];
  if (words.length < 2) return false;
  const keys = words.map(forms);
  const pairs = new Set<string>();
  for (const patient of patients) {
    const firsts = nameParts(patient.first_name);
    const lasts = nameParts(patient.last_name);
    for (const first of firsts) for (const last of lasts) pairs.add(`${first} ${last}`);
  }
  if (pairs.size === 0) return false;
  for (let i = 0; i + 1 < keys.length; i += 1) {
    for (const a of keys[i]!) {
      for (const b of keys[i + 1]!) {
        // Either order: "רחל כהן" and "כהן רחל" are the same person.
        if (pairs.has(`${a} ${b}`) || pairs.has(`${b} ${a}`)) return true;
      }
    }
  }
  return false;
}
