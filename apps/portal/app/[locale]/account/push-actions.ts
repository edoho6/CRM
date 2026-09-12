'use server';

import { cookies } from 'next/headers';
import { createServerSupabase, getCurrentUser, isSupabaseConfigured } from '@clinic/db';

const PUSH_TOKEN_COOKIE = 'herbalist-push-token';

/** The patient's phone, registered for the appointment reminders (register_push_device, migration 41). */
export async function registerPortalPushDevice(input: {
  token: string;
  platform: 'ios' | 'android';
  locale: string;
}): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  if (typeof input.token !== 'string' || input.token.length < 20 || input.token.length > 4096) return false;
  if (input.platform !== 'ios' && input.platform !== 'android') return false;
  const user = await getCurrentUser();
  if (!user) return false;
  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc('register_push_device', {
    p_token: input.token,
    p_platform: input.platform,
    p_app: 'portal',
    p_locale: input.locale === 'en' ? 'en' : 'he',
  });
  return !error;
}

/** At sign-out: the phone this session is leaving stops receiving this person's reminders. */
export async function unregisterPortalPushDeviceFromCookie(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(PUSH_TOKEN_COOKIE)?.value;
  if (!token) return;
  try {
    if (isSupabaseConfigured()) {
      const supabase = await createServerSupabase();
      await supabase.rpc('unregister_push_device', { p_token: token });
    }
  } catch {
    /* Best effort; the sender drops a dead token on its own. */
  }
  jar.delete(PUSH_TOKEN_COOKIE);
}
