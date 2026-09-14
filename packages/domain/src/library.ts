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

/**
 * Statuses the API answers with; the audit log stores the same words.
 * `general` is an answer written from the model's own knowledge because
 * the library held nothing — shown as such, never checked against a source.
 */
export type LibraryStatus = 'answered' | 'general' | 'no_sources' | 'refused_pii' | 'refused_quota' | 'error';

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
  /**
   * What the model added from its own knowledge for the part the passages
   * did not cover — or the whole reply, when `status` is `general`. Never
   * checked against a source, and therefore always shown as not from the library.
   */
  general?: string;
  /** How many sentences the checks struck from the answer before it was shown. */
  trimmed?: number;
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
  /** For a question that asks for a list ("which herbs…"), where one passage holds one item. */
  listPassages: 14,
  /** A list question keeps passages further below the best one; the items are spread across sources. */
  listSimilarityBand: 0.25,
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

export interface GroundingPassage {
  n: number;
  content: string;
  /** The source's title and page count as evidence too: an answer may name "the 2014 table" or "page 3779". */
  title?: string | null;
  page?: number | null;
}

/**
 * Is the answer held up by the passages it cites? Every marker must name a
 * retrieved passage, an answer must cite something, and every number it
 * states must appear in the passages it cites — in their text, their title
 * or their page number, all of which the model was shown. This runs before
 * the second model reading, and it is the part that cannot be talked out
 * of a verdict.
 */
export function checkGrounding(answer: string, passages: readonly GroundingPassage[]): { ok: boolean; problems: GroundingProblem[] } {
  const problems: GroundingProblem[] = [];
  const cited = citationNumbers(answer);
  const known = new Map(passages.map((p) => [p.n, p]));
  if (cited.length === 0) problems.push({ kind: 'no_citation', detail: 'the answer cites no passage' });
  for (const n of cited) if (!known.has(n)) problems.push({ kind: 'unknown_citation', detail: `[${n}]` });
  const evidence = cited
    .filter((n) => known.has(n))
    .map((n) => {
      const p = known.get(n)!;
      return [p.content, p.title ?? '', p.page === null || p.page === undefined ? '' : String(p.page)].join('\n').replace(/,/g, '');
    })
    .join('\n');
  for (const number of numbersIn(answer)) {
    if (!evidence.includes(number)) problems.push({ kind: 'number_not_in_sources', detail: number });
  }
  return { ok: problems.length === 0, problems };
}

// ---------------------------------------------------------------------------
// Striking sentences
// ---------------------------------------------------------------------------

interface Unit {
  start: number;
  end: number;
}

/**
 * The units an answer is struck by: a bullet, a numbered item or a heading
 * line is one unit; a paragraph is cut into sentences at . ! ? followed by
 * a space or the end of the line. Offsets into the original text, so a unit
 * can be removed without disturbing the rest.
 */
function units(text: string): Unit[] {
  const out: Unit[] = [];
  let offset = 0;
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    const isItem = /^(?:[-*•▪]|\d+[.)]|#{1,6})\s/.test(trimmed) || /^\*\*[^*]+\*\*:?$/.test(trimmed);
    if (trimmed === '' || isItem || trimmed.length < 40) {
      if (trimmed !== '') out.push({ start: offset, end: offset + line.length });
    } else {
      let cursor = 0;
      for (const match of line.matchAll(/[.!?؟]+(?=\s|$)/g)) {
        const end = match.index! + match[0].length;
        out.push({ start: offset + cursor, end: offset + end });
        cursor = end;
      }
      if (cursor < line.length && line.slice(cursor).trim() !== '') out.push({ start: offset + cursor, end: offset + line.length });
    }
    offset += line.length + 1;
  }
  return out;
}

