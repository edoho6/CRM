/**
 * "3–9 גרם": a herb's usual daily range, in the page's language and number
 * format. Four screens built this string themselves, each ending in a bare
 * "g" beside stock figures that said "גרם" — one word for one unit.
 */
export function doseRangeLabel(
  herb: { dosage_min_g: number | string | null; dosage_max_g: number | string | null },
  formatNumber: (value: number) => string,
  gram: string,
): string | null {
  if (herb.dosage_min_g === null && herb.dosage_max_g === null) return null;
  const part = (value: number | string | null) => (value === null ? '?' : formatNumber(Number(value)));
  return `${part(herb.dosage_min_g)}–${part(herb.dosage_max_g)} ${gram}`;
}
