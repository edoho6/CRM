import { describe, expect, it } from 'vitest';
import { fetchAllRows } from './fetch-all';

/** A fake query over `total` numbered rows, answering at most `cap` per call like the service does. */
function source(total: number, cap = 1000) {
  const calls: [number, number][] = [];
  const page = async (from: number, to: number) => {
    calls.push([from, to]);
    const end = Math.min(to, from + cap - 1, total - 1);
    const data = from > end ? [] : Array.from({ length: end - from + 1 }, (_, i) => from + i);
    return { data, error: null };
  };
  return { page, calls };
}

describe('fetchAllRows', () => {
  it('reads past the service cap of 1,000 rows', async () => {
    const { page } = source(2500);
    const result = await fetchAllRows(page);
    expect(result.data).toHaveLength(2500);
    expect(result.data.at(-1)).toBe(2499);
    expect(result.truncated).toBe(false);
  });

  it('stops after a short page', async () => {
    const { page, calls } = source(10);
    await fetchAllRows(page);
    expect(calls).toEqual([[0, 999]]);
  });

  it('says so when it stopped at the ceiling', async () => {
    const { page } = source(5000);
    const result = await fetchAllRows(page, { max: 2000 });
    expect(result.data).toHaveLength(2000);
    expect(result.truncated).toBe(true);
  });

  it('hands back the error instead of a short list that looks complete', async () => {
    const result = await fetchAllRows(async () => ({ data: null, error: { message: 'boom' } }));
    expect(result.error?.message).toBe('boom');
  });
});
