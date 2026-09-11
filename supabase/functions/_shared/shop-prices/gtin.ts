// Barcodes. A GTIN is the one identifier that means the same thing in every
// shop, so it is the strongest reason to say two listings are one product —
// which is exactly why a malformed one must not be trusted at all.

/** Returns the 14-digit form of a valid GTIN-8/12/13/14, or null. */
export function normaliseGtin(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (![8, 12, 13, 14].includes(digits.length)) return null;
  const padded = digits.padStart(14, '0');
  if (/^0+$/.test(padded)) return null;
  // Shops sometimes put a SKU or a phone number in the barcode field; a
  // check digit that fails is the cheapest way to notice.
  let sum = 0;
  for (let i = 0; i < 13; i++) {
    const digit = padded.charCodeAt(i) - 48;
    sum += i % 2 === 0 ? digit * 3 : digit;
  }
  const check = (10 - (sum % 10)) % 10;
  if (check !== padded.charCodeAt(13) - 48) return null;
  // A "barcode" that is really the shop's own running number (all the same
  // digit, or 1234…) is not worth merging on either.
  if (/^(\d)\1+$/.test(digits)) return null;
  return padded;
}
