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
