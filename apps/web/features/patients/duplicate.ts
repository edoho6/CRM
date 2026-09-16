/**
 * Is this the same person the clinic already has a file on?
 *
 * Three doors create patients — the desk, the online booking page and the
 * portal — and none of them looked. So the same person books online with
 * 050-123-4567, rings up and is typed in as +972-50-1234567, and ends up with
 * two files: half the history in each, two sets of consents, and a reminder
 * that goes out twice.
 *
 * Matching is on the two things that identify a person rather than describe
 * them. A name is not one of them: two people really are called the same
 * thing, and one person spells their own name three ways.
 *
 * Pure and tested, because "is this the same person" decides whether a record
 * is merged or split, and getting it wrong in either direction is expensive.
 */

/** Just the digits: a phone or an ID is a number however it was typed. */
export function digitsOnly(value: string | null | undefined): string {
  return (value ?? '').replace(/\D+/g, '');
}

/**
 * The comparable part of a phone number.
 *
 * The last nine digits, which is an Israeli subscriber number without its
 * country code: 050-123-4567, 0501234567 and +972501234567 are one number
 * written three ways, and the leading zero is the only thing that differs
 * between the local and the international form.
 *
 * Shorter than nine digits is not enough of a number to claim a match on — a
 * four-digit extension typed into the phone field would otherwise collide with
 * every patient whose number ends the same way.
 */
export function phoneKey(value: string | null | undefined): string | null {
  const digits = digitsOnly(value);
  if (digits.length < 9) return null;
  return digits.slice(-9);
}

/** The comparable part of a national ID: its digits, in full. */
export function nationalIdKey(value: string | null | undefined): string | null {
  const digits = digitsOnly(value);
  return digits.length >= 5 ? digits : null;
}

export interface DuplicateCandidate {
  id: string;
  full_name: string | null;
  phone: string | null;
  national_id: string | null;
}

export interface DuplicateMatch {
  id: string;
  name: string | null;
  /** Which field matched, so the warning can say what it saw. */
  on: 'national_id' | 'phone';
}

/**
 * The first candidate that is the same person, or null.
 *
 * The ID wins over the phone when both match different people, because a
 * national ID identifies one human being and a phone number is shared by a
 * couple, a parent and child, or whoever had it last year.
 */
export function findDuplicate(
  candidates: DuplicateCandidate[],
  input: { phone?: string | null; national_id?: string | null },
  /** A patient being edited is not their own duplicate. */
  excludeId?: string | null,
): DuplicateMatch | null {
  const wantedId = nationalIdKey(input.national_id);
  const wantedPhone = phoneKey(input.phone);
  if (!wantedId && !wantedPhone) return null;

  const others = candidates.filter((candidate) => candidate.id !== excludeId);

  if (wantedId) {
    const byId = others.find((candidate) => nationalIdKey(candidate.national_id) === wantedId);
    if (byId) return { id: byId.id, name: byId.full_name, on: 'national_id' };
  }

  if (wantedPhone) {
    const byPhone = others.find((candidate) => phoneKey(candidate.phone) === wantedPhone);
    if (byPhone) return { id: byPhone.id, name: byPhone.full_name, on: 'phone' };
  }

  return null;
}
