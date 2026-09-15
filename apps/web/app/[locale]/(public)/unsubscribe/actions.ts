'use server';

import { tryCreateServerSupabase } from '@clinic/db/server';
import { checkRateLimit, recordFailure } from '@/lib/rate-limit';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type UnsubscribeResult = 'done' | 'expired' | 'error';

/**
 * The patient's decision to stop, written through the token-checked function.
 *
 * No session, by design: the link is the credential, and the function
 * touches nothing but this one patient's marketing consent. It is a button
 * and not the page itself because link previews fetch every link a message
 * carries — a page that withdrew on being opened would withdraw everyone.
 * Wrong tokens count against a small budget so the space cannot be walked.
 */
export async function unsubscribeMarketing(token: string): Promise<UnsubscribeResult> {
  if (!UUID.test(token)) return 'expired';

  const limit = checkRateLimit(`unsubscribe:${token}`);
  if (!limit.allowed) return 'error';

  const supabase = await tryCreateServerSupabase();
  if (!supabase) return 'error';

  const { data, error } = await supabase.rpc('unsubscribe_marketing', { p_token: token });
  if (error) return 'error';
  if (data !== true) {
    recordFailure(`unsubscribe:${token}`);
    return 'expired';
  }
  return 'done';
}
