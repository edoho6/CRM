/**
 * Everything that leaves for Anthropic passes through here (decision of 18.9).
 *
 * The assistant answers questions about the clinic's own data: "who has not
 * come in for three months", "who still owes money". The database answers the
 * question; the model only words the answer. It does not need to know that the
 * patient is called Dana Levi to say that she has not been in since June — so
 * it is never told.
 *
 * What this module guarantees, and the tests hold it to:
 *
 *   - A request to the model can only be built here. `callModel` takes an
 *     `OutboundRequest`, a type nothing else can make, so a caller cannot reach
 *     the API around this boundary.
 *   - Query results go out as an allowlist of columns per query. A column not
 *     on the list is not sent — including one a query adds later. A patient
 *     appears as `[PATIENT_n]`, numbered in order of appearance, mapped to the
 *     patient's id here and nowhere else.
 *   - Free text — the practitioner's question, and every message of the
 *     conversation that goes back to the model — has phone numbers, identity
 *     numbers, e-mail addresses, card numbers and street addresses removed, and
 *     names of the clinic's patients replaced with their token: whole names,
 *     either name alone, a common nickname, a spelling with or without vowel
 *     letters, and the same name in Latin letters.
 *   - When a name cannot be placed with certainty — a first name three
 *     patients share, or a word that is a common first name and matches no
 *     patient — the question is not sent at all. A needless refusal costs a
 *     rephrasing; a name sent out cannot be taken back.
 *   - Names come back only in our own interface, by exact token, from the map
 *     kept here. The model never restores anything; a token the map does not
 *     know is shown as it came.
 */

import { isIsraeliId } from '@clinic/domain';
import type { QueryResult, Row } from './queries';

// ---------------------------------------------------------------------------
// The allowlist
// ---------------------------------------------------------------------------

/** The column a query uses to carry the patient's id, next to the name. Never sent. */
export const PATIENT_ID_COLUMN = '__patient_id';

/** The column holding a patient's name. Sent only as a token. */
export const PATIENT_COLUMN = 'patient';

const APPOINTMENT_STATUS_COLUMNS = [
  'scheduled',
  'confirmed',
  'checked_in',
  'completed',
  'cancelled',
  'no_show',
] as const;

/**
 * What each query may send, column by column. A query that is not here sends
 * nothing: the model is told the result was withheld, and says it could not
 * check.
 */
export const OUTBOUND_COLUMNS: Readonly<Record<string, readonly string[]>> = {
  patient_counts: ['status', 'count'],
  new_patients_by_month: ['month', 'count'],
  treatments_by_month: ['month', 'count'],
  appointments_summary: ['status', 'count'],
  inactive_patients: [PATIENT_COLUMN, 'last_treatment', 'status'],
  top_herbs: ['herb', 'times', 'total_quantity'],
  top_points: ['point', 'times'],
  revenue_by_month: ['month', 'billed', 'paid', 'outstanding'],
  unpaid_invoices: ['invoice', PATIENT_COLUMN, 'issued', 'outstanding'],
  busiest_days: ['weekday', 'hour', 'bookings'],
  low_stock: ['herb', 'remaining', 'unit'],
  new_vs_returning_by_month: ['month', 'first_visit', 'returning'],
  appointment_outcomes_by_month: ['month', ...APPOINTMENT_STATUS_COLUMNS],
  bookings_by_weekday: ['weekday', 'bookings'],
};

// ---------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------

export interface PatientRef {
  id: string;
  name: string;
}

/** `[PATIENT_n]` → the patient it stands for, kept on our side for the answer. */
export type PatientTokenMap = Record<string, PatientRef>;

const TOKEN = /\[PATIENT_(\d+)\]/g;

/** One per question. The same patient always gets the same token within it. */
export class PatientTokens {
  private readonly byId = new Map<string, string>();
  private readonly map: PatientTokenMap = {};

  tokenFor(id: string, name: string): string {
    const known = this.byId.get(id);
    if (known) return known;
    const token = `[PATIENT_${this.byId.size + 1}]`;
    this.byId.set(id, token);
    this.map[token] = { id, name };
    return token;
  }

