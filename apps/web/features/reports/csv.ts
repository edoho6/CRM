/**
 * A report section as a file the accountant can open.
 *
 * Until now the figures could be read on screen and nowhere else: the answer to
 * "what did the practice earn in March" was a screenshot in an email. The data
 * is already in the page, so this is a conversion and not a request — nothing
 * new leaves the server, and the download works with the screen already open.
 *
 * Pure and tested, because a quoting mistake in a CSV does not look like an
 * error: it looks like a column of numbers that has silently shifted one place.
 */

/**
 * One field, quoted if it has to be.
 *
 * A comma, a quote or a newline inside a value ends the field early in every
 * reader there is; doubling the quotes and wrapping is the escape the format
 * defines. A leading space is kept, because a field that was padded was padded
 * for a reason.
 */
function field(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const text = String(value);
  if (!/[",\n\r]/.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
}

/**
 * The rows of a report section, as CSV text.
 *
 * `headers` are the translated column names as the table on screen shows them,
 * so the file and the page agree; a column with no translation keeps its own
 * name rather than becoming blank.
 *
 * CRLF between rows: it is what the format says, and what the spreadsheet on a
 * Windows desktop expects to find.
 */
export function toCsv(
  columns: string[],
  rows: Record<string, string | number | null>[],
  headers?: Record<string, string>,
): string {
  const lines = [columns.map((column) => field(headers?.[column] ?? column)).join(',')];
  for (const row of rows) {
    lines.push(columns.map((column) => field(row[column])).join(','));
  }
  return lines.join('\r\n');
}

/**
 * The byte order mark, which is the whole reason a Hebrew CSV opens readable.
 *
 * Excel on Windows reads a file with no mark in the system codepage, and a
 * report of Hebrew patient names becomes mojibake. Three bytes fix it, and
 * every other reader ignores them.
 */
export const CSV_BOM = '﻿';

/** A file name from a section's title: no path separators, no surprises. */
export function csvFileName(title: string, date: Date): string {
  const day = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
  const safe = title.replace(/[\\/:*?"<>|]+/g, '').trim() || 'report';
  return `${safe} ${day}.csv`;
}
