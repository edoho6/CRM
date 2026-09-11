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
  // Someone who signed in from an invitation link goes back to it, to accept.
  const join = String(formData.get('join') ?? '');
  redirect({ href: UUID.test(join) ? `/join/${join}` : '/', locale });
  // `redirect` throws internally, so this is unreachable — it exists only because
  // next-intl types it as returning void rather than never.
  return {};
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface AcceptInvitationState {
  error?: 'closed' | 'portal' | 'generic';
}

/**
 * Joins the signed-in account to the inviting clinic. "Already a member" is
 * a double click and goes home; a closed link, or a portal account, is told
 * so on the page.
 */
export async function acceptInvitationAction(
  locale: Locale,
  token: string,
  _prevState: AcceptInvitationState,
  _formData: FormData,
): Promise<AcceptInvitationState> {
  if (!isSupabaseConfigured() || !UUID.test(token)) return { error: 'generic' };
  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc('accept_invitation', { p_token: token });
  if (error) {
    if (error.message.includes('already_member')) {
      redirect({ href: '/', locale });
      return {};
    }
    if (error.message.includes('portal_account')) return { error: 'portal' };
    if (error.message.includes('invitation_')) return { error: 'closed' };
    return { error: 'generic' };
  }
  redirect({ href: '/', locale });
  return {};
}

export async function signOutAction(locale: Locale): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = await createServerSupabase();
    await supabase.auth.signOut();
  }
  redirect({ href: '/login', locale });
}

/* ---------------------------------------------------------------------------
 * Sign-up: a person, then their clinic
 * ------------------------------------------------------------------------ */

export interface SignUpState {
  status?: 'checkEmail';
  email?: string;
  /** The account was made from an invitation link; the join finishes after the email. */
  join?: boolean;
  error?: 'missing' | 'weakPassword' | 'emailTaken' | 'tooManyAttempts' | 'generic';
  retryAfterSeconds?: number;
}

/**
 * Creates the account, and — when the sign-up hands back a session at once —
 * the clinic too, in the same breath. When email confirmation is on, the
 * session only exists after the link is clicked; the clinic's name travels in
 * the account's metadata and the welcome page finishes the job with one click.
 *
 * Rate-limited by address, so the form cannot be used to make accounts in
 * bulk or to probe which addresses exist.
 */
export async function signUpAction(
  locale: Locale,
  _prevState: SignUpState,
  formData: FormData,
): Promise<SignUpState> {
  if (!isSupabaseConfigured()) return { error: 'generic' };

  const fullName = String(formData.get('full_name') ?? '').trim();
  const clinicName = String(formData.get('clinic_name') ?? '').trim();
  const phone = String(formData.get('phone') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  // From an invitation link: no clinic of their own to name, and the token
  // rides in the account's metadata so the welcome page can finish the join
  // after the email is confirmed.
  const joinRaw = String(formData.get('join') ?? '');
  const join = UUID.test(joinRaw) ? joinRaw : null;

  if (!fullName || (!clinicName && !join) || !email || !password) return { error: 'missing' };
  if (password.length < 8) return { error: 'weakPassword' };

  const key = await rateLimitKey(`signup:${email}`);
  const limit = checkRateLimit(key);
  if (!limit.allowed) {
    return { error: 'tooManyAttempts', retryAfterSeconds: limit.retryAfterSeconds };
  }

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        clinic_name: join ? '' : clinicName,
        phone,
        preferred_locale: locale,
        ...(join ? { invitation_token: join } : {}),
      },
    },
  });

  if (error) {
    recordFailure(key);
    const message = error.message.toLowerCase();
    if (message.includes('already') || message.includes('registered')) return { error: 'emailTaken' };
    if (message.includes('password')) return { error: 'weakPassword' };
    return { error: 'generic' };
  }

  // Supabase answers an already-registered address with a user that has no
  // identities rather than an error, so the form cannot tell who has an
  // account. Treat it exactly like a fresh sign-up that needs its email.
  if (!data.session) {
    return { status: 'checkEmail', email, join: Boolean(join) };
  }

  if (join) {
    const { error: joinError } = await supabase.rpc('accept_invitation', { p_token: join });
    // The link explains itself when it cannot be used.
    redirect({ href: joinError ? `/join/${join}` : '/', locale });
    return {};
  }

  const { error: clinicError } = await supabase.rpc('create_clinic_for_current_user', {
    p_name: clinicName,
    p_phone: phone || null,
  });
  if (clinicError) {
    // The account exists; the clinic can still be made on the welcome page.
    redirect({ href: '/welcome', locale });
    return {};
  }

  redirect({ href: '/', locale });
  return {};
}

export interface CreateClinicState {
  error?: 'missing' | 'generic';
}

/** The welcome page's one action: make the clinic for the signed-in account. */
export async function createClinicAction(
  locale: Locale,
  _prevState: CreateClinicState,
  formData: FormData,
): Promise<CreateClinicState> {
  if (!isSupabaseConfigured()) return { error: 'generic' };

  const clinicName = String(formData.get('clinic_name') ?? '').trim();
  const phone = String(formData.get('phone') ?? '').trim();
  if (!clinicName) return { error: 'missing' };

  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc('create_clinic_for_current_user', {
    p_name: clinicName,
    p_phone: phone || null,
  });
  // Already a member means a double click, and home is the right answer.
  if (error && error.code !== '23505') return { error: 'generic' };

  redirect({ href: '/', locale });
  return {};
}
