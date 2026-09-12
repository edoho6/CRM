'use server';

import { headers } from 'next/headers';
import { redirect } from '@clinic/i18n/navigation';
import { createServerSupabase, isSupabaseConfigured, siteUrl } from '@clinic/db';
import { checkRateLimit, clearAttempts, recordFailure } from '@clinic/db/rate-limit';
import type { Locale } from '@clinic/domain';
import { unregisterPortalPushDeviceFromCookie } from '../account/push-actions';

export interface MagicLinkState {
  status: 'idle' | 'sent' | 'error' | 'notConfigured';
}

export interface CodeState {
  status: 'idle' | 'error' | 'tooManyAttempts';
  retryAfterSeconds?: number;
}

export interface PasswordState {
  status: 'idle' | 'invalidCredentials' | 'notAllowed' | 'tooManyAttempts' | 'notConfigured';
  retryAfterSeconds?: number;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The address and the source address together — see the staff sign-in for why. */
async function rateLimitKey(email: string): Promise<string> {
  const headerList = await headers();
  const forwarded = headerList.get('x-forwarded-for') ?? '';
  const ip = forwarded.split(',')[0]?.trim() || headerList.get('x-real-ip') || 'unknown';
  return `portal|${email.toLowerCase()}|${ip}`;
}

/**
 * Sends a magic-link sign-in email.
 *
 * Patients get links rather than passwords: there is no password for them to forget
 * or reuse, and possession of the mailbox is the same evidence the clinic already
 * relies on when it emails them documents.
 *
 * The result is identical whether or not the address is known to the clinic, so the
 * form cannot be used to find out who is a patient here.
 */
export async function sendMagicLink(
  locale: Locale,
  _prevState: MagicLinkState,
  formData: FormData,
): Promise<MagicLinkState> {
  if (!isSupabaseConfigured()) {
    return { status: 'notConfigured' };
  }

  const email = String(formData.get('email') ?? '').trim();
  if (!email || !EMAIL.test(email)) {
    return { status: 'error' };
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${siteUrl()}/auth/callback?locale=${locale}`,
      // Patients are invited by the clinic; a link must never quietly create an
      // account for an address that was never registered.
      shouldCreateUser: false,
    },
  });

  if (error) {
    return { status: 'error' };
  }

  return { status: 'sent' };
}

/**
 * The digits from the same email as the link.
 *
 * The link is the easy way; the code is for whoever reads the mail on
 * another device, or for the stores' reviewers, who open the app on a phone
 * with no mailbox on it. Same email, same expiry, same claim of the patient
 * file afterwards. Guessing is rate-limited like a password would be.
 */
export async function signInWithCode(locale: Locale, _prevState: CodeState, formData: FormData): Promise<CodeState> {
  if (!isSupabaseConfigured()) return { status: 'error' };

  const email = String(formData.get('email') ?? '').trim();
  const token = String(formData.get('code') ?? '').replace(/\D/g, '');
  if (!EMAIL.test(email) || token.length < 6 || token.length > 8) return { status: 'error' };

  const key = await rateLimitKey(email);
  const limit = checkRateLimit(key);
  if (!limit.allowed) return { status: 'tooManyAttempts', retryAfterSeconds: limit.retryAfterSeconds };

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
  if (error) {
    recordFailure(key);
    return { status: 'error' };
  }
  clearAttempts(key);

  // The same link to the patient file the magic-link landing makes.
  await supabase.rpc('claim_portal_access');
  redirect({ href: '/', locale });
  return { status: 'idle' };
}

/**
 * A password, for the stores' reviewers and for nobody else.
 *
 * Patients have no password, so this fails for them before anything is
 * decided. For an account that does have one, the database is asked whether
 * the door is open — `portal_password_login_allowed()` is true only inside a
 * synthetic clinic — and a session that is not allowed is ended on the spot.
 * The form cannot widen this: the rule is in the database.
 */
export async function signInWithPassword(
  locale: Locale,
  _prevState: PasswordState,
  formData: FormData,
): Promise<PasswordState> {
  if (!isSupabaseConfigured()) return { status: 'notConfigured' };

  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  if (!EMAIL.test(email) || !password) return { status: 'invalidCredentials' };

  const key = await rateLimitKey(email);
  const limit = checkRateLimit(key);
  if (!limit.allowed) return { status: 'tooManyAttempts', retryAfterSeconds: limit.retryAfterSeconds };

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    recordFailure(key);
    return { status: 'invalidCredentials' };
  }

  await supabase.rpc('claim_portal_access');
  const { data: allowed } = await supabase.rpc('portal_password_login_allowed');
  if (allowed !== true) {
    await supabase.auth.signOut();
    return { status: 'notAllowed' };
  }

  clearAttempts(key);
  redirect({ href: '/', locale });
  return { status: 'idle' };
}

export async function portalSignOut(): Promise<void> {
  if (!isSupabaseConfigured()) return;
  // The phone this session is leaving stops getting this person's reminders.
  await unregisterPortalPushDeviceFromCookie();
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
}
