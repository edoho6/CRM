'use server';

import { cookies } from 'next/headers';
import { getClinicScope } from '@/lib/session';

/** The cookie the phone's page sets once registered; sign-out reads it to unregister. */
const PUSH_TOKEN_COOKIE = 'herbalist-push-token';

/**
 * The phone says what its token is; the database binds it to whoever is
 * signed in and to their clinic (register_push_device, migration 41). The
 * app is never told which clinic — it could not be trusted to say.
 */
export async function registerPushDevice(input: {
  token: string;
  platform: 'ios' | 'android';
  locale: string;
}): Promise<boolean> {
  const scope = await getClinicScope();
  if (!scope) return false;
  if (typeof input.token !== 'string' || input.token.length < 20 || input.token.length > 4096) return false;
  if (input.platform !== 'ios' && input.platform !== 'android') return false;
  const { error } = await scope.supabase.rpc('register_push_device', {
    p_token: input.token,
    p_platform: input.platform,
    p_app: 'clinic',
    p_locale: input.locale === 'en' ? 'en' : 'he',
  });
  return !error;
}

/**
 * Called by the sign-out action: the phone this session is leaving stops
 * receiving this person's alerts. Best effort — a failure here must not keep
 * anyone signed in.
 */
export async function unregisterPushDeviceFromCookie(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(PUSH_TOKEN_COOKIE)?.value;
  if (!token) return;
  try {
    const scope = await getClinicScope();
    if (scope) await scope.supabase.rpc('unregister_push_device', { p_token: token });
  } catch {
    /* The row is dropped by the sender the first time the token fails. */
  }
  jar.delete(PUSH_TOKEN_COOKIE);
}
