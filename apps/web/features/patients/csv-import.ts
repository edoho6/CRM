/**
 * Patients from another system's export: a CSV file read, its columns matched
 * to the patient's fields, each row checked, and the ones already on file found.
 *
 * Pure and tested, because an import writes hundreds of files at once and the
 * mistakes it can make are quiet ones — a Hebrew file read in the wrong encoding
 * becomes question marks in every name, a date read month-first puts birthdays
 * in the wrong month, and a patient imported twice is two files from then on.
 */
import {
  findDuplicate,
  type DuplicateCandidate,
  type DuplicateMatch,
  phoneKey,
  nationalIdKey,
} from './duplicate';

/** The fields a column can fill. `full_name` is split into first and last. */
export const IMPORT_FIELDS = [
  'first_name',
  'last_name',
  'full_name',
  'phone',
  'email',
  'national_id',
  'date_of_birth',
  'sex',
  'address',
  'city',
  'occupation',
  'referral_source',
  'notes',
] as const;
export type ImportField = (typeof IMPORT_FIELDS)[number];

/** The most rows one import takes: enough for a practice, few enough to check by eye. */
export const IMPORT_MAX_ROWS = 2000;

/**
 * Bytes to text. Excel on a Hebrew Windows saves "CSV" in Windows-1255 and
 * "CSV UTF-8" with a byte-order mark; both arrive here. UTF-8 is tried strictly
 * first, since any Windows-1255 Hebrew is invalid UTF-8.
 */
export function decodeCsvBytes(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^﻿/, '');
  } catch {
    return new TextDecoder('windows-1255').decode(bytes);
  }
}

/**
 * Rows of cells: quoted cells may hold the delimiter, a line break or a doubled
 * quote. The delimiter is the one of comma, semicolon and tab found most often
 * outside quotes in the first line — Excel in some locales writes semicolons.
 */
export function parseCsv(text: string): string[][] {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const outside = firstLine.replace(/"[^"]*"/g, '');
  const delimiter = ([',', ';', '\t'] as const)
    .map((d) => [d, outside.split(d).length] as const)
    .sort((a, b) => b[1] - a[1])[0]![0];
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === '') quoted = true;
    else if (ch === delimiter) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

