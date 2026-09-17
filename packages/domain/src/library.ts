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
  'המידע כאן הוא כלי עזר בלבד שנכתב אוטומטית, ' +
  'ואינו ייעוץ רפואי ואינו תחליף לשיקול דעת מקצועי או לעלון התכשיר. ' +
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
  /** Terms the narrowed word search keeps when the strict one finds nothing. */
  narrowKeywords: 3,
  /**
   * Passages the narrowed word search may add. Three of eight, because the
   * rows it finds are the weaker evidence and they enter the fold at the top
   * of their own ranking: asked for six, they took six of the eight slots
   * with pages that merely mention the formula, while the monograph the
   * meaning search had found was pushed out. Three keeps the half alive
   * without letting it decide the answer.
   */
  narrowPassages: 3,
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

const NUMBER = /\d[\d,]*(?:\.\d+)?/g;

/**
 * An amount with its unit: "9 גרם", "3–9g", "0.5 עד 1.5 צון", "12.5 מ״ג". A
 * dose is where a wrong single digit does harm, and where the digit is what
 * the source wrote — unlike "2 פעמים ביום", a translation of "twice daily".
 */
const DOSE_SOURCE = String.raw`\d[\d,]*(?:\.\d+)?(?:\s*(?:-|–|—|־|to|עד|ל-?)\s*\d[\d,]*(?:\.\d+)?)?\s*(?:g|gr|grams?|mg|mcg|µg|kg|ml|cc|cun|fen|qian|liang|IU|%|גרם|גר['׳]|מ["״]ג|מג|מק["״]ג|ק["״]ג|מ["״]ל|צ['׳]?ון)(?![\p{L}\p{N}])`;
const DOSE = new RegExp(DOSE_SOURCE, 'giu');
const HAS_DOSE = new RegExp(DOSE_SOURCE, 'iu');

/**
 * The numbers a text states, normalised: thousands separators dropped, a
 * decimal kept. A single digit counts only inside an amount with its unit
 * ("3 גרם", "6-9g") — "2 פעמים ביום" against "twice daily" is a translation,
 * not an invention. The citation markers are not numbers the text states.
 */
export function numbersIn(text: string): string[] {
  const plain = stripCitations(text);
  const inDose = new Set<number>();
  for (const dose of plain.matchAll(DOSE)) {
    for (const part of dose[0].matchAll(NUMBER)) inDose.add(dose.index! + part.index!);
  }
  const out = new Set<string>();
  for (const match of plain.matchAll(NUMBER)) {
    const value = match[0].replace(/,/g, '');
    if (value.length >= 2 || value.includes('.') || inDose.has(match.index!)) out.add(value);
  }
  return [...out];
}

/** Every number a text holds, whole: "12" is not found inside "120" or "2012". */
function numberTokens(text: string): Set<string> {
  return new Set([...String(text ?? '').matchAll(NUMBER)].map((match) => match[0].replace(/,/g, '')));
}

