'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { BellOff } from 'lucide-react';
import { Alert, Button, Spinner } from '@clinic/ui';
import { unsubscribeMarketing, type UnsubscribeResult } from '../actions';

/**
 * One button and a confirmation.
 *
 * Opened on a phone, from a message, by someone who wants these to stop:
 * one tap, and a sentence that says it is done and that appointment
 * reminders are a different thing and still come.
 */
export function ConfirmForm({ token }: { token: string }) {
  const t = useTranslations('unsubscribe');
  const [result, setResult] = useState<UnsubscribeResult | null>(null);
  const [isPending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      setResult(await unsubscribeMarketing(token));
    });
  }

  if (result === 'done') {
    return <Alert tone="success">{t('done')}</Alert>;
  }

  return (
    <div className="space-y-3">
      {result === 'expired' ? <Alert tone="danger">{t('expired')}</Alert> : null}
      {result === 'error' ? <Alert tone="danger">{t('error')}</Alert> : null}
      <Button type="button" size="lg" className="w-full" disabled={isPending} onClick={confirm}>
        {isPending ? <Spinner /> : <BellOff className="h-5 w-5" aria-hidden />}
        {t('confirm')}
      </Button>
      <p className="text-center text-xs text-ink-500">{t('remindersStay')}</p>
    </div>
  );
}
