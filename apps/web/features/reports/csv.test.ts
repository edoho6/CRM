import { describe, expect, it } from 'vitest';
import { csvFileName, toCsv } from './csv';

describe('toCsv', () => {
  it('writes the header from the translated names', () => {
    const csv = toCsv(['month', 'count'], [{ month: '2026-03', count: 14 }], {
      month: 'חודש',
      count: 'טיפולים',
    });
    expect(csv.split('\r\n')[0]).toBe('חודש,טיפולים');
  });

  it('falls back to the column name when there is no translation', () => {
    expect(toCsv(['month'], []).split('\r\n')[0]).toBe('month');
  });

  it('quotes a value that contains a comma', () => {
    const csv = toCsv(['name'], [{ name: 'לוי, דנה' }]);
    expect(csv.split('\r\n')[1]).toBe('"לוי, דנה"');
  });

  it('doubles the quotes inside a quoted value', () => {
    const csv = toCsv(['note'], [{ note: 'the patient said "better"' }]);
    expect(csv.split('\r\n')[1]).toBe('"the patient said ""better"""');
  });

  it('keeps a value with a newline in one field', () => {
    const csv = toCsv(['note'], [{ note: 'first\nsecond' }]);
    expect(csv).toBe('note\r\n"first\nsecond"');
  });

  it('writes an empty field for a missing value rather than the word null', () => {
    expect(toCsv(['a', 'b'], [{ a: null, b: 2 }])).toBe('a,b\r\n,2');
  });

  it('writes a number as itself, with no thousands separator', () => {
    expect(toCsv(['total'], [{ total: 12500 }])).toBe('total\r\n12500');
  });

  it('separates rows with CRLF', () => {
    expect(toCsv(['a'], [{ a: 1 }, { a: 2 }])).toBe('a\r\n1\r\n2');
  });

  it('writes the header alone when there are no rows', () => {
    expect(toCsv(['a', 'b'], [])).toBe('a,b');
  });
});

describe('csvFileName', () => {
  it('names the file after the section and the day', () => {
    expect(csvFileName('הכנסה לפי חודש', new Date(2026, 8, 16))).toBe('הכנסה לפי חודש 2026-09-16.csv');
  });

  it('drops characters a file name cannot hold', () => {
    expect(csvFileName('revenue / month: all?', new Date(2026, 0, 2))).toBe(
      'revenue  month all 2026-01-02.csv',
    );
  });

  it('falls back to a name when the title is nothing but punctuation', () => {
    expect(csvFileName('///', new Date(2026, 0, 2))).toBe('report 2026-01-02.csv');
  });
});
