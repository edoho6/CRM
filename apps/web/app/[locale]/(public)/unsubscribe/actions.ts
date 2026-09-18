'use server';

import { tryCreateServerSupabase } from '@clinic/db/server';
import { headers } from 'next/headers';
import { checkRateLimit, recordFailure } from '@/lib/rate-limit';
import { callerAddress } from '@/lib/caller-address';

/**
 * Wrong tokens are counted per caller, not per token: a key made of the token
 * itself was new on every guess, so nothing guessing ever reached the limit.
 */
async function callerKey(prefix: string): Promise<string> {
  return `${prefix}:${callerAddress(await headers())}`;
}

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

  const limit = checkRateLimit(await callerKey('unsubscribe'));
  if (!limit.allowed) return 'error';

  const supabase = await tryCreateServerSupabase();
  if (!supabase) return 'error';

  const { data, error } = await supabase.rpc('unsubscribe_marketing', { p_token: token });
  if (error) return 'error';
  if (data !== true) {
    recordFailure(await callerKey('unsubscribe'));
    return 'expired';
  }
  return 'done';
}
