/**
 * Column sorting that lives in the URL — `?sort=name&dir=desc`.
 *
 * The catalogues are paged, and a sort that reorders only the rows on the
 * current page lies about the rest, so the order is decided by the query and
 * the header cell is a link. Keeping it in the URL also makes a sorted, filtered
 * page something that can be bookmarked and comes back with the browser's back
 * button, the same as the filters and the page number.
 */

export type SortDir = 'asc' | 'desc';

export interface SortState<K extends string = string> {
  key: K;
  dir: SortDir;
}

/** The sort from the URL, or the default; a key the page does not offer is ignored. */
export function parseSort<K extends string>(
  params: { sort?: string; dir?: string },
  allowed: readonly K[],
  fallback: SortState<K>,
): SortState<K> {
  const key = allowed.includes(params.sort as K) ? (params.sort as K) : fallback.key;
  const dir: SortDir =
    params.dir === 'desc' || params.dir === 'asc'
      ? params.dir
      : key === fallback.key
        ? fallback.dir
        : 'asc';
  return { key, dir };
}

/** The `sort`/`dir` pair for a URL, or nothing when it is the page's default. */
export function sortQuery<K extends string>(
  sort: SortState<K>,
  fallback: SortState<K>,
): Record<string, string> {
  if (sort.key === fallback.key && sort.dir === fallback.dir) return {};
  return { sort: sort.key, dir: sort.dir };
}

/**
 * Orders rows by a value computed outside the database — stock on hand, a
 * formula's total weight — when the query cannot. Nulls sort last either way,
 * so "no stock" never outranks "some stock" by being sorted as zero.
 */
export function compareComputed(
  left: string | number | null | undefined,
  right: string | number | null | undefined,
  dir: SortDir,
  collator: Intl.Collator,
): number {
  const leftMissing = left === null || left === undefined || left === '';
  const rightMissing = right === null || right === undefined || right === '';
  if (leftMissing && rightMissing) return 0;
  if (leftMissing) return 1;
  if (rightMissing) return -1;
  const result =
    typeof left === 'number' && typeof right === 'number'
      ? left - right
      : collator.compare(String(left), String(right));
  return dir === 'asc' ? result : -result;
}
