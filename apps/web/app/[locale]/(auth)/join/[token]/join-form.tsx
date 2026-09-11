'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { Alert, Button, Spinner } from '@clinic/ui';
import type { Locale } from '@clinic/domain';
import { acceptInvitationAction, type AcceptInvitationState } from '../../actions';

/** One button for a signed-in account with no clinic: join this one. */
export function JoinForm({ locale, token, clinic, role }: { locale: Locale; token: string; clinic: string; role: string }) {
  const t = useTranslations('join');
  const [state, formAction, isPending] = useActionState<AcceptInvitationState, FormData>(
    acceptInvitationAction.bind(null, locale, token),
    {},
  );

  return (
    <form action={formAction} className="space-y-4">
      <p className="text-sm text-ink-800">{t('body', { clinic, role })}</p>
      {state.error ? <Alert tone="danger">{t(state.error === 'portal' ? 'portalAccount' : state.error === 'closed' ? 'closed' : 'failed')}</Alert> : null}
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? <Spinner className="h-4 w-4" /> : null}
        {isPending ? t('accepting') : t('accept', { clinic })}
      </Button>
    </form>
  );
}
