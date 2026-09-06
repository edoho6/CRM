/**
 * The comparator behind every sortable table column.
 *
 * Kept as a plain function, separate from the component, because the rules it
 * encodes are the part that is easy to get subtly wrong and worth testing
 * directly: numbers compare as numbers, text through the reader's own
 * collation, and empty cells always sink to the bottom in both directions.
 */

export type SortValue = string | number | boolean | null | undefined;
export type SortValues = Record<string, SortValue>;
export type SortDirection = 'asc' | 'desc';

function isEmpty(value: SortValue): boolean {
  return value === null || value === undefined || value === '';
}

export function compareSortValues(
  a: SortValue,
  b: SortValue,
  direction: SortDirection,
  collator: Intl.Collator,
): number {
  // A missing value is not "smallest" — it is "no answer", and no answer
  // belongs out of the way whichever end of the list you are reading from.
  const aEmpty = isEmpty(a);
  const bEmpty = isEmpty(b);
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1;
  if (bEmpty) return -1;

  const sign = direction === 'asc' ? 1 : -1;
  if (typeof a === 'number' && typeof b === 'number') return (a - b) * sign;
  if (typeof a === 'boolean' && typeof b === 'boolean') return (Number(a) - Number(b)) * sign;
  return collator.compare(String(a), String(b)) * sign;
}

/** The collator every table sorts text with: numeric-aware, accent-insensitive. */
export function sortCollator(locale?: string): Intl.Collator {
  return new Intl.Collator(locale, { numeric: true, sensitivity: 'base' });
}

/** Parses the `data-sort` attribute a row carries, tolerating anything malformed. */
export function parseSortValues(raw: string | undefined | null): SortValues {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as SortValues) : {};
  } catch {
    return {};
  }
}
