/**
 * Names of the Western medicine reference found in free text.
 *
 * A patient file says "מטפורמין 850 פעמיים ביום" and "סובל מיתר לחץ דם"; a
 * treatment record says "asthma, well controlled". The text stays free — a
 * practitioner writes as they write — and the reference is one click away
 * from every name it recognises. The matching is deliberately plain: whole
 * words only, so "meth" never finds methotrexate; a Hebrew name may carry a
 * one- or two-letter prefix (בסוכרת, ולאסתמה); a Latin name may be plural.
 * Short names are skipped, because a two-letter abbreviation matches
 * everything ("AD" once joined Alzheimer's to atopic dermatitis).
 */

export type MentionKind = 'condition' | 'symptom' | 'drug' | 'lab_test';

/** An entry as the index knows it: its id, its address, and every name it answers to. */
export interface MentionCandidate {
  id: string;
  slug: string;
  kind: MentionKind;
  /** What the chip shows: the Hebrew name, else the English. */
  label: string;
  names: readonly string[];
}

/** A candidate with its names compiled once, for an index that serves many texts. */
export interface PreparedMentionCandidate extends MentionCandidate {
  patterns: readonly RegExp[];
}

/** An entry recognised in a text. */
export interface MedicineMention {
  id: string;
  slug: string;
  kind: MentionKind;
  label: string;
}

const HEBREW = /[֐-׿]/;
/** ב, ל, ה, ו, מ, ש, כ — alone or two of them (ולסוכרת). */
const HEBREW_PREFIX = '(?:[בלהומשכ]{1,2})?';

/** Lower case, one kind of apostrophe, letters and digits only, single spaces. */
export function normalizeMentionText(text: string | null | undefined): string {
  return String(text ?? '')
    .toLowerCase()
    .replace(/[’‘`׳]/g, "'")
    .replace(/[^a-z0-9֐-׿' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** The pattern that finds one name as a whole word, or null when the name is too short to trust. */
export function mentionPattern(name: string): RegExp | null {
  const needle = normalizeMentionText(name);
  const hebrew = HEBREW.test(needle);
  if (needle.length < (hebrew ? 3 : 4)) return null;
  return hebrew ? new RegExp(` ${HEBREW_PREFIX}${escapeRegExp(needle)} `) : new RegExp(` ${escapeRegExp(needle)}(?:s|es)? `);
}

export function prepareMentionIndex(candidates: readonly MentionCandidate[]): PreparedMentionCandidate[] {
  return candidates
    .map((candidate) => ({
      ...candidate,
      patterns: candidate.names.map(mentionPattern).filter((pattern): pattern is RegExp => pattern !== null),
    }))
    .filter((candidate) => candidate.patterns.length > 0);
}

/**
 * The entries a text mentions, in the order the text mentions them. Each
 * entry once, however many of its names appear.
 */
export function findMentions(text: string, index: readonly PreparedMentionCandidate[]): MedicineMention[] {
  const haystack = ` ${normalizeMentionText(text)} `;
  if (haystack.trim().length < 3) return [];
  const found: (MedicineMention & { at: number })[] = [];
  for (const candidate of index) {
    let at = -1;
    for (const pattern of candidate.patterns) {
      const match = pattern.exec(haystack);
      if (match && (at < 0 || match.index < at)) at = match.index;
    }
    if (at >= 0) found.push({ id: candidate.id, slug: candidate.slug, kind: candidate.kind, label: candidate.label, at });
  }
  return found
    .sort((a, b) => a.at - b.at || a.label.localeCompare(b.label))
    .map(({ at: _at, ...mention }) => mention);
}
