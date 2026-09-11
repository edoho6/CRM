'use client';

import { useActionState, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Alert, Button, Field, LtrInput, Spinner } from '@clinic/ui';
import type { Locale } from '@clinic/domain';
import { sendMagicLink, type MagicLinkState } from './actions';

/** How long the "send again" button waits: long enough for the first mail to land. */
const RESEND_SECONDS = 60;

/**
 * One field, one button, and then a screen that says where the link went.
 *
 * It used to say only "sent" — and someone who typed their address wrong, or
 * whose mail took a minute, had nothing to do but reload and guess. Now the
 * address is shown back, the link can be sent again after a minute, and a
 * wrong address is one tap from the form.
 */
export function PortalLoginForm({ locale, expired = false }: { locale: Locale; expired?: boolean }) {
  const t = useTranslations('auth');
  const [state, formAction, isPending] = useActionState<MagicLinkState, FormData>(
    sendMagicLink.bind(null, locale),
    { status: 'idle' },
  );
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);

  // The address the last send went to, and a fresh minute on the clock.
  useEffect(() => {
    if (state.status !== 'sent') return;
    setSentTo(email.trim());
    setSecondsLeft(RESEND_SECONDS);
  }, [state, email]);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = window.setTimeout(() => setSecondsLeft((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [secondsLeft]);

  if (state.status === 'sent' && sentTo) {
    return (
      <div className="space-y-4">
        <Alert tone="success">{t('sentTo', { email: sentTo })}</Alert>
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="email" value={sentTo} />
          <Button
            type="submit"
            variant="secondary"
            size="lg"
            className="w-full"
            disabled={isPending || secondsLeft > 0}
          >
            {isPending ? <Spinner /> : null}
            {secondsLeft > 0 ? t('resendIn', { seconds: secondsLeft }) : t('resendLink')}
          </Button>
        </form>
        <Button
          type="button"
          variant="ghost"
          className="w-full"
          onClick={() => {
            setSentTo(null);
            setSecondsLeft(0);
          }}
        >
          {t('useAnotherEmail')}
        </Button>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      {expired && state.status === 'idle' ? (
        <Alert tone="warning">{t('magicLinkExpired')}</Alert>
      ) : null}
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
          inputMode="email"
          required
          disabled={isPending}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </Field>

      <Button type="submit" size="lg" className="w-full" disabled={isPending}>
        {isPending ? <Spinner /> : null}
        {isPending ? t('sendingMagicLink') : t('sendMagicLink')}
      </Button>
    </form>
  );
}
