import { describe, expect, it } from 'vitest';
import {
  decodeCsvBytes,
  guessMapping,
  parseCsv,
  parseImportDate,
  parseImportSex,
  planImport,
  rowToPatient,
} from './csv-import';

describe('decodeCsvBytes', () => {
  it('reads UTF-8 with its byte-order mark, and Windows-1255 Hebrew', () => {
    const utf8 = new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode('שם,טלפון')]);
    expect(decodeCsvBytes(utf8)).toBe('שם,טלפון');
    // "שלום" in Windows-1255.
    expect(decodeCsvBytes(new Uint8Array([0xf9, 0xec, 0xe5, 0xed]))).toBe('שלום');
  });
});

describe('parseCsv', () => {
  it('keeps a quoted comma, a doubled quote and a line break inside a cell', () => {
    expect(parseCsv('שם,הערות\r\nדנה,"גרה ב""חיפה"", קומה 2\nליד הים"\n\n')).toEqual([
      ['שם', 'הערות'],
      ['דנה', 'גרה ב"חיפה", קומה 2\nליד הים'],
    ]);
  });

  it('finds a semicolon delimiter', () => {
    expect(parseCsv('first;last\nDana;Levi')).toEqual([
      ['first', 'last'],
      ['Dana', 'Levi'],
    ]);
  });
});

describe('guessMapping', () => {
  it('matches Hebrew and English headers, each field once', () => {
    expect(
      guessMapping([
        'שם פרטי',
        'שם משפחה',
        'נייד',
        'ת"ז',
        'Email',
        'תאריך לידה',
        'טלפון',
        'מזהה פנימי',
      ]),
    ).toEqual([
      'first_name',
      'last_name',
      'phone',
      'national_id',
      'email',
      'date_of_birth',
      null,
      null,
    ]);
  });
});

describe('parseImportDate and parseImportSex', () => {
  it('reads the day first, a two-digit year as a birth year, and refuses a date that is not one', () => {
    expect(parseImportDate('05/03/1980')).toBe('1980-03-05');
    expect(parseImportDate('5.3.80')).toBe('1980-03-05');
    expect(parseImportDate('1980-03-05')).toBe('1980-03-05');
    expect(parseImportDate('31/02/1980')).toBeNull();
    expect(parseImportDate('03/15/1980')).toBeNull();
  });

  it('reads the usual ways of writing sex', () => {
    expect([
      parseImportSex('נ'),
      parseImportSex('זכר'),
      parseImportSex('F'),
      parseImportSex(''),
    ]).toEqual(['female', 'male', 'female', 'unspecified']);
  });
});

describe('rowToPatient and planImport', () => {
  const mapping = guessMapping(['שם', 'טלפון', 'אימייל', 'תאריך לידה']);

  it('splits a full name, and drops only the field that is wrong', () => {
    const { patient, problems } = rowToPatient(
      ['דנה בר לוי', '050-1234567', 'not-an-email', '31/02/1990'],
      mapping,
    );
    expect(patient.first_name).toBe('דנה');
    expect(patient.last_name).toBe('בר לוי');
    expect(patient.email).toBeNull();
    expect(patient.date_of_birth).toBeNull();
    expect(problems).toEqual(['bad_email', 'bad_date']);
  });

  it('marks a patient already on file, a row repeated in the file, and a row with no name', () => {
    const rows = [
      { line: 2, cells: ['נועה כהן', '+972 50 111 2222', '', ''] },
      { line: 3, cells: ['יוסי לוי', '052-3334444', '', ''] },
      { line: 4, cells: ['יוסף לוי', '0523334444', '', ''] },
      { line: 5, cells: ['', '054-0000000', '', ''] },
    ];
    const plan = planImport(rows, mapping, [
      { id: 'p1', full_name: 'נועה כהן', phone: '050-1112222', national_id: null },
    ]);
    expect(plan.map((r) => r.status)).toEqual(['on_file', 'new', 'twice_in_file', 'no_name']);
    expect(plan[0]!.match).toEqual({ id: 'p1', name: 'נועה כהן', on: 'phone' });
  });
});
