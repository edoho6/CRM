/**
 * The professional library — the rules the assistant lives by, as data and
 * pure functions, so the API, the page and the tests share one copy.
 *
 * Three things are decided here and nowhere else: what counts as a
 * patient's identifying detail (a question carrying one is refused before
 * any model sees it), what makes an answer grounded (every citation points
 * at a passage that was retrieved, every number in it appears in those
 * passages), and the disclaimer that goes under every answer.
 */

/** Statuses the API answers with; the audit log stores the same words. */
export type LibraryStatus = 'answered' | 'no_sources' | 'refused_pii' | 'refused_quota' | 'error';

export interface LibraryCitation {
  /** The [n] the answer refers to. */
  n: number;
  sourceId: string;
  title: string;
  url: string | null;
  page: number | null;
  /** The passage, trimmed for the page; the whole of it stayed on the server. */
  quote: string;
}

export interface LibraryAnswer {
  status: LibraryStatus;
  answer: string;
  citations: LibraryCitation[];
  /** Always present, always this text: the page shows it under every answer. */
  disclaimer: string;
}

/**
 * Where an answer is on its way, for the page to say while it waits. The
 * text itself is never sent early: it is checked first, then sent whole —
 * a sentence the checks would strike must not be read before they strike it.
 */
export type LibraryStage = 'searching' | 'reading' | 'writing' | 'checking';

/** One line of the streamed reply (`application/x-ndjson`): stages, then the answer. */
export type LibraryStreamEvent =
  | { type: 'stage'; stage: LibraryStage; passages?: number }
  | { type: 'done'; reply: LibraryAnswer };

/**
 * Working wording, to be approved by the lawyer who reads /privacy and
 * /terms (GO-LIVE.md). It says three things: what this is (a reading aid
 * over sources the clinic chose), what it is not (advice, a substitute for
 * judgement), and who answers for a decision (the practitioner).
 */
export const LIBRARY_DISCLAIMER_HE =
  'המידע כאן הוא כלי עזר בלבד, שנכתב אוטומטית מתוך מקורות שהוזנו לספרייה המקצועית, ' +
  'ואינו ייעוץ רפואי ואינו תחליף לשיקול דעת מקצועי, לבדיקה במקור עצמו או לעלון התכשיר. ' +
  'האחריות המקצועית והמשפטית לכל החלטה טיפולית היא של המטפל או המטפלת בלבד. ' +
  'אין להזין כאן פרטים מזהים או מידע רפואי של מטופלים.';

/** What the API holds itself to. */
export const LIBRARY_LIMITS = {
  /** Characters in one question. */
  questionChars: 1000,
  /** Earlier turns sent back for a follow-up, each capped in characters. */
  historyTurns: 4,
  historyChars: 2000,
  /** Questions per practitioner per day. */
  dailyQuota: 60,
  /** Passages handed to the model. */
  passages: 8,
  /** Characters of a passage shown on the page as the quote. */
  quoteChars: 600,
  /** Cosine similarity under which a passage is not evidence. */
  minSimilarity: 0.45,
  /** A passage further than this below the best one is left out. */
  similarityBand: 0.15,
} as const;

// ---------------------------------------------------------------------------
// Patient identifiers
// ---------------------------------------------------------------------------

export type PiiKind = 'id' | 'phone' | 'email' | 'card' | 'id_keyword';

export interface PiiFinding {
  kind: PiiKind;
  /** What matched, for a test — never shown or stored by the API. */
  match: string;
}

/** An Israeli identity number: nine digits (leading zeros optional) whose check digit works out. */
export function isIsraeliId(digits: string): boolean {
  if (!/^\d{5,9}$/.test(digits)) return false;
  const padded = digits.padStart(9, '0');
  let sum = 0;
  for (let i = 0; i < 9; i += 1) {
    let n = Number(padded[i]) * (i % 2 === 0 ? 1 : 2);
    if (n > 9) n -= 9;
    sum += n;
  }
  return sum % 10 === 0;
}

