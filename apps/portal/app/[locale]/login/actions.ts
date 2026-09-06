'use server';

import { createServerSupabase, isSupabaseConfigured, siteUrl } from '@clinic/db';
import type { Locale } from '@clinic/domain';

export interface MagicLinkState {
  status: 'idle' | 'sent' | 'error' | 'notConfigured';
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
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
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

export async function portalSignOut(): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
}
