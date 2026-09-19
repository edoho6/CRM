'use client';

import { useActionState, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Alert, Button, Field, LtrInput, Spinner } from '@clinic/ui';
import type { Locale } from '@clinic/domain';
import {
  sendMagicLink,
  signInWithCode,
  signInWithPassword,
  type CodeState,
  type MagicLinkState,
  type PasswordState,
} from './actions';

/** How long the "send again" button waits: long enough for the first mail to land. */
const RESEND_SECONDS = 60;

/**
 * One field, one button, and then a screen that says where the link went.
 *
 * It used to say only "sent" — and someone who typed their address wrong, or
 * whose mail took a minute, had nothing to do but reload and guess. Now the
 * address is shown back, the link can be sent again after a minute, and a
 * wrong address is one tap from the form.
 *
 * The same mail carries a code; the "sent" screen takes it, for whoever reads
 * the mail somewhere else. And at the foot of the form, folded away, a
 * password sign-in — for the stores' reviewers on the sandbox clinic, and
 * refused by the database to everyone else.
 */
export function PortalLoginForm({ locale, expired = false }: { locale: Locale; expired?: boolean }) {
  const t = useTranslations('auth');
  const [state, formAction, isPending] = useActionState<MagicLinkState, FormData>(
    sendMagicLink.bind(null, locale),
    { status: 'idle' },
  );
  const [codeState, codeAction, isCodePending] = useActionState<CodeState, FormData>(
    signInWithCode.bind(null, locale),
    { status: 'idle' },
  );
  const [passwordState, passwordAction, isPasswordPending] = useActionState<PasswordState, FormData>(
    signInWithPassword.bind(null, locale),
    { status: 'idle' },
  );
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);

  // The address the last send went to, and a fresh minute on the clock — taken
  // when a new answer arrives, while rendering, not in an effect after it.
  const [seenState, setSeenState] = useState(state);
  if (state !== seenState) {
    setSeenState(state);
    if (state.status === 'sent') {
      setSentTo(email.trim());
      setSecondsLeft(RESEND_SECONDS);
    }
  }

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = window.setTimeout(() => setSecondsLeft((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [secondsLeft]);

  if (state.status === 'sent' && sentTo) {
    return (
      <div className="space-y-4">
        <Alert tone="success">{t('sentTo', { email: sentTo })}</Alert>

        {/* The code from that same mail, for a mailbox read on another device. */}
        <form action={codeAction} className="space-y-3">
          <input type="hidden" name="email" value={sentTo} />
          {codeState.status === 'error' ? <Alert tone="danger">{t('code.error')}</Alert> : null}
          {codeState.status === 'tooManyAttempts' ? (
            <Alert tone="danger">
              {t('code.tooManyAttempts', { minutes: Math.max(1, Math.ceil((codeState.retryAfterSeconds ?? 60) / 60)) })}
            </Alert>
          ) : null}
          <Field label={t('code.label')} htmlFor="code" hint={t('code.hint')}>
            <LtrInput
              id="code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9 ]*"
              maxLength={9}
              required
              disabled={isCodePending}
            />
          </Field>
          <Button type="submit" size="lg" className="w-full" disabled={isCodePending}>
            {isCodePending ? <Spinner /> : null}
            {t('code.submit')}
          </Button>
        </form>

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
    <div className="space-y-4">
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

      {/* Folded away: a patient never needs it, and the database refuses it
          to everyone but the sandbox clinic's accounts. */}
      <details className="group rounded-lg border border-ink-200 bg-ink-50 px-3 py-2 text-sm">
        <summary className="cursor-pointer select-none font-medium text-ink-700 marker:text-ink-400">
          {t('passwordDoor.summary')}
        </summary>
        <form action={passwordAction} className="mt-3 space-y-3">
          <p className="text-xs text-ink-600">{t('passwordDoor.hint')}</p>
          {passwordState.status === 'invalidCredentials' ? (
            <Alert tone="danger">{t('invalidCredentials')}</Alert>
          ) : null}
          {passwordState.status === 'notAllowed' ? (
            <Alert tone="warning">{t('passwordDoor.notAllowed')}</Alert>
          ) : null}
          {passwordState.status === 'tooManyAttempts' ? (
            <Alert tone="danger">
              {t('tooManyAttempts', { minutes: Math.max(1, Math.ceil((passwordState.retryAfterSeconds ?? 60) / 60)) })}
            </Alert>
          ) : null}
          {passwordState.status === 'notConfigured' ? <Alert tone="warning">{t('notConfigured')}</Alert> : null}
          <Field label={t('email')} htmlFor="password-email" required>
            <LtrInput id="password-email" name="email" type="email" autoComplete="username" inputMode="email" required disabled={isPasswordPending} />
          </Field>
          <Field label={t('password')} htmlFor="password" required>
            <LtrInput id="password" name="password" type="password" autoComplete="current-password" required disabled={isPasswordPending} />
          </Field>
          <Button type="submit" variant="secondary" className="w-full" disabled={isPasswordPending}>
            {isPasswordPending ? <Spinner /> : null}
            {t('signIn')}
          </Button>
        </form>
      </details>
    </div>
  );
}
