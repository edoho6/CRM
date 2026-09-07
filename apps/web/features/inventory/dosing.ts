/**
 * Prescription arithmetic.
 *
 * Separated from the panel so it can be tested. These are the numbers a patient
 * takes home: a misplaced decimal here is not a layout bug, and "it looked right
 * on screen" is not a check.
 */

/** Granule extracts are concentrated 5:1 — one gram stands for five of the raw herb. */
export const GRANULE_RATIO = 5;

/** Two decimals, without the floating-point tail that 0.1 + 0.2 leaves. */
export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function rawToGranules(rawGrams: number): number {
  return round2(rawGrams / GRANULE_RATIO);
}

export function granulesToRaw(granuleGrams: number): number {
  return round2(granuleGrams * GRANULE_RATIO);
}

export interface DoseLine<T> {
  item: T;
  /** A relative part when a total is given; grams as written when it is not. */
  dose: number;
}

/**
 * Splits a total across lines in proportion to their parts.
 *
 * Nine herbs marked 13, 19 and 6 out of 100g come out as their shares of the
 * hundred rather than as the parts themselves. This is the calculation that is
 * otherwise done once per herb on paper while a patient waits.
 *
 * With no total — or a total of zero — the parts are already the weights and are
 * returned untouched, which is the older way of writing a prescription and still
 * a valid one.
 *
 * Rounding is per line and deliberately not reconciled against the total: an
 * adjustment slipped into the largest line to make the column add up would be a
 * weight nobody chose. The sum of the shown lines is shown, so any discrepancy
 * is visible rather than hidden.
 */
export function splitByParts<T>(
  lines: DoseLine<T>[],
  total: number | null,
): {
  item: T;
  quantity: number;
}[] {
  const usable = lines.filter((line) => Number.isFinite(line.dose) && line.dose > 0);

  if (total === null || !Number.isFinite(total) || total <= 0) {
    return usable.map((line) => ({ item: line.item, quantity: round2(line.dose) }));
  }

  const totalParts = usable.reduce((sum, line) => sum + line.dose, 0);
  if (totalParts <= 0) return [];

  return usable.map((line) => ({
    item: line.item,
    quantity: round2((line.dose / totalParts) * total),
  }));
}

/**
 * How many times the written formula a requested weight comes to.
 *
 * The database scales a saved formula by a multiplier; a practitioner asks for
 * a number of grams. This is the conversion between the two, and returning 1
 * for "no total given" means the formula is dispensed exactly as written.
 */
export function multiplierForTotal(bookDose: number, requestedTotal: number | null): number {
  if (requestedTotal === null || !Number.isFinite(requestedTotal) || requestedTotal <= 0) return 1;
  if (!Number.isFinite(bookDose) || bookDose <= 0) return 1;
  return requestedTotal / bookDose;
}
