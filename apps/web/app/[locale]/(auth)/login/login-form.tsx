'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { Alert, Button, Field, LtrInput, Input, Spinner } from '@clinic/ui';
import type { Locale } from '@clinic/domain';
import { signInAction, type SignInState } from '../actions';

export function LoginForm({ locale }: { locale: Locale }) {
  const t = useTranslations('auth');
  const [state, formAction, isPending] = useActionState<SignInState, FormData>(
    signInAction.bind(null, locale),
    {},
  );

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? (
        <Alert tone="danger">
          {state.error === 'notConfigured'
            ? t('notConfigured')
            : state.error === 'tooManyAttempts'
              ? t('tooManyAttempts', {
                  minutes: Math.max(1, Math.ceil((state.retryAfterSeconds ?? 0) / 60)),
                })
              : t('invalidCredentials')}
        </Alert>
      ) : null}

      <Field label={t('email')} htmlFor="email" required>
        {/* Email stays LTR even in a Hebrew page — otherwise the address renders
            with its parts visually reordered. */}
        <LtrInput
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          disabled={isPending}
        />
      </Field>

      <Field label={t('password')} htmlFor="password" required>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          disabled={isPending}
        />
      </Field>

      <Button type="submit" size="lg" className="w-full" disabled={isPending}>
        {isPending ? <Spinner /> : null}
        {isPending ? t('signingIn') : t('signIn')}
      </Button>
    </form>
  );
}