const normalise = (s: string) => stripCitations(s).replace(/[*_`]/g, '').replace(/\s+/g, ' ').trim();
const words = (s: string) => normalise(s).toLowerCase().split(/[^\p{L}\p{N}.]+/u).filter((w) => w.length >= 3);

/** Whether a unit is the one a quote points at: the quote inside it, its first forty characters, or most of its words. */
function unitMatches(unitText: string, quote: string): boolean {
  const u = normalise(unitText);
  const q = normalise(quote);
  if (!q) return false;
  if (u.includes(q) || q.includes(u)) return true;
  if (q.length > 40 && u.includes(q.slice(0, 40))) return true;
  const qWords = words(q);
  if (qWords.length < 3) return false;
  const uWords = new Set(words(u));
  const shared = qWords.filter((w) => uWords.has(w)).length;
  return shared / qWords.length >= 0.6;
}

const isHeadingLine = (line: string) => /^#{1,6}\s/.test(line) || /^\*\*[^*]+\*\*:?$/.test(line) || (/:$/.test(line) && line.length < 80);

/**
 * Strikes whole units and tidies what is left. A heading whose block —
 * the lines right under it, or the block after one blank line — was
 * struck entirely goes with it; blank runs shrink; nothing else moves.
 */
function strike(text: string, doomed: readonly Unit[]): string {
  const spans = [...doomed].sort((a, b) => a.start - b.start);
  const lines = text.split('\n');
  const remaining: string[] = [];
  let offset = 0;
  for (const line of lines) {
    const lineStart = offset;
    const lineEnd = offset + line.length;
    let kept = '';
    let cursor = lineStart;
    for (const span of spans) {
      if (span.end <= lineStart || span.start >= lineEnd) continue;
      if (span.start > cursor) kept += text.slice(cursor, span.start);
      cursor = Math.max(cursor, span.end);
    }
    kept += text.slice(cursor, lineEnd);
    remaining.push(kept.trim());
    offset = lineEnd + 1;
  }
  const blockGone = (from: number): boolean => {
    let i = from;
    while (i < lines.length && lines[i]!.trim() === '') i += 1;
    let had = false;
    while (i < lines.length && lines[i]!.trim() !== '' && !isHeadingLine(lines[i]!.trim())) {
      had = true;
      if (remaining[i] !== '') return false;
      i += 1;
    }
    return had;
  };
  const out: string[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const original = lines[i]!.trim();
    if (original !== '' && isHeadingLine(original) && remaining[i] !== '' && blockGone(i + 1)) continue;
    out.push(remaining[i]!);
  }
  return out
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Removes from an answer the sentences the judge quoted — the sentence or
 * the bullet each quote sits in, whole — and returns what stands, with the
 * count of what was struck. A quote that matches nothing removes nothing.
 * Removing can add no claim, so what is left needs no second reading.
 */
export function removeSentences(text: string, quotes: readonly string[]): { text: string; removed: number } {
  const all = units(text);
  const doomed = new Set<Unit>();
  for (const quote of quotes) {
    const hit = all.find((unit) => !doomed.has(unit) && unitMatches(text.slice(unit.start, unit.end), quote));
    if (hit) doomed.add(hit);
  }
  return { text: doomed.size ? strike(text, [...doomed]) : text, removed: doomed.size };
}

/** Drops the given [n] markers from an answer — the ones that point at no retrieved passage — and leaves the words. */
export function dropCitations(answer: string, numbers: readonly number[]): string {
  const gone = new Set(numbers);
  return String(answer ?? '')
    .replace(/\[([\d\s,]+)\]/g, (whole, inner: string) => {
      const kept = inner
        .split(',')
        .map((part) => part.trim())
        .filter((part) => part !== '' && !gone.has(Number(part)));
      return kept.length ? `[${kept.join(', ')}]` : '';
    })
    .replace(/[ \t]+([.,;:!?])/g, '$1')
    .replace(/[ \t]{2,}/g, ' ');
}

/** Removes every sentence or bullet that states one of the given numbers — the ones the passages do not hold. */
export function removeSentencesWithNumbers(text: string, numbers: readonly string[]): { text: string; removed: number } {
  if (numbers.length === 0) return { text, removed: 0 };
  const doomed = units(text).filter((unit) => {
    const stated = numbersIn(text.slice(unit.start, unit.end));
    return stated.some((n) => numbers.includes(n));
  });
  return { text: doomed.length ? strike(text, doomed) : text, removed: doomed.length };
}

// ---------------------------------------------------------------------------
// The search plan
// ---------------------------------------------------------------------------

export type QuestionKind = 'list' | 'fact' | 'other';

export interface SearchPlan {
  /** The question standing on its own, in its own language, with what the earlier turns supplied. */
  standalone: string;
  /** The same question in English, for the English passages. */
  english: string;
  /** English search terms for the word index. */
  keywords: string[];
  kind: QuestionKind;
}

/** The plan the question falls back to when the planner fails: the question itself, searched as it is. */
export function planFallback(question: string): SearchPlan {
  return { standalone: question, english: question, keywords: [], kind: 'fact' };
}

/** The planner's JSON, with every field checked and the fallback for whatever is missing. */
export function parsePlan(value: unknown, question: string): SearchPlan {
  const fallback = planFallback(question);
  if (!value || typeof value !== 'object') return fallback;
  const raw = value as Record<string, unknown>;
  const text = (v: unknown, or: string) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 600) : or);
  const keywords = Array.isArray(raw.keywords)
    ? raw.keywords
        .filter((k): k is string => typeof k === 'string' && k.trim().length > 0)
        .map((k) => k.trim().slice(0, 60))
        .slice(0, 8)
    : [];
  const kind: QuestionKind = raw.kind === 'list' || raw.kind === 'other' ? raw.kind : 'fact';
  return { standalone: text(raw.standalone, fallback.standalone), english: text(raw.english, fallback.english), keywords, kind };
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
