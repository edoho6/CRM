'use client';

import { useActionState, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Trash2 } from 'lucide-react';
import { Alert, Button, Field, Spinner, Textarea, useConfirm } from '@clinic/ui';
import type { Locale } from '@clinic/domain';
import { deletePortalAccount, type DeletePortalAccountState } from './actions';

/**
 * The form on the patient's account page: an optional reason and one
 * button, behind the same confirmation dialog every deletion gets. What it
 * means is said on the page above it, in the server component that knows
 * the words.
 */
export function DeleteAccountForm({ locale }: { locale: Locale }) {
  const t = useTranslations('portal.account.deletion');
  const tc = useTranslations('common');
  const confirm = useConfirm();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, isPending] = useActionState<DeletePortalAccountState, FormData>(
    deletePortalAccount.bind(null, locale),
    { status: 'idle' },
  );

  async function ask() {
    const ok = await confirm({
      title: t('confirmTitle'),
      body: t('confirmBody'),
      confirmLabel: t('confirmButton'),
      destructive: true,
    });
    if (ok) formRef.current?.requestSubmit();
  }

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      {state.status === 'error' ? <Alert tone="danger">{tc('errorGeneric')}</Alert> : null}
      <Field label={t('reasonLabel')} htmlFor="reason" hint={t('reasonHint')}>
        <Textarea id="reason" name="reason" rows={2} maxLength={500} disabled={isPending} />
      </Field>
      <div className="flex justify-end">
        <Button type="button" variant="danger" size="lg" disabled={isPending} onClick={ask}>
          {isPending ? <Spinner /> : <Trash2 className="h-4 w-4" aria-hidden />}
          {t('button')}
        </Button>
      </div>
    </form>
  );
}
