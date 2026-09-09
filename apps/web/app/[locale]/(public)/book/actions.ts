'use server';

import { headers } from 'next/headers';
import { tryCreateServerSupabase } from '@clinic/db/server';
import { checkRateLimit, recordFailure } from '@/lib/rate-limit';

/**
 * The booking page's three calls, all through the anonymous client: the
 * functions behind them run as the database owner, take the clinic's public
 * handle, and are the only way in.
 *
 * Rate limits are by caller address, and count only what looks like abuse —
 * a code asked for again and again, a booking refused again and again. A
 * person choosing a different hour because the first was taken is not that.
 */

async function callerKey(prefix: string): Promise<string> {
  const headerList = await headers();
  const forwarded = headerList.get('x-forwarded-for') ?? '';
  const ip = forwarded.split(',')[0]?.trim() || headerList.get('x-real-ip') || 'unknown';
  return `${prefix}:${ip}`;
}

export type BookingError =
  | 'not_available'
  | 'slot_taken'
  | 'missing'
  | 'bad_code'
  | 'code_expired'
  | 'too_many'
  | 'generic';

function classify(message: string): BookingError {
  if (message.includes('slot_taken')) return 'slot_taken';
  if (message.includes('not_available')) return 'not_available';
  if (message.includes('missing') || message.includes('bad_phone') || message.includes('bad_type'))
    return 'missing';
  if (message.includes('bad_code')) return 'bad_code';
  if (message.includes('code_expired')) return 'code_expired';
  if (message.includes('too_many')) return 'too_many';
  return 'generic';
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
  if (!checkRateLimit(key).allowed) return { ok: false, error: 'too_many' };

  const supabase = await tryCreateServerSupabase();
  if (!supabase) return { ok: false, error: 'generic' };

  const { error } = await supabase.rpc('booking_send_code', { p_slug: slug, p_phone: phone });
  if (error) {
    recordFailure(key);
    return { ok: false, error: classify(error.message) };
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

  if (error) {
    const kind = classify(error.message);
    // A wrong code and a refused booking count; a taken hour does not.
    if (kind !== 'slot_taken') recordFailure(key);
    return { ok: false, error: kind };
  }

  const token = (data as { token?: string } | null)?.token;
  if (!token) return { ok: false, error: 'generic' };
  return { ok: true, token };
}
