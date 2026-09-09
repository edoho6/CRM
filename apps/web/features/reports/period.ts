/**
 * The report periods, as plain values.
 *
 * Read on the server (the reports page parses the URL with `parsePeriod`)
 * and in the browser (the filter draws the chips). A plain module, because
 * a value exported from a `'use client'` file reaches the server as a client
 * reference and cannot be called there — the reports page used to fail on
 * exactly that.
 */
export const PERIODS = [3, 6, 12, 24] as const;
export type Period = (typeof PERIODS)[number];

export const DEFAULT_PERIOD: Period = 12;

export function parsePeriod(value: string | undefined): Period {
  const parsed = Number(value);
  return (PERIODS as readonly number[]).includes(parsed) ? (parsed as Period) : DEFAULT_PERIOD;
}
