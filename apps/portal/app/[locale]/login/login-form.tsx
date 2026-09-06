'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { Alert, Button, Field, LtrInput, Spinner } from '@clinic/ui';
import type { Locale } from '@clinic/domain';
import { sendMagicLink, type MagicLinkState } from './actions';

export function PortalLoginForm({ locale }: { locale: Locale }) {
  const t = useTranslations('auth');
  const [state, formAction, isPending] = useActionState<MagicLinkState, FormData>(
    sendMagicLink.bind(null, locale),
    { status: 'idle' },
  );

  if (state.status === 'sent') {
    return <Alert tone="success">{t('magicLinkSent')}</Alert>;
  }

  return (
    <form action={formAction} className="space-y-4">
      {state.status === 'error' ? <Alert tone="danger">{t('magicLinkError')}</Alert> : null}
      {state.status === 'notConfigured' ? (
        <Alert tone="warning">{t('notConfigured')}</Alert>
      ) : null}

      <Field label={t('email')} htmlFor="email" required>
        <LtrInput
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          disabled={isPending}
        />
      </Field>

      <Button type="submit" size="lg" className="w-full" disabled={isPending}>
        {isPending ? <Spinner /> : null}
        {isPending ? t('sendingMagicLink') : t('sendMagicLink')}
      </Button>
    </form>
  );
}
