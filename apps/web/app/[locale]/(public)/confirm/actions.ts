'use server';

import { tryCreateServerSupabase } from '@clinic/db/server';
import { checkRateLimit, recordFailure } from '@/lib/rate-limit';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type RespondResult = 'confirmed' | 'declined' | 'expired' | 'error';

/**
 * The patient's answer, written through the token-checked function.
 *
 * No session, by design: the link is the credential. The function only
 * touches the one booking whose token this is, and only while that booking is
 * still ahead. Wrong tokens count against a small budget so the space cannot
 * be walked, although at 122 random bits nobody is walking it.
 */
export async function respondToAppointment(
  token: string,
  response: 'confirmed' | 'declined',
): Promise<RespondResult> {
  if (!UUID.test(token)) return 'expired';

  const limit = checkRateLimit(`confirm:${token}`);
  if (!limit.allowed) return 'error';

  const supabase = await tryCreateServerSupabase();
  if (!supabase) return 'error';

  const { data, error } = await supabase.rpc('respond_to_appointment', {
    p_token: token,
    p_response: response,
  });

  if (error) return 'error';
  if (data !== true) {
    recordFailure(`confirm:${token}`);
    return 'expired';
  }
  return response;
}

/**
 * The free hours of a day for this appointment, when the clinic lets the link
 * move it (migration 75). The function answers nothing for a link that may not.
 */
export async function fetchChangeSlots(token: string, day: string): Promise<string[]> {
  if (!UUID.test(token) || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return [];
  const supabase = await tryCreateServerSupabase();
  if (!supabase) return [];
  const { data } = await supabase.rpc('appointment_change_slots', { p_token: token, p_day: day });
  return (Array.isArray(data) ? data : []).map((value) => String(value));
}

export type ChangeResult = 'moved' | 'cancelled' | 'slot_taken' | 'not_allowed' | 'expired' | 'error';

function changeError(message: string): ChangeResult {
  if (message.includes('slot_taken')) return 'slot_taken';
  if (message.includes('not_allowed')) return 'not_allowed';
  return 'error';
}

export async function moveAppointment(token: string, startAt: string): Promise<ChangeResult> {
  if (!UUID.test(token) || Number.isNaN(Date.parse(startAt))) return 'expired';
  if (!checkRateLimit(`confirm:${token}`).allowed) return 'error';
  const supabase = await tryCreateServerSupabase();
  if (!supabase) return 'error';
  const { data, error } = await supabase.rpc('move_appointment_by_token', { p_token: token, p_start_at: startAt });
  if (error) return changeError(error.message);
  if (data !== true) {
    recordFailure(`confirm:${token}`);
    return 'expired';
  }
  return 'moved';
}

export async function cancelAppointment(token: string): Promise<ChangeResult> {
  if (!UUID.test(token)) return 'expired';
  if (!checkRateLimit(`confirm:${token}`).allowed) return 'error';
  const supabase = await tryCreateServerSupabase();
  if (!supabase) return 'error';
  const { data, error } = await supabase.rpc('cancel_appointment_by_token', { p_token: token });
  if (error) return changeError(error.message);
  if (data !== true) {
    recordFailure(`confirm:${token}`);
    return 'expired';
  }
  return 'cancelled';
}