const ID_KEYWORD = /(?:ת\.?\s?ז\.?|ת״ז|ת"ז|תעודת\s+זהות|מספר\s+זהות|\bID\s*(?:number|no\.?)|\bpassport\b|דרכון)\s*[:#]?\s*\d/i;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const PHONE = /(?<!\d)(?:\+972[-\s]?|0)(?:5\d|[2-4]|[89]|7[0-9])[-\s]?\d{3}[-\s]?\d{4}(?!\d)/;
/** Thirteen to nineteen digits, spaced or not: a payment card, never a dose. */
const CARD = /(?<!\d)(?:\d[ -]?){13,19}(?!\d)/;
/** Seven to nine digits in a row: an identity number written with or without its leading zeros. */
const DIGIT_RUN = /(?<![\d.,])\d{7,9}(?![\d.,])/g;

/**
 * The identifying details a question must not carry. Names cannot be found
 * by a pattern; the page says not to type them, the model is told to refuse
 * a question about a person, and the assistant has no way into a patient's
 * file — so a name alone reaches nothing.
 */
export function findPii(text: string): PiiFinding[] {
  const findings: PiiFinding[] = [];
  const source = String(text ?? '');
  const keyword = source.match(ID_KEYWORD);
  if (keyword) findings.push({ kind: 'id_keyword', match: keyword[0] });
  const email = source.match(EMAIL);
  if (email) findings.push({ kind: 'email', match: email[0] });
  const phone = source.match(PHONE);
  if (phone) findings.push({ kind: 'phone', match: phone[0] });
  const card = source.match(CARD);
  if (card && card[0].replace(/\D/g, '').length >= 13) findings.push({ kind: 'card', match: card[0] });
  for (const run of source.matchAll(DIGIT_RUN)) {
    if (isIsraeliId(run[0])) findings.push({ kind: 'id', match: run[0] });
  }
  return findings;
}

// ---------------------------------------------------------------------------
// Grounding
// ---------------------------------------------------------------------------

/** The [n] markers an answer carries: "[2]", "[1, 3]", "[4][5]". */
export function citationNumbers(answer: string): number[] {
  const found = new Set<number>();
  for (const group of String(answer ?? '').matchAll(/\[([\d\s,]+)\]/g)) {
    for (const part of group[1].split(',')) {
      const n = Number(part.trim());
      if (Number.isInteger(n) && n > 0) found.add(n);
    }
  }
  return [...found].sort((a, b) => a - b);
}

/** The answer without its markers, for the checks that read its words. */
export function stripCitations(answer: string): string {
  return String(answer ?? '').replace(/\[[\d\s,]+\]/g, '');
}

/**
 * The numbers a text states, normalised: thousands separators dropped, a
 * decimal kept. Single digits are left out — "2 פעמים ביום" against
 * "twice daily" is a translation, not an invention — and so are the
 * citation markers.
 */
export function numbersIn(text: string): string[] {
  const out = new Set<string>();
  for (const match of stripCitations(text).matchAll(/\d[\d,]*(?:\.\d+)?/g)) {
    const value = match[0].replace(/,/g, '');
    if (value.length >= 2 || value.includes('.')) out.add(value);
  }
  return [...out];
}

export interface GroundingProblem {
  kind: 'no_citation' | 'unknown_citation' | 'number_not_in_sources';
  detail: string;
}

/**
 * Is the answer held up by the passages it cites? Every marker must name a
 * retrieved passage, an answer must cite something, and every number it
 * states must appear in the passages it cites. This runs before the second
 * model reading, and it is the part that cannot be talked out of a verdict.
 */
export function checkGrounding(answer: string, passages: readonly { n: number; content: string }[]): { ok: boolean; problems: GroundingProblem[] } {
  const problems: GroundingProblem[] = [];
  const cited = citationNumbers(answer);
  const known = new Map(passages.map((p) => [p.n, p.content]));
  if (cited.length === 0) problems.push({ kind: 'no_citation', detail: 'the answer cites no passage' });
  for (const n of cited) if (!known.has(n)) problems.push({ kind: 'unknown_citation', detail: `[${n}]` });
  const evidence = cited
    .filter((n) => known.has(n))
    .map((n) => known.get(n)!.replace(/,/g, ''))
    .join('\n');
  for (const number of numbersIn(answer)) {
    if (!evidence.includes(number)) problems.push({ kind: 'number_not_in_sources', detail: number });
  }
  return { ok: problems.length === 0, problems };
}

// ---------------------------------------------------------------------------
// Retrieval
// ---------------------------------------------------------------------------

/**
 * Reciprocal rank fusion: two rankings of the same passages (by meaning, by
 * words) folded into one, where a passage high on either list rises.
 */
export function rrfMerge(lists: readonly (readonly string[])[], k = 60): { id: string; score: number }[] {
  const scores = new Map<string, number>();
  for (const list of lists) {
    list.forEach((id, index) => {
      scores.set(id, (scores.get(id) ?? 0) + 1 / (k + index + 1));
    });
  }
  return [...scores.entries()].map(([id, score]) => ({ id, score })).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}

/**
 * The same passage held twice — a book that sits in two folders of the
 * library, loaded once per copy — would take two of the model's few slots
 * for one piece of evidence and cite the same page twice. Passages whose
 * text is the same once whitespace is ignored are folded to the first,
 * which is the one ranked higher.
 */
export function distinctByContent<T extends { content: string }>(rows: readonly T[]): T[] {
  const seen = new Set<string>();
  const kept: T[] = [];
  for (const row of rows) {
    const key = row.content.replace(/\s+/g, ' ').trim();
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push(row);
  }
  return kept;
}

/** The answer given when the library holds nothing on the question, in the practitioner's words. */
export const LIBRARY_NO_SOURCES_HE = 'לא מצאתי במקורות הספרייה תשובה מבוססת לשאלה הזאת, ולכן אני לא עונה עליה.';
export const LIBRARY_REFUSED_PII_HE =
  'השאלה כוללת פרט מזהה (מספר זהות, טלפון, אימייל או מספר ארוך). הספרייה עונה על שאלות מקצועיות בלבד, בלי פרטים של מטופלים. אפשר לנסח מחדש בלי הפרט הזה.';
export const LIBRARY_REFUSED_QUOTA_HE = 'הגעת למכסת השאלות היומית. אפשר להמשיך מחר.';
