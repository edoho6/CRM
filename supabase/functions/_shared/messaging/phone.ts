// Israeli phone numbers, in the two shapes the sending service wants.
//
// A patient's number is free text in the file — "050-123-4567", "+972 50
// 123 4567", "0501234567" — and the service is strict: SMS takes the local
// form (05X…), WhatsApp the international one without a plus (972…). A
// number that is not Israeli comes back null and the row fails with a code,
// rather than being sent somewhere the service would refuse anyway.
//
// Separate from the web app's `whatsappNumber`, which lets a foreign number
// through for a person to dial by hand: the Edge Function cannot import from
// apps/web, and its answer to "foreign" is different.

const ISRAELI_LOCAL = /^0[2-9]\d{7,8}$/;

/** Digits only, with an Israeli country code folded into the leading zero. */
function localDigits(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = raw.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) digits = digits.slice(1);
  if (digits.startsWith('00972')) digits = `0${digits.slice(5)}`;
  else if (digits.startsWith('972')) digits = `0${digits.slice(3)}`;
  // A nine-digit mobile typed without its zero.
  else if (/^5\d{8}$/.test(digits)) digits = `0${digits}`;
  return ISRAELI_LOCAL.test(digits) ? digits : null;
}

/** `0501234567`, or null for anything that is not an Israeli number. */
export function israeliLocal(raw: string | null | undefined): string | null {
  return localDigits(raw);
}

/** `972501234567` (no plus), or null for anything that is not an Israeli number. */
export function israeliInternational(raw: string | null | undefined): string | null {
  const local = localDigits(raw);
  return local ? `972${local.slice(1)}` : null;
}
