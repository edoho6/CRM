'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { Alert, Button, Field, LtrInput, Spinner } from '@clinic/ui';
import type { Locale } from '@clinic/domain';
import { verifySecondFactorAction, type VerifyState } from '../actions';

export function VerifyForm({ locale, joinToken }: { locale: Locale; joinToken?: string }) {
  const t = useTranslations('auth.verify');
  const [state, formAction, isPending] = useActionState<VerifyState, FormData>(
    verifySecondFactorAction.bind(null, locale),
    {},
  );

  return (
    <form action={formAction} className="space-y-4">
      {joinToken ? <input type="hidden" name="join" value={joinToken} /> : null}
      {state.error ? (
        <Alert tone="danger">
          {state.error === 'tooManyAttempts'
            ? t('tooManyAttempts', { minutes: Math.max(1, Math.ceil((state.retryAfterSeconds ?? 0) / 60)) })
            : t('invalidCode')}
        </Alert>
      ) : null}

      <Field label={t('code')} htmlFor="code" hint={t('help')} required>
        {/* Digits only, LTR even on a Hebrew page: a code is read the way the app shows it. */}
        <LtrInput
          id="code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          autoFocus
          disabled={isPending}
          className="text-center text-lg tracking-[0.4em]"
        />
      </Field>

      <Button type="submit" size="lg" className="w-full" disabled={isPending}>
        {isPending ? <Spinner /> : null}
        {isPending ? t('submitting') : t('submit')}
      </Button>
    </form>
  );
}
