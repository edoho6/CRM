'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import {
  Alert,
  Button,
  Card,
  CardBody,
  Checkbox,
  Field,
  FieldGrid,
  LtrInput,
  Select,
  Spinner,
} from '@clinic/ui';
import type { ClinicPaymentSettings } from '@clinic/db/types';
import { saveGrowSettings } from './actions';

export function GrowSettingsForm({
  settings,
  webhookUrl,
}: {
  settings: ClinicPaymentSettings | null;
  webhookUrl: string;
}) {
  const t = useTranslations('billing.settings');
  const tc = useTranslations('common');
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle');

  const [environment, setEnvironment] = useState<'sandbox' | 'production'>(
    settings?.environment ?? 'sandbox',
  );
  const [userId, setUserId] = useState(settings?.grow_user_id ?? '');
  const [pageCode, setPageCode] = useState(settings?.grow_page_code ?? '');
  const [isActive, setIsActive] = useState(settings?.is_active ?? false);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setStatus('idle');
    startTransition(async () => {
      const result = await saveGrowSettings({
        environment,
        growUserId: userId,
        growPageCode: pageCode,
        isActive,
      });
      setStatus(result.ok ? 'saved' : 'error');
    });
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-4">
      {status === 'saved' ? <Alert tone="success">{t('saved')}</Alert> : null}
      {status === 'error' ? <Alert tone="danger">{tc('errorGeneric')}</Alert> : null}

      <Card>
        <CardBody className="space-y-4">
          <p className="text-sm text-ink-600">{t('intro')}</p>

          <FieldGrid>
            <Field label={t('environment')} htmlFor="environment">
              <Select
                id="environment"
                value={environment}
                onChange={(event) => setEnvironment(event.target.value as 'sandbox' | 'production')}
                disabled={isPending}
              >
                <option value="sandbox">{t('sandbox')}</option>
                <option value="production">{t('production')}</option>
              </Select>
            </Field>
            <Field label={t('userId')} htmlFor="grow_user_id">
              <LtrInput
                id="grow_user_id"
                value={userId}
                onChange={(event) => setUserId(event.target.value)}
                disabled={isPending}
                autoComplete="off"
              />
            </Field>
            <Field label={t('pageCode')} htmlFor="grow_page_code">
              <LtrInput
                id="grow_page_code"
                value={pageCode}
                onChange={(event) => setPageCode(event.target.value)}
                disabled={isPending}
                autoComplete="off"
              />
            </Field>
          </FieldGrid>

          <label className="flex items-center gap-2 text-sm text-ink-700">
            <Checkbox
              checked={isActive}
              onChange={(event) => setIsActive(event.target.checked)}
              disabled={isPending}
            />
            {t('isActive')}
          </label>
        </CardBody>
      </Card>

      <Alert tone="info" title={t('webhookTitle')}>
        <p className="mt-1 font-mono text-xs break-all" dir="ltr">
          {webhookUrl}
        </p>
        <p className="mt-2">{t('webhookBody')}</p>
      </Alert>

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? <Spinner /> : null}
          {isPending ? tc('saving') : tc('save')}
        </Button>
      </div>
    </form>
  );
}
