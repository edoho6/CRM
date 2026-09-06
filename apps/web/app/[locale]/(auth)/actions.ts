'use server';

import { redirect } from '@clinic/i18n/navigation';
import { createServerSupabase, isSupabaseConfigured } from '@clinic/db';
import type { Locale } from '@clinic/domain';

export interface SignInState {
  error?: 'invalidCredentials' | 'notConfigured' | 'generic';
}

/**
 * Staff sign-in.
 *
 * Deliberately returns one generic "invalid credentials" for both a wrong password
 * and an unknown address, so the form cannot be used to discover who has an account.
 */
export async function signInAction(
  locale: Locale,
  _prevState: SignInState,
  formData: FormData,
): Promise<SignInState> {
  if (!isSupabaseConfigured()) {
    return { error: 'notConfigured' };
  }

  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (!email || !password) {
    return { error: 'invalidCredentials' };
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: 'invalidCredentials' };
  }

  redirect({ href: '/', locale });
  // `redirect` throws internally, so this is unreachable — it exists only because
  // next-intl types it as returning void rather than never.
  return {};
}

export async function signOutAction(locale: Locale): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = await createServerSupabase();
    await supabase.auth.signOut();
  }
  redirect({ href: '/login', locale });
}
