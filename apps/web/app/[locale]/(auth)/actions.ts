'use server';

import { headers } from 'next/headers';
import { redirect } from '@clinic/i18n/navigation';
import { createServerSupabase, isSupabaseConfigured } from '@clinic/db';
import type { Locale } from '@clinic/domain';
import { checkRateLimit, clearAttempts, recordFailure } from '@/lib/rate-limit';

export interface SignInState {
  error?: 'invalidCredentials' | 'notConfigured' | 'generic' | 'tooManyAttempts';
  retryAfterSeconds?: number;
}

/**
 * What the limiter counts against.
 *
 * The address and the source address together, so one person guessing many
 * accounts and many people behind one office NAT are both handled sensibly:
 * locking an account by address alone would let anyone lock a colleague out by
 * typing their email wrong eight times.
 */
async function rateLimitKey(email: string): Promise<string> {
  const headerList = await headers();
  const forwarded = headerList.get('x-forwarded-for') ?? '';
  const ip = forwarded.split(',')[0]?.trim() || headerList.get('x-real-ip') || 'unknown';
  return `${email.toLowerCase()}|${ip}`;
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

  const key = await rateLimitKey(email);
  const limit = checkRateLimit(key);
  if (!limit.allowed) {
    return { error: 'tooManyAttempts', retryAfterSeconds: limit.retryAfterSeconds };
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Only failures are counted; a correct password is not suspicious.
    recordFailure(key);
    return { error: 'invalidCredentials' };
  }

  clearAttempts(key);
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