  get mapping(): PatientTokenMap {
    return { ...this.map };
  }
}

/** The answer as our interface draws it: text, and patients by exact token. */
export type AnswerSegment =
  { type: 'text'; text: string } | { type: 'patient'; token: string; patient: PatientRef };

export function restorePatients(text: string, map: PatientTokenMap): AnswerSegment[] {
  const segments: AnswerSegment[] = [];
  let last = 0;
  for (const match of text.matchAll(TOKEN)) {
    const token = match[0];
    const patient = map[token];
    if (!patient) continue; // Unknown to us: left in the text exactly as it came.
    if (match.index! > last) segments.push({ type: 'text', text: text.slice(last, match.index) });
    segments.push({ type: 'patient', token, patient });
    last = match.index! + token.length;
  }
  if (last < text.length) segments.push({ type: 'text', text: text.slice(last) });
  return segments;
}

// ---------------------------------------------------------------------------
// Query results
// ---------------------------------------------------------------------------

export interface OutboundResult {
  columns: string[];
  rows: Record<string, string | number | null>[];
  truncated: boolean;
  /** True when the query is not on the allowlist and nothing of it was sent. */
  withheld?: boolean;
}

/** The result as the model may see it: allowed columns only, patients as tokens. */
export function outboundResult(
  query: string,
  result: QueryResult,
  tokens: PatientTokens,
): OutboundResult {
  const allowed = OUTBOUND_COLUMNS[query];
  if (!allowed) return { columns: [], rows: [], truncated: false, withheld: true };
  const columns = result.columns.filter((column) => allowed.includes(column));
  const rows = result.rows.map((row) => {
    const out: Record<string, string | number | null> = {};
    for (const column of columns) {
      if (column === PATIENT_COLUMN) {
        const id = row[PATIENT_ID_COLUMN];
        const name = row[PATIENT_COLUMN];
        // A patient without an id cannot be restored on our side, and a name
        // without a token would go out as it is: neither is sent.
        out[column] = typeof id === 'string' && id ? tokens.tokenFor(id, String(name ?? '')) : null;
      } else {
        out[column] = redactIdentifiers(row[column]);
      }
    }
    return out;
  });
  return { columns, rows, truncated: result.truncated };
}

function redactIdentifiers(value: Row[string]): string | number | null {
  if (typeof value !== 'string') return value ?? null;
  return redactPatterns(value);
}

