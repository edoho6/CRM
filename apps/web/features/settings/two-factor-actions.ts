'use server';

import { getClinicScope } from '@/lib/session';
import { actionError, actionOk, type ActionResult } from '@/lib/errors';

/**
 * Enrolling an authenticator app, in two steps.
 *
 * Step one asks Supabase for a new factor and hands back the QR code and the
 * secret behind it; the person scans one or types the other into their app.
 * Step two takes the first code the app shows and verifies the factor with
 * it — from then on every sign-in asks for a code, and the database refuses
 * the clinic to any session that has not given one (migration 39).
 *
 * An attempt abandoned between the steps leaves an unverified factor behind,
 * and Supabase refuses a second one under the same name; those are cleared
 * before a new attempt starts.
 */
export async function startTwoFactorEnrollment(): Promise<
  ActionResult<{ factorId: string; qr: string; secret: string }>
> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));
  const { auth } = scope.supabase;

  const existing = await auth.mfa.listFactors();
  if (existing.error) return actionError(new Error(existing.error.message));
  for (const factor of existing.data.totp) {
    if (factor.status !== 'verified') await auth.mfa.unenroll({ factorId: factor.id });
  }

  const { data, error } = await auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Herbalist' });
  if (error || !data) return actionError(new Error(error?.message ?? 'enroll_failed'));
  return actionOk({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
}

export async function confirmTwoFactorEnrollment(factorId: string, code: string): Promise<ActionResult> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));
  const digits = code.replace(/\s+/g, '');
  if (!/^\d{6}$/.test(digits) || !/^[0-9a-f-]{36}$/i.test(factorId)) return actionError(new Error('validation'));

  const { error } = await scope.supabase.auth.mfa.challengeAndVerify({ factorId, code: digits });
  if (error) return actionError(new Error('invalid_code'));
  return actionOk();
}

/**
 * Switching the second factor off. Supabase only allows it from a session
 * that has given the code (aal2), which is the session that reaches this
 * page at all — so no extra code is asked for here.
 */
export async function disableTwoFactor(factorId: string): Promise<ActionResult> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));
  if (!/^[0-9a-f-]{36}$/i.test(factorId)) return actionError(new Error('validation'));

  const { error } = await scope.supabase.auth.mfa.unenroll({ factorId });
  if (error) return actionError(new Error(error.message));
  return actionOk();
}