export interface GroundingProblem {
  kind: 'no_citation' | 'unknown_citation' | 'number_not_in_sources';
  detail: string;
  /** For a number: the sentence or bullet that states it, as the answer has it. */
  sentence?: string;
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
 * retrieved passage, an answer must cite something, and every number a
 * sentence states must appear in the passages **that sentence** cites — in
 * their text, their title or their page number, all of which the model was
 * shown. Checked against every cited passage at once, a dose from [3] beside
 * a herb that cites [1] passed. This runs before the second model reading,
 * and it is the part that cannot be talked out of a verdict.
 */
export function checkGrounding(answer: string, passages: readonly GroundingPassage[]): { ok: boolean; problems: GroundingProblem[] } {
  const problems: GroundingProblem[] = [];
  const cited = citationNumbers(answer);
  const known = new Set(passages.map((p) => p.n));
  if (cited.length === 0) return { ok: false, problems: [{ kind: 'no_citation', detail: 'the answer cites no passage' }] };
  for (const n of cited) if (!known.has(n)) problems.push({ kind: 'unknown_citation', detail: `[${n}]` });
  for (const { unit, numbers } of unsupportedNumbers(answer, passages)) {
    const sentence = answer.slice(unit.start, unit.end).trim();
    for (const number of numbers) problems.push({ kind: 'number_not_in_sources', detail: number, sentence });
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

/** Drops the given [n] markers from an answer and leaves the words (see `dropUnknownCitations` for the claims behind them). */
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

/** What a removal took out, so the same claims can be taken out of the rest of the reply too. */
export interface Struck {
  text: string;
  removed: number;
  /** The sentences and bullets removed, as they stood. */
  struck: string[];
}

function struckResult(text: string, doomed: readonly Unit[]): Struck {
  if (doomed.length === 0) return { text, removed: 0, struck: [] };
  return { text: strike(text, doomed), removed: doomed.length, struck: doomed.map((unit) => text.slice(unit.start, unit.end).trim()) };
}

/**
 * The citations that stand behind a unit: its own markers; when it has none,
 * those of its line (a sentence whose marker closes the paragraph); when the
 * line has none either, those of its block — the lines up to a blank one.
 */
function scopedUnits(text: string): { unit: Unit; cites: number[] }[] {
  const lines: { start: number; end: number; block: number }[] = [];
  let offset = 0;
  let block = 0;
  let open = false;
  for (const line of text.split('\n')) {
    if (line.trim() === '') {
      if (open) block += 1;
      open = false;
    } else {
      open = true;
    }
    lines.push({ start: offset, end: offset + line.length, block });
    offset += line.length + 1;
  }
  const cites = (from: number, to: number) => citationNumbers(text.slice(from, to));
  const blockCites = new Map<number, number[]>();
  return units(text).map((unit) => {
    const own = cites(unit.start, unit.end);
    if (own.length) return { unit, cites: own };
    const line = lines.find((l) => unit.start >= l.start && unit.start <= l.end)!;
    const inLine = cites(line.start, line.end);
    if (inLine.length) return { unit, cites: inLine };
    if (!blockCites.has(line.block)) {
      const members = lines.filter((l) => l.block === line.block);
      blockCites.set(line.block, cites(members[0]!.start, members[members.length - 1]!.end));
    }
    return { unit, cites: blockCites.get(line.block)! };
  });
}

/**
 * The units that state a number the passages behind them do not hold. A unit
 * whose markers all name passages that were not retrieved is the marker
 * check's business (`dropUnknownCitations`), not this one's.
 */
function unsupportedNumbers(text: string, passages: readonly GroundingPassage[]): { unit: Unit; numbers: string[] }[] {
  const tokens = new Map(passages.map((p) => [p.n, numberTokens([p.content, p.title ?? '', p.page ?? ''].join('\n'))]));
  const out: { unit: Unit; numbers: string[] }[] = [];
  for (const { unit, cites } of scopedUnits(text)) {
    const stated = numbersIn(text.slice(unit.start, unit.end));
    if (stated.length === 0) continue;
    const behind = cites.filter((n) => tokens.has(n));
    if (cites.length > 0 && behind.length === 0) continue;
    const missing = stated.filter((number) => !behind.some((n) => tokens.get(n)!.has(number)));
    if (missing.length) out.push({ unit, numbers: missing });
  }
  return out;
}

/**
 * Strikes the sentences and bullets that state a number the passages they
 * cite do not hold — each such unit and only it, so "Bai Shao 9 גרם [1]"
 * stays when "Huang Qi 9 גרם [2]" goes.
 */
export function removeUnsupportedNumbers(text: string, passages: readonly GroundingPassage[]): Struck {
  return struckResult(
    text,
    unsupportedNumbers(text, passages).map((entry) => entry.unit),
  );
}

/**
 * What a marker pointing at no retrieved passage leaves behind. A sentence or
 * bullet whose only markers are such markers goes whole: its words were the
 * claim, and nothing stands behind them. Elsewhere the dead marker goes and
 * the words stay, held up by the markers beside it.
 */
export function dropUnknownCitations(text: string, unknown: readonly number[]): Struck {
  const gone = new Set(unknown);
  const doomed = units(text).filter((unit) => {
    const own = citationNumbers(text.slice(unit.start, unit.end));
    return own.length > 0 && own.every((n) => gone.has(n));
  });
  const result = struckResult(text, doomed);
  return { ...result, text: dropCitations(result.text, unknown) };
}

/**
 * The model's own knowledge never states an amount: every sentence or bullet
 * of it that carries a dose goes. Nothing checked that part against a source,
 * and a dose is the claim that does harm when it is wrong.
 */
export function removeDoses(text: string): Struck {
  return struckResult(
    text,
    units(text).filter((unit) => HAS_DOSE.test(stripCitations(text.slice(unit.start, unit.end)))),
  );
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
/**
 * The word search asks for every term at once — one passage holding all of
 * "Xiao Yao San formula composition ingredients" — and for most questions
 * there is none, so half the search returns nothing (eight of eleven
 * measured questions). The relaxation is fewer terms, all of them still
 * required: the planner writes the distinctive words first, and a passage
 * holding those three is sound evidence. Joining the terms with OR instead
 * was tried and withdrawn — it matched a large part of the library and ran
 * past the database's eight seconds (migrations 58–59).
 *
 * Null when there is nothing to narrow: the query already asks for three
 * terms or fewer, so the retry would only repeat the search that just failed.
 */
export function narrowedQuery(keywords: readonly string[]): string | null {
  // Counted in words, not in the planner's entries: an entry is a short
  // phrase ("contraindicated pregnancy", "Xiao Yao San"), so keeping three
  // entries kept six words and asked for all six — the very thing that
  // found nothing. Measured: three words 0.8s and 20 rows, six words none.
  const words = keywords.join(' ').split(/\s+/).filter((word) => word.length > 0);
  if (words.length <= LIBRARY_LIMITS.narrowKeywords) return null;
  return words.slice(0, LIBRARY_LIMITS.narrowKeywords).join(' ');
}

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
export const LIBRARY_NO_SOURCES_HE = 'אין לי תשובה מבוססת לשאלה הזאת.';
export const LIBRARY_REFUSED_PII_HE =
  'השאלה כוללת פרט מזהה (מספר זהות, טלפון, אימייל או מספר ארוך). הספרייה עונה על שאלות מקצועיות בלבד, בלי פרטים של מטופלים. אפשר לנסח מחדש בלי הפרט הזה.';
export const LIBRARY_REFUSED_QUOTA_HE = 'הגעת למכסת השאלות היומית. אפשר להמשיך מחר.';
