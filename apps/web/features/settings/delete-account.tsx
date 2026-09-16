'use client';

import { useState, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Trash2 } from 'lucide-react';
import { Alert, Button, Field, Input, Spinner, Textarea, useConfirm } from '@clinic/ui';
import { Link } from '@clinic/i18n/navigation';
import { deleteOwnAccount, type DeletionOutcome } from './account-actions';

const GOES = ['signIn', 'contact', 'memberships', 'preferences'] as const;
const STAYS = ['records', 'invoices', 'access'] as const;

/**
 * The last panel of the personal area: deleting the account.
 *
 * It says what goes and what stays before asking anything, because the one
 * surprise a person must not have here is a record that still bears their
 * name — and it is kept on purpose, by law. The clinic's name typed back is
 * the confirmation; the dialog after it is the second, as for any deletion.
 * A refusal (the clinic's only owner) is explained in place, not as an error.
 */
export function DeleteAccountPanel({ clinicName }: { clinicName: string }) {
  const t = useTranslations('account.deletion');
  const tc = useTranslations('common');
  const locale = useLocale();
  const confirm = useConfirm();
  const [isPending, startTransition] = useTransition();
  const [typed, setTyped] = useState('');
  const [reason, setReason] = useState('');
  const [blocker, setBlocker] = useState<Extract<DeletionOutcome, { status: 'needs_review' }>['blocker'] | null>(null);
  const [failed, setFailed] = useState(false);
  const confirmed = typed.trim() === clinicName.trim();

  async function request() {
    const ok = await confirm({
      title: t('confirmTitle'),
      body: t('confirmBody'),
      confirmLabel: t('confirmButton'),
      destructive: true,
    });
    if (!ok) return;
    setFailed(false);
    setBlocker(null);
    startTransition(async () => {
      const result = await deleteOwnAccount(reason);
      if (!result.ok) {
        setFailed(true);
        return;
      }
      if (result.data.status === 'needs_review') {
        setBlocker(result.data.blocker);
        return;
      }
      // A full load, and deliberately not a router navigation: the session is
      // gone, and so is every cached server component the shell around this
      // page was built from. Next's own advice here assumes a session that
      // survives the navigation.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign(`/${locale}/login?deleted=1`);
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-ink-700">{t('body')}</p>

      <div className="grid gap-4 sm:grid-cols-2">
        <section aria-labelledby="deletion-goes">
          <h3 id="deletion-goes" className="text-sm font-semibold text-ink-900">
            {t('goesTitle')}
          </h3>
          <ul className="mt-1 list-disc space-y-1 ps-5 text-sm text-ink-700">
            {GOES.map((key) => (
              <li key={key}>{t(`goes.${key}`)}</li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="deletion-stays">
          <h3 id="deletion-stays" className="text-sm font-semibold text-ink-900">
            {t('staysTitle')}
          </h3>
          <ul className="mt-1 list-disc space-y-1 ps-5 text-sm text-ink-700">
            {STAYS.map((key) => (
              <li key={key}>{t(`stays.${key}`)}</li>
            ))}
          </ul>
        </section>
      </div>

      <p className="text-xs text-ink-600">
        <Link href="/delete-account" className="underline underline-offset-2 hover:text-ink-900">
          {t('publicPage')}
        </Link>
      </p>

      {blocker ? (
        <Alert tone="warning">
          {t(`blocker.${blocker}`)}
        </Alert>
      ) : null}
      {failed ? <Alert tone="danger">{tc('errorGeneric')}</Alert> : null}

      <Field label={t('reasonLabel')} htmlFor="deletion-reason" hint={t('reasonHint')}>
        <Textarea
          id="deletion-reason"
          rows={2}
          maxLength={500}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          disabled={isPending}
        />
      </Field>
      <Field label={t('confirmField', { clinic: clinicName })} htmlFor="deletion-confirm">
        <Input
          id="deletion-confirm"
          autoComplete="off"
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          disabled={isPending}
        />
      </Field>

      <div className="flex justify-end">
        <Button type="button" variant="danger" disabled={!confirmed || isPending} onClick={request}>
          {isPending ? <Spinner /> : <Trash2 className="h-4 w-4" aria-hidden />}
          {t('button')}
        </Button>
      </div>
    </div>
  );
}
