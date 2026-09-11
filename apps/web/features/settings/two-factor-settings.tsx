'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { ShieldCheck, ShieldOff } from 'lucide-react';
import { Alert, Badge, Button, Field, LtrInput, Spinner, useConfirm, useToast } from '@clinic/ui';
import { useRouter } from '@clinic/i18n/navigation';
import { confirmTwoFactorEnrollment, disableTwoFactor, startTwoFactorEnrollment } from './two-factor-actions';

/**
 * The second factor, in the personal area.
 *
 * Off: one button starts the enrolment and shows the QR code, the secret
 * beside it for an app that cannot scan, and a field for the first code.
 * On: a badge that says so, and the way to switch it off. The person is told
 * plainly what losing the phone means, because with a second factor there
 * is no "forgot my password" for the code.
 */
export function TwoFactorSettings({ enabled, factorId }: { enabled: boolean; factorId: string | null }) {
  const t = useTranslations('account.twoFactor');
  const tc = useTranslations('common');
  const { toast } = useToast();
  const confirm = useConfirm();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [enrolment, setEnrolment] = useState<{ factorId: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  function begin() {
    setError(null);
    startTransition(async () => {
      const result = await startTwoFactorEnrollment();
      if (!result.ok) {
        setError(t('failed'));
        return;
      }
      setEnrolment(result.data);
      setCode('');
    });
  }

  function finish() {
    if (!enrolment) return;
    setError(null);
    startTransition(async () => {
      const result = await confirmTwoFactorEnrollment(enrolment.factorId, code);
      if (!result.ok) {
        setError(result.error.key === 'invalid_code' ? t('invalidCode') : t('failed'));
        return;
      }
      setEnrolment(null);
      setCode('');
      toast({ tone: 'success', title: t('confirmed') });
      router.refresh();
    });
  }

  async function disable() {
    if (!factorId) return;
    const confirmed = await confirm({ title: t('disable'), body: t('disableBody'), confirmLabel: t('disable') });
    if (!confirmed) return;
    setError(null);
    startTransition(async () => {
      const result = await disableTwoFactor(factorId);
      if (!result.ok) {
        setError(t('failed'));
        return;
      }
      toast({ tone: 'success', title: t('disabledToast') });
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-700">{t('body')}</p>
      {error ? <Alert tone="danger">{error}</Alert> : null}

      {enabled ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Badge tone="success">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
              {t('enabled')}
            </span>
          </Badge>
          <Button type="button" variant="secondary" onClick={disable} disabled={isPending}>
            {isPending ? <Spinner /> : <ShieldOff className="h-4 w-4" aria-hidden />}
            {t('disable')}
          </Button>
        </div>
      ) : enrolment ? (
        <div className="space-y-4">
          <p className="text-sm text-ink-700">{t('scan')}</p>
          <div className="flex flex-wrap items-start gap-4">
            {/* The QR code comes from the authentication service as an image; it
                is the secret drawn, so it gets the same alt as the secret's label. */}
            <img src={enrolment.qr} alt={t('qrAlt')} width={176} height={176} className="rounded-lg border border-ink-200 bg-white p-2" />
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-xs font-medium text-ink-600">{t('secretLabel')}</p>
              <p dir="ltr" className="break-all rounded-md border border-ink-200 bg-ink-50 px-2 py-1.5 font-mono text-sm text-ink-900">
                {enrolment.secret}
              </p>
              <p className="text-xs text-ink-500">{t('secretHint')}</p>
            </div>
          </div>
          <Field label={t('code')} htmlFor="two_factor_code" required>
            <LtrInput
              id="two_factor_code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(event) => setCode(event.target.value)}
              disabled={isPending}
              className="max-w-[10rem] text-center text-lg tracking-[0.4em]"
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={finish} disabled={isPending || !/^\d{6}$/.test(code)}>
              {isPending ? <Spinner /> : <ShieldCheck className="h-4 w-4" aria-hidden />}
              {t('confirm')}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setEnrolment(null)} disabled={isPending}>
              {tc('cancel')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Badge tone="muted">{t('disabled')}</Badge>
          <Button type="button" onClick={begin} disabled={isPending}>
            {isPending ? <Spinner /> : <ShieldCheck className="h-4 w-4" aria-hidden />}
            {t('enable')}
          </Button>
        </div>
      )}

      <p className="text-xs text-ink-500">{t('lostDevice')}</p>
    </div>
  );
}
