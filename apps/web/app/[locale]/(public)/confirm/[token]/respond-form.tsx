'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Check, X } from 'lucide-react';
import { Alert, Button, Spinner } from '@clinic/ui';
import { respondToAppointment, type RespondResult } from '../actions';

/**
 * Two buttons and a thank-you.
 *
 * Deliberately nothing else: this is opened on a phone, from a message, by
 * someone who wants to tap once and get on with their day. The current answer
 * is shown so a second visit says "you already confirmed" rather than asking
 * again as if nothing happened.
 */
export function RespondForm({
  token,
  current,
}: {
  token: string;
  current: 'confirmed' | 'declined' | null;
}) {
  const t = useTranslations('confirm');
  const [result, setResult] = useState<RespondResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const answered = result === 'confirmed' || result === 'declined' ? result : current;

  function respond(response: 'confirmed' | 'declined') {
    startTransition(async () => {
      setResult(await respondToAppointment(token, response));
    });
  }

  return (
    <div className="space-y-3">
      {answered ? (
        <Alert tone={answered === 'confirmed' ? 'success' : 'warning'}>
          {t(answered === 'confirmed' ? 'thanksConfirmed' : 'thanksDeclined')}
        </Alert>
      ) : null}
      {result === 'expired' ? <Alert tone="danger">{t('expired')}</Alert> : null}
      {result === 'error' ? <Alert tone="danger">{t('error')}</Alert> : null}

      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          size="lg"
          disabled={isPending}
          aria-pressed={answered === 'confirmed'}
          onClick={() => respond('confirmed')}
        >
          {isPending ? <Spinner /> : <Check className="h-5 w-5" aria-hidden />}
          {t('yes')}
        </Button>
        <Button
          type="button"
          size="lg"
          variant="secondary"
          disabled={isPending}
          aria-pressed={answered === 'declined'}
          onClick={() => respond('declined')}
        >
          <X className="h-5 w-5" aria-hidden />
          {t('no')}
        </Button>
      </div>
      <p className="text-center text-xs text-ink-500">{t('changeLater')}</p>
    </div>
  );
}