const HEADER_WORDS: Record<ImportField, RegExp> = {
  first_name: /^(שם פרטי|פרטי|first ?name|given ?name|name first)$/i,
  last_name: /^(שם משפחה|משפחה|last ?name|surname|family ?name)$/i,
  full_name: /^(שם|שם מלא|שם המטופל|שם מטופל|name|full ?name|patient|patient name)$/i,
  phone: /^(טלפון|נייד|טלפון נייד|פלאפון|סלולרי|מספר טלפון|phone|mobile|cell|telephone|tel)$/i,
  email: /^(אימייל|דוא"?ל|מייל|דואר אלקטרוני|e-?mail|mail)$/i,
  national_id: /^(ת"?ז|תעודת זהות|מספר זהות|ת\.ז\.?|id|national ?id|id number)$/i,
  date_of_birth: /^(תאריך לידה|ת\. לידה|לידה|birth ?date|date of birth|dob|birthday)$/i,
  sex: /^(מין|מגדר|sex|gender)$/i,
  address: /^(כתובת|רחוב|address|street)$/i,
  city: /^(עיר|ישוב|יישוב|city|town)$/i,
  occupation: /^(עיסוק|מקצוע|occupation|job|profession)$/i,
  referral_source: /^(מקור הפניה|הופנה על ידי|הפניה|referral|referred by|source)$/i,
  notes: /^(הערות|הערה|notes|note|comments|remarks)$/i,
};

/** A first guess for each column; the person confirms or changes it. Each field is taken once, by its first column. */
export function guessMapping(headers: readonly string[]): (ImportField | null)[] {
  const taken = new Set<ImportField>();
  return headers.map((header) => {
    const clean = header.trim().replace(/\s+/g, ' ').replace(/[:*]$/, '');
    const field = IMPORT_FIELDS.find((f) => !taken.has(f) && HEADER_WORDS[f].test(clean)) ?? null;
    if (field) taken.add(field);
    return field;
  });
}

/** "15/03/1980", "15.3.80", "1980-03-15" → "1980-03-15"; day first, as dates are written here. Null when it is not a real date. */
export function parseImportDate(value: string): string | null {
  const text = value.trim();
  let y: number;
  let m: number;
  let d: number;
  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  const local = text.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/);
  if (iso) [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  else if (local) {
    [d, m, y] = [Number(local[1]), Number(local[2]), Number(local[3])];
    // A two-digit year is a birth year: the future is the previous century.
    if (local[3]!.length === 2) y += y > new Date().getFullYear() % 100 ? 1900 : 2000;
  } else return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d ||
    y < 1900
  )
    return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function parseImportSex(value: string): 'female' | 'male' | 'other' | 'unspecified' {
  const text = value.trim().toLowerCase();
  if (/^(נ|נקבה|אישה|f|female|woman)$/.test(text)) return 'female';
  if (/^(ז|זכר|גבר|m|male|man)$/.test(text)) return 'male';
  if (/^(אחר|other)$/.test(text)) return 'other';
  return 'unspecified';
}

export interface ImportPatient {
  first_name: string;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  national_id: string | null;
  date_of_birth: string | null;
  sex: 'female' | 'male' | 'other' | 'unspecified';
  address: string | null;
  city: string | null;
  occupation: string | null;
  referral_source: string | null;
  notes: string | null;
}

export type ImportProblem = 'no_name' | 'bad_email' | 'bad_date' | 'short_phone';

/** One row as a patient, with what is wrong with it. A problem that loses only one field (a date that is not a date) drops that field; a row with no name is not a patient. */
export function rowToPatient(
  cells: readonly string[],
  mapping: readonly (ImportField | null)[],
): { patient: ImportPatient; problems: ImportProblem[] } {
  const get = (field: ImportField) => {
    const index = mapping.indexOf(field);
    const value = index >= 0 ? (cells[index] ?? '').trim() : '';
    return value === '' ? null : value;
  };
  const problems: ImportProblem[] = [];
  let first = get('first_name');
  let last = get('last_name');
  const full = get('full_name');
  if (full && !first) {
    const words = full.split(/\s+/);
    first = words[0]!;
    last = last ?? (words.length > 1 ? words.slice(1).join(' ') : null);
  }
  if (!first) problems.push('no_name');

  let email = get('email');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    problems.push('bad_email');
    email = null;
  }
  const rawDate = get('date_of_birth');
  const date = rawDate ? parseImportDate(rawDate) : null;
  if (rawDate && !date) problems.push('bad_date');
  const phone = get('phone');
  if (phone && !phoneKey(phone)) problems.push('short_phone');

  return {
    patient: {
      first_name: (first ?? '').slice(0, 80),
      last_name: last ? last.slice(0, 80) : null,
      phone: phone ? phone.slice(0, 30) : null,
      email,
      national_id: get('national_id')?.slice(0, 20) ?? null,
      date_of_birth: date,
      sex: parseImportSex(get('sex') ?? ''),
      address: get('address')?.slice(0, 300) ?? null,
      city: get('city')?.slice(0, 80) ?? null,
      occupation: get('occupation')?.slice(0, 120) ?? null,
      referral_source: get('referral_source')?.slice(0, 120) ?? null,
      notes: get('notes')?.slice(0, 4000) ?? null,
    },
    problems,
  };
}

export type ImportRowStatus = 'new' | 'on_file' | 'twice_in_file' | 'no_name';

export interface ImportPlanRow {
  line: number;
  patient: ImportPatient;
  status: ImportRowStatus;
  problems: ImportProblem[];
  match: DuplicateMatch | null;
}

/**
 * What an import would do, row by row: a new file, a patient already on file
 * (phone or ID, as the desk checks), a row repeating one earlier in the file,
 * or a row with no name. Only "new" rows are written.
 */
export function planImport(
  rows: readonly { cells: readonly string[]; line: number }[],
  mapping: readonly (ImportField | null)[],
  existing: readonly DuplicateCandidate[],
): ImportPlanRow[] {
  const seen: DuplicateCandidate[] = [];
  return rows.map(({ cells, line }) => {
    const { patient, problems } = rowToPatient(cells, mapping);
    if (problems.includes('no_name'))
      return { line, patient, status: 'no_name', problems, match: null };
    const onFile = findDuplicate([...existing], patient);
    if (onFile) return { line, patient, status: 'on_file', problems, match: onFile };
    const earlier = findDuplicate(seen, patient);
    if (earlier) return { line, patient, status: 'twice_in_file', problems, match: earlier };
    if (phoneKey(patient.phone) || nationalIdKey(patient.national_id)) {
      seen.push({
        id: `line-${line}`,
        full_name: [patient.first_name, patient.last_name].filter(Boolean).join(' '),
        phone: patient.phone,
        national_id: patient.national_id,
      });
    }
    return { line, patient, status: 'new', problems, match: null };
  });
}
