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

/**
 * What a patient takes in a day, and what the whole prescription weighs.
 *
 * Both were helpers inside the dispensing panel, which is the one place they
 * are shown and exactly the place the rule in CLAUDE.md is about: these are
 * the two numbers written on the bag a patient carries out, and neither had a
 * test. They are typed on the shape they need rather than on the database row,
 * so this module still knows nothing about tables.
 */

export interface DoseSchedule<U extends string> {
  /** How much per dose, as the row stores it — numeric columns arrive as strings. */
  dose_amount: number | string | null;
  doses_per_day: number | string | null;
  dose_unit: U | null;
}

/**
 * Amount per dose times doses per day.
 *
 * Null when either half is missing, and null is the honest answer: "three
 * grams" with no schedule is not a daily dose, and showing one would be an
 * instruction the practitioner never wrote.
 */
export function dailyDose<U extends string>(
  record: DoseSchedule<U>,
  fallbackUnit: U,
): { amount: number; unit: U } | null {
  const amount = Number(record.dose_amount);
  const perDay = Number(record.doses_per_day);
  if (!amount || !perDay || !Number.isFinite(amount) || !Number.isFinite(perDay)) return null;
  return { amount: round2(amount * perDay), unit: record.dose_unit ?? fallbackUnit };
}

/** What the whole prescription weighs: every line added up. */
export function prescriptionTotal(items: { quantity: number | string | null }[]): number {
  return round2(
    items.reduce((sum, item) => {
      const quantity = Number(item.quantity);
      return sum + (Number.isFinite(quantity) ? quantity : 0);
    }, 0),
  );
}
