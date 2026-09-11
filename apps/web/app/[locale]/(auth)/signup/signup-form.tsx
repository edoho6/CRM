'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { Alert, Button, Field, Input, LtrInput, Spinner } from '@clinic/ui';
import type { Locale } from '@clinic/domain';
import { Link } from '@clinic/i18n/navigation';
import { signUpAction, type SignUpState } from '../actions';

/**
 * Five fields and a button. The clinic's name is asked here, not on a later
 * screen, because the person signing up is the clinic: there is no "set up
 * your workspace" step that would not be this same question asked twice.
 */
export function SignupForm({
  locale,
  joinToken,
  joinClinic,
}: {
  locale: Locale;
  /** From an invitation link: no clinic to name, and the account joins the inviting one. */
  joinToken?: string;
  joinClinic?: string;
}) {
  const t = useTranslations('auth.signup');
  const tAuth = useTranslations('auth');
  const [state, formAction, isPending] = useActionState<SignUpState, FormData>(
    signUpAction.bind(null, locale),
    {},
  );

  if (state.status === 'checkEmail') {
    return (
      <div className="space-y-4">
        <Alert tone="success" title={t('checkEmailTitle')}>
          {t(state.join ? 'joinCheckEmailBody' : 'checkEmailBody', { email: state.email ?? '' })}
        </Alert>
        <Link href="/login" className="block text-center text-sm text-jade-800 underline-offset-2 hover:underline">
          {tAuth('backToSignIn')}
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? (
        <Alert tone="danger">
          {state.error === 'tooManyAttempts'
            ? tAuth('tooManyAttempts', {
                minutes: Math.max(1, Math.ceil((state.retryAfterSeconds ?? 0) / 60)),
              })
            : t(`errors.${state.error}`)}
        </Alert>
      ) : null}

      <Field label={t('fullName')} htmlFor="full_name" required>
        <Input id="full_name" name="full_name" autoComplete="name" required disabled={isPending} />
      </Field>

      {joinToken ? (
        <>
          <input type="hidden" name="join" value={joinToken} />
          <p className="text-sm text-ink-700">{t('joinHint', { clinic: joinClinic ?? '' })}</p>
        </>
      ) : (
        <Field label={t('clinicName')} htmlFor="clinic_name" required hint={t('clinicNameHint')}>
          <Input id="clinic_name" name="clinic_name" autoComplete="organization" required disabled={isPending} />
        </Field>
      )}

      <Field label={t('phone')} htmlFor="phone">
        <LtrInput id="phone" name="phone" type="tel" autoComplete="tel" disabled={isPending} />
      </Field>

      <Field label={tAuth('email')} htmlFor="email" required>
        <LtrInput id="email" name="email" type="email" autoComplete="email" required disabled={isPending} />
      </Field>

      <Field label={tAuth('password')} htmlFor="password" required hint={t('passwordHint')}>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          disabled={isPending}
        />
      </Field>

      <p className="text-xs text-ink-500">{t('terms')}</p>

      <Button type="submit" size="lg" className="w-full" disabled={isPending}>
        {isPending ? <Spinner /> : null}
        {isPending ? t('creating') : joinToken ? t('joinCreate') : t('create')}
      </Button>
    </form>
  );
}
