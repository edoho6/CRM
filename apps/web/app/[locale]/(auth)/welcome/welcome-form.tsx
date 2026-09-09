'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { Alert, Button, Field, Input, LtrInput, Spinner } from '@clinic/ui';
import type { Locale } from '@clinic/domain';
import { createClinicAction, type CreateClinicState } from '../actions';

/**
 * The one question a signed-in person with no clinic is asked.
 *
 * Pre-filled from what they typed at sign-up, when the email confirmation
 * step meant the clinic could not be made in the same breath — so this is
 * usually one click, and a form only for someone who arrived another way.
 */
export function WelcomeForm({
  locale,
  defaultClinicName,
  defaultPhone,
}: {
  locale: Locale;
  defaultClinicName: string;
  defaultPhone: string;
}) {
  const t = useTranslations('auth.welcome');
  const tSignup = useTranslations('auth.signup');
  const [state, formAction, isPending] = useActionState<CreateClinicState, FormData>(
    createClinicAction.bind(null, locale),
    {},
  );

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? <Alert tone="danger">{tSignup(`errors.${state.error}`)}</Alert> : null}

      <Field label={tSignup('clinicName')} htmlFor="clinic_name" required>
        <Input
          id="clinic_name"
          name="clinic_name"
          defaultValue={defaultClinicName}
          autoComplete="organization"
          required
          disabled={isPending}
        />
      </Field>

      <Field label={tSignup('phone')} htmlFor="phone">
        <LtrInput
          id="phone"
          name="phone"
          type="tel"
          defaultValue={defaultPhone}
          autoComplete="tel"
          disabled={isPending}
        />
      </Field>

      <Button type="submit" size="lg" className="w-full" disabled={isPending}>
        {isPending ? <Spinner /> : null}
        {isPending ? tSignup('creating') : t('open')}
      </Button>
    </form>
  );
}
