/**
 * Every row a query matches, a page at a time.
 *
 * The data service caps any one answer at 1,000 rows (supabase/config.toml,
 * `max_rows`) and says nothing when it does: `.limit(5000)` quietly returns
 * 1,000, and a report built on it is wrong the day a clinic passes that line.
 * This asks page after page until a short one comes back.
 *
 * The query must be ordered by something unique (an id last, at least), or two
 * pages can overlap and a row can be skipped. For a count or a sum, ask the
 * database for the number instead — this is for when the rows themselves are
 * needed.
 */
export const PAGE_SIZE = 1000;

export interface PageResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}

export async function fetchAllRows<T>(
  page: (from: number, to: number) => PromiseLike<PageResult<T>>,
  options: { max?: number; pageSize?: number } = {},
): Promise<{ data: T[]; error: { message: string } | null; truncated: boolean }> {
  const pageSize = options.pageSize ?? PAGE_SIZE;
  const max = options.max ?? 50_000;
  const rows: T[] = [];
  for (let from = 0; from < max; from += pageSize) {
    const to = Math.min(from + pageSize, max) - 1;
    const { data, error } = await page(from, to);
    if (error) return { data: rows, error, truncated: false };
    const chunk = data ?? [];
    rows.push(...chunk);
    if (chunk.length < to - from + 1) return { data: rows, error: null, truncated: false };
  }
  return { data: rows, error: null, truncated: true };
}
