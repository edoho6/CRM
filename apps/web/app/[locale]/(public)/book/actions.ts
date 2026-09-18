'use server';

import { headers } from 'next/headers';
import { tryCreateServerSupabase } from '@clinic/db/server';
import { checkRateLimit, recordFailure } from '@/lib/rate-limit';
import { callerAddress } from '@/lib/caller-address';

/**
 * The booking page's three calls, all through the anonymous client: the
 * functions behind them run as the database owner, take the clinic's public
 * handle, and are the only way in.
 *
 * Limits, in layers. The database limits codes per phone number (a minute
 * apart, three an hour), per clinic and across the service, and bookings per
 * clinic — those hold whoever calls. Here, per caller address: every code sent
 * counts (a flood of codes to many numbers is the abuse), and a refused booking
 * counts; a person choosing another hour because the first was taken does not.
 *
 * The functions answer with a typed result, `{ ok, reason }`, rather than an
 * error, so a wrong code is counted instead of rolled back. An older database
 * that still raises is read the old way until its SQL is updated.
 */

const CODE_BUDGET = { max: 5, windowMs: 60 * 60 * 1000, blockMs: 60 * 60 * 1000 };

async function callerKey(prefix: string): Promise<string> {
  return `${prefix}:${callerAddress(await headers())}`;
}

export type BookingError =
  | 'not_available'
  | 'slot_taken'
  | 'missing'
  | 'bad_code'
  | 'code_expired'
  | 'too_many'
  | 'cooldown'
  | 'busy'
  | 'generic';

function classify(reason: string): BookingError {
  if (reason.includes('slot_taken')) return 'slot_taken';
  if (reason.includes('not_available')) return 'not_available';
  if (
    reason.includes('missing') ||
    reason.includes('bad_phone') ||
    reason.includes('bad_type') ||
    reason.includes('bad_location')
  )
    return 'missing';
  if (reason.includes('bad_code')) return 'bad_code';
  if (reason.includes('code_expired')) return 'code_expired';
  if (reason.includes('too_many')) return 'too_many';
  if (reason.includes('cooldown')) return 'cooldown';
  if (reason.includes('busy')) return 'busy';
  return 'generic';
}

type Outcome = { ok: true; data: Record<string, unknown> } | { ok: false; reason: string };

/** The typed result, or the raised error of a database not yet updated. */
function outcome(data: unknown, error: { message: string } | null): Outcome {
  if (error) return { ok: false, reason: error.message };
  if (data && typeof data === 'object' && 'ok' in data) {
    const result = data as { ok: unknown; reason?: unknown };
    return result.ok === true
      ? { ok: true, data: result as Record<string, unknown> }
      : { ok: false, reason: String(result.reason ?? 'generic') };
  }
  // The old functions: true / {token, start_at} on success.
  return data
    ? { ok: true, data: typeof data === 'object' ? (data as Record<string, unknown>) : {} }
    : { ok: false, reason: 'generic' };
}

export async function fetchSlots(
  slug: string,
  typeId: string,
  practitionerId: string,
  day: string,
): Promise<string[]> {
  const supabase = await tryCreateServerSupabase();
  if (!supabase) return [];
  const { data } = await supabase.rpc('booking_slots', {
    p_slug: slug,
    p_type_id: typeId,
    p_practitioner_id: practitionerId,
    p_day: day,
  });
  return (Array.isArray(data) ? data : []).map((value) => String(value));
}

export async function sendBookingCode(
  slug: string,
  phone: string,
): Promise<{ ok: true } | { ok: false; error: BookingError }> {
  const key = await callerKey('booking-code');
  if (!checkRateLimit(key, CODE_BUDGET).allowed) return { ok: false, error: 'too_many' };
  // Counted before the call: what is bounded is how many codes one caller can
  // have sent, successful or not.
  recordFailure(key, CODE_BUDGET);

  const supabase = await tryCreateServerSupabase();
  if (!supabase) return { ok: false, error: 'generic' };

  const { data, error } = await supabase.rpc('booking_send_code', { p_slug: slug, p_phone: phone });
  const result = outcome(data, error);
  if (!result.ok) {
    // The clinic does not ask for a code: nothing to send, nothing wrong.
    if (result.reason === 'not_required') return { ok: true };
    return { ok: false, error: classify(result.reason) };
  }
  return { ok: true };
}

export interface BookingInput {
  slug: string;
  typeId: string;
  practitionerId: string;
  locationId: string | null;
  startAt: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  note: string;
  code: string;
}

export async function submitBooking(
  input: BookingInput,
): Promise<{ ok: true; token: string } | { ok: false; error: BookingError }> {
  const key = await callerKey('booking');
  if (!checkRateLimit(key).allowed) return { ok: false, error: 'too_many' };

  const supabase = await tryCreateServerSupabase();
  if (!supabase) return { ok: false, error: 'generic' };

  const { data, error } = await supabase.rpc('booking_request', {
    p_slug: input.slug,
    p_type_id: input.typeId,
    p_practitioner_id: input.practitionerId,
    p_location_id: input.locationId,
    p_start_at: input.startAt,
    p_first_name: input.firstName,
    p_last_name: input.lastName,
    p_phone: input.phone,
    p_email: input.email,
    p_note: input.note,
    p_code: input.code,
  });

  const result = outcome(data, error);
  if (!result.ok) {
    const kind = classify(result.reason);
    // A wrong code and a refused booking count; a taken hour does not.
    if (kind !== 'slot_taken') recordFailure(key);
    return { ok: false, error: kind };
  }

  const token = result.data.token;
  if (typeof token !== 'string' || !token) return { ok: false, error: 'generic' };
  return { ok: true, token };
}