// ---------------------------------------------------------------------------
// Free text
// ---------------------------------------------------------------------------

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const PHONE = /(?<!\d)(?:\+972[-\s]?|0)(?:5\d|[2-4]|[89]|7[0-9])[-\s]?\d{3}[-\s]?\d{4}(?!\d)/g;
const CARD = /(?<!\d)(?:\d[ -]?){13,19}(?!\d)/g;
/** Seven to nine digits: an identity number, with or without leading zeros, or a phone written oddly. */
const DIGIT_RUN = /(?<![\d.,])\d{7,9}(?![\d.,])/g;
/** "רחוב הרצל 12", "רח' הרצל 12", "שד' רוטשילד 5", "12 Herzl St". */
const ADDRESS_HE = /(?:רחוב|רח['׳]|שדרות|שד['׳]|סמטת|דרך)\s+[\p{L}"'׳״\s-]{2,30}?\s*\d{1,4}/gu;
const ADDRESS_EN =
  /\b\d{1,5}\s+[A-Za-z][A-Za-z\s.'-]{1,30}\b(?:street|st\.?|road|rd\.?|avenue|ave\.?|boulevard|blvd\.?|lane|ln\.?)\b/gi;
const ID_KEYWORD =
  /(?:ת\.?\s?ז\.?|ת״ז|ת"ז|תעודת\s+זהות|מספר\s+זהות|\bID\s*(?:number|no\.?)|\bpassport\b|דרכון)\s*[:#]?\s*[\d\s-]+/gi;

/** Removes identifiers a pattern can find. Names are handled separately. */
export function redactPatterns(text: string): string {
  return text
    .replace(ID_KEYWORD, '[REDACTED_ID]')
    .replace(EMAIL, '[REDACTED_EMAIL]')
    .replace(CARD, (match) => (match.replace(/\D/g, '').length >= 13 ? '[REDACTED_CARD]' : match))
    .replace(PHONE, '[REDACTED_PHONE]')
    .replace(DIGIT_RUN, (match) => (isIsraeliId(match) ? '[REDACTED_ID]' : '[REDACTED_NUMBER]'))
    .replace(ADDRESS_HE, '[REDACTED_ADDRESS]')
    .replace(ADDRESS_EN, '[REDACTED_ADDRESS]');
}

export interface KnownPatient {
  id: string;
  first_name: string | null;
  last_name: string | null;
}

export type SanitizeResult =
  { ok: true; text: string } | { ok: false; reason: 'ambiguous_name' | 'possible_name' };

// --- normalisation ---------------------------------------------------------

const FINAL_LETTERS: Record<string, string> = { ך: 'כ', ם: 'מ', ן: 'נ', ף: 'פ', ץ: 'צ' };

/** Lower case, no niqqud or geresh, final letters as ordinary ones, doubled vav/yod single. */
export function normalizeName(word: string): string {
  return word
    .normalize('NFKD')
    .replace(/[֑-ׇ]/g, '')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[ךםןףץ]/g, (letter) => FINAL_LETTERS[letter] ?? letter)
    .replace(/["'׳״`.-]/g, '')
    .replace(/וו/g, 'ו')
    .replace(/יי/g, 'י');
}

/**
 * The consonant outline of a name, in Latin letters, so "דוד", "דויד" and
 * "David" meet, and "לוי" meets "Levi". Crude on purpose: a false meeting
 * costs a refusal or a token, never a leak.
 */
export function nameSkeleton(word: string, vav: 'v' | '' = ''): string {
  const he: Record<string, string> = {
    א: '',
    ב: 'v',
    ג: 'g',
    ד: 'd',
    ה: '',
    ו: vav,
    ז: 'z',
    ח: 'h',
    ט: 't',
    י: '',
    כ: 'k',
    ל: 'l',
    מ: 'm',
    נ: 'n',
    ס: 's',
    ע: '',
    פ: 'f',
    צ: 'ts',
    ק: 'k',
    ר: 'r',
    ש: 'sh',
    ת: 't',
  };
  const normalized = normalizeName(word);
  let latin = '';
  for (const char of normalized) latin += he[char] ?? char;
  return latin
    .replace(/ph/g, 'f')
    .replace(/ck/g, 'k')
    .replace(/c(?=[eiy])/g, 's')
    .replace(/c/g, 'k')
    .replace(/q/g, 'k')
    .replace(/w/g, 'v')
    .replace(/b/g, 'v')
    .replace(/x/g, 'ks')
    .replace(/sh/g, 's')
    .replace(/ch/g, 'h')
    .replace(/kh/g, 'h')
    .replace(/[aeiouyh]/g, '')
    .replace(/(.)\1+/g, '$1');
}

/** Common short forms, both ways round: a practitioner writes "יוסי" for Yosef. */
const NICKNAMES: readonly (readonly string[])[] = [
  ['יוסף', 'יוסי', 'yosef', 'yossi', 'joseph', 'joe'],
  ['משה', 'מושיק', 'moshe', 'moshik', 'moses'],
  ['יצחק', 'איציק', 'yitzhak', 'itzik', 'isaac'],
  ['אברהם', 'אבי', 'avraham', 'avi', 'abraham'],
  ['בנימין', 'בני', 'binyamin', 'benny', 'benjamin', 'ben'],
  ['אליהו', 'אלי', 'eliyahu', 'eli'],
  ['יהושע', 'שוקי', 'yehoshua', 'shuki', 'joshua', 'josh'],
  ['שמואל', 'שמוליק', 'shmuel', 'shmulik', 'samuel', 'sam'],
  ['מרדכי', 'מוטי', 'mordechai', 'moti'],
  ['יעקב', 'קובי', 'yaakov', 'kobi', 'jacob', 'jake'],
  ['רפאל', 'רפי', 'rafael', 'rafi'],
  ['גבריאל', 'גבי', 'gavriel', 'gabi', 'gabriel'],
  ['מיכאל', 'מיקי', 'michael', 'miki', 'mike'],
  ['דניאל', 'דני', 'daniel', 'dani', 'danny'],
  ['אלכסנדר', 'סשה', 'alexander', 'sasha', 'alex'],
  ['רחל', 'רחלי', 'rachel'],
  ['אליזבת', 'ליז', 'elizabeth', 'liz', 'beth'],
  ['רוברט', 'בוב', 'robert', 'bob', 'rob'],
  ['קתרין', 'קייט', 'katherine', 'catherine', 'kate', 'kathy'],
  ['יונתן', 'יוני', 'yonatan', 'yoni', 'jonathan', 'jon'],
  ['אסתר', 'אתי', 'esther', 'eti'],
  ['חנה', 'חני', 'hana', 'hanna', 'hannah'],
];

/**
 * Common first names that are *not* also everyday words. A word here that
 * matches none of the clinic's patients is still a person, and the question
 * is not sent. Names that are words — "חיים", "שני", "אלה", "תמר", "אייל",
 * "רותם", "Will", "Bill", "Mark" — are left out on purpose: refusing every
 * question that says "second" or "life" would teach the practitioner to stop
 * reading the refusal.
 */
const GIVEN_NAMES = [
  'דנה',
  'נועה',
  'מיכל',
  'יעל',
  'שירה',
  'מאיה',
  'אביגיל',
  'אסתר',
  'שרה',
  'רחל',
  'רבקה',
  'חנה',
  'מרים',
  'אורית',
  'אורנה',
  'אילנה',
  'גלית',
  'דפנה',
  'הילה',
  'זהבה',
  'יפית',
  'כרמית',
  'לימור',
  'מירב',
  'נורית',
  'סיגל',
  'ענבל',
  'רונית',
  'תהילה',
  'איילת',
  'אפרת',
  'בתיה',
  'יהודית',
  'לילך',
  'נעמה',
  'רינה',
  'יוסף',
  'יוסי',
  'משה',
  'דוד',
  'דויד',
  'יצחק',
  'אברהם',
  'יעקב',
  'אליהו',
  'שמואל',
  'מרדכי',
  'יהודה',
  'דניאל',
  'מיכאל',
  'אריאל',
  'איתי',
  'עומר',
  'יונתן',
  'אלון',
  'אמיר',
  'בועז',
  'גלעד',
  'יגאל',
  'יורם',
  'יניב',
  'ליאור',
  'מנחם',
  'נדב',
  'עידו',
  'צחי',
  'רועי',
  'רפאל',
  'שמעון',
  'תומר',
  'יאיר',
  'מוטי',
  'קובי',
  'איציק',
  'מושיק',
  'dana',
  'noa',
  'michal',
  'yael',
  'maya',
  'sarah',
  'rachel',
  'rebecca',
  'hannah',
  'miriam',
  'david',
  'yosef',
  'joseph',
  'moshe',
  'daniel',
  'michael',
  'jonathan',
  'yonatan',
  'itai',
  'omer',
  'amir',
  'noam',
  'roi',
  'john',
  'james',
  'robert',
  'mary',
  'jennifer',
  'linda',
  'elizabeth',
  'william',
  'richard',
  'thomas',
  'charles',
  'emma',
  'olivia',
  'sophia',
  'anna',
  'maria',
  'paul',
  'peter',
  'susan',
  'karen',
  'nancy',
  'lisa',
  'katherine',
];

const HEBREW = /[֐-׿]/;

interface NameKey {
  /** The name as written, normalised. */
  exact: string;
  /** Hebrew without the vowel letters vav and yod: "דויד" and "דוד" are both "דד". */
  bare: string;
  /** The Latin outline, with vav read as a vowel. */
  skeleton: string;
  /** The Latin outline, with vav read as v ("לוי" is "lv", like "Levi"). */
  skeletonV: string;
  hebrew: boolean;
}

function keyOf(word: string): NameKey {
  const exact = normalizeName(word);
  return {
    exact,
    bare: exact.replace(/[וי]/g, ''),
    skeleton: nameSkeleton(word),
    skeletonV: nameSkeleton(word, 'v'),
    hebrew: HEBREW.test(word),
  };
}

/**
 * Whether a word in the text is this name.
 *
 * In Hebrew: as written, or without its vowel letters when two letters or
 * more remain — "דויד" is "דוד", while "כן" (yes) is not "כהן" and "לו" (to
 * him) is not "לוי", whose bare form is one letter and must match as written.
 * In Latin letters: as written, or by an outline of three consonants or more.
 * Across the two: by outline — "Levi" is "לוי" with vav as v, "Goldberg" is
 * "גולדברג" with vav as a vowel; a two-consonant outline counts only in the
 * first reading, so "did" is not "דוד".
 */
function sameName(word: NameKey, name: NameKey): boolean {
  if (!word.exact || !name.exact) return false;
  if (word.exact === name.exact) return true;
  if (word.hebrew && name.hebrew) return name.bare.length >= 2 && word.bare === name.bare;
  if (!word.hebrew && !name.hebrew) return name.skeleton.length >= 3 && word.skeleton === name.skeleton;
  const latin = word.hebrew ? name : word;
  const hebrew = word.hebrew ? word : name;
  if (latin.skeleton.length >= 2 && latin.skeleton === hebrew.skeletonV) return true;
  return latin.skeleton.length >= 3 && latin.skeleton === hebrew.skeleton;
}

/** Every form a first name is known by: itself and its common short forms. */
function firstNameForms(first: string): NameKey[] {
  const own = keyOf(first);
  const forms = [own];
  for (const group of NICKNAMES) {
    const keys = group.map(keyOf);
    if (
      keys.some(
        (key) => sameName(key, own),
      )
    ) {
      forms.push(...keys);
    }
  }
  return forms;
}

const GIVEN_NAME_KEYS = GIVEN_NAMES.map(keyOf);

/**
 * A common first name in the same script only: the list carries both scripts,
 * and a two-consonant outline across them is too loose for a list of strangers
 * — "השני" (the second) has the outline of "Susan".
 */
function isCommonFirstName(word: NameKey): boolean {
  return GIVEN_NAME_KEYS.some((name) => name.hebrew === word.hebrew && sameName(word, name));
}

interface PatientNames {
  patient: KnownPatient;
  first: NameKey[];
  last: NameKey[];
}

function words(text: string): { word: string; start: number; end: number }[] {
  const out: { word: string; start: number; end: number }[] = [];
  for (const match of text.matchAll(/[\p{L}\p{M}"'׳״-]+/gu)) {
    out.push({ word: match[0], start: match.index!, end: match.index! + match[0].length });
  }
  return out;
}

/**
 * The question, or any message of the conversation, as it may leave.
 *
 * Names of the clinic's own patients become their tokens; a name that cannot
 * be pinned to one patient, or a common first name that matches nobody, stops
 * the text from leaving at all.
 */
export function sanitizeFreeText(
  text: string,
  patients: readonly KnownPatient[],
  tokens: PatientTokens,
): SanitizeResult {
  let working = redactPatterns(String(text ?? ''));

  const people: PatientNames[] = patients.map((patient) => ({
    patient,
    first: (patient.first_name ?? '').split(/\s+/).filter(Boolean).flatMap(firstNameForms),
    last: (patient.last_name ?? '').split(/\s+/).filter(Boolean).map(keyOf),
  }));
  const byFirst = (key: NameKey) =>
    people.filter((p) => p.first.some((name) => sameName(key, name)));
  const byLast = (key: NameKey) => people.filter((p) => p.last.some((name) => sameName(key, name)));

  const list = words(working).filter(
    (entry) => !/^PATIENT_\d+$/.test(entry.word) && !/^REDACTED/.test(entry.word),
  );
  const replacements: { start: number; end: number; token: string }[] = [];
  const used = new Set<number>();

  // Pass 1: two neighbouring words that are one patient's first and last
  // name, either order — the certain case.
  for (let i = 0; i + 1 < list.length; i += 1) {
    const between = working.slice(list[i]!.end, list[i + 1]!.start);
    if (!/^\s+$/.test(between)) continue;
    const a = keyOf(list[i]!.word);
    const b = keyOf(list[i + 1]!.word);
    const lastB = byLast(b);
    const lastA = byLast(a);
    const matches = [
      ...new Set([
        ...byFirst(a).filter((p) => lastB.includes(p)),
        ...byFirst(b).filter((p) => lastA.includes(p)),
      ]),
    ];
    if (matches.length === 1) {
      const { patient } = matches[0]!;
      replacements.push({
        start: list[i]!.start,
        end: list[i + 1]!.end,
        token: tokens.tokenFor(patient.id, fullName(patient)),
      });
      used.add(i);
      used.add(i + 1);
      i += 1;
    } else if (matches.length > 1) {
      return { ok: false, reason: 'ambiguous_name' };
    }
  }

  // Pass 2: one word that is a patient's first or last name, a common short
  // form of it, or a common first name that is nobody's here.
  for (let i = 0; i < list.length; i += 1) {
    if (used.has(i)) continue;
    const key = keyOf(list[i]!.word);
    const matches = [...new Set([...byFirst(key), ...byLast(key)])];
    if (matches.length === 1) {
      const { patient } = matches[0]!;
      replacements.push({
        start: list[i]!.start,
        end: list[i]!.end,
        token: tokens.tokenFor(patient.id, fullName(patient)),
      });
    } else if (matches.length > 1) {
      return { ok: false, reason: 'ambiguous_name' };
    } else if (isCommonFirstName(key)) {
      return { ok: false, reason: 'possible_name' };
    }
  }

  replacements.sort((x, y) => y.start - x.start);
  for (const r of replacements)
    working = working.slice(0, r.start) + r.token + working.slice(r.end);
  return { ok: true, text: working };
}

function fullName(patient: KnownPatient): string {
  return [patient.first_name, patient.last_name].filter(Boolean).join(' ').trim();
}

// ---------------------------------------------------------------------------
// The request
// ---------------------------------------------------------------------------

export type OutboundContent =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string };

export interface OutboundMessage {
  role: 'user' | 'assistant';
  content: string | OutboundContent[];
}

export interface OutboundTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

declare const outboundBrand: unique symbol;

/** A request that went through this module. Nothing else can produce one. */
export interface OutboundRequest {
  readonly system: string;
  readonly messages: readonly OutboundMessage[];
  readonly tools: readonly OutboundTool[];
  readonly [outboundBrand]: true;
}

export class OutboundBlockedError extends Error {
  constructor(readonly reason: 'ambiguous_name' | 'possible_name') {
    super(`outbound_blocked:${reason}`);
    this.name = 'OutboundBlockedError';
  }
}

/**
 * The one way to build a request. Every text in every message — the
 * practitioner's, the model's own earlier words, the tool results — is passed
 * through the free-text check once more, so a name that reached the
 * conversation by any route stops here.
 */
export function buildOutboundRequest(
  input: { system: string; messages: readonly OutboundMessage[]; tools: readonly OutboundTool[] },
  patients: readonly KnownPatient[],
  tokens: PatientTokens,
): OutboundRequest {
  const clean = (text: string): string => {
    const result = sanitizeFreeText(text, patients, tokens);
    if (!result.ok) throw new OutboundBlockedError(result.reason);
    return result.text;
  };
  const messages = input.messages.map((message) => ({
    role: message.role,
    content:
      typeof message.content === 'string'
        ? clean(message.content)
        : message.content.map((block) => {
            if (block.type === 'text') return { ...block, text: clean(block.text) };
            if (block.type === 'tool_result')
              return { ...block, content: redactPatterns(block.content) };
            return block;
          }),
  }));
  return { system: input.system, messages, tools: input.tools } as unknown as OutboundRequest;
}
