'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Field,
  LtrInput,
  Toggle,
  useToast,
} from '@clinic/ui';
import { useRouter } from '@clinic/i18n/navigation';
import { savePatientChangesSettings } from './actions';

/**
 * Whether the reminder link lets a patient move or cancel (migration 75).
 *
 * Its own card rather than a switch on the booking page: cancelling needs no
 * booking page, and a clinic without one should not have to pick a handle to
 * allow it. Moving to another hour does need the page — the free hours are
 * the page's — and the card says so when the page is off.
 */
export function PatientChangesForm({
  enabled,
  noticeHours,
  bookingEnabled,
}: {
  enabled: boolean;
  noticeHours: number;
  bookingEnabled: boolean;
}) {
  const t = useTranslations('settings.booking.changes');
  const tc = useTranslations('common');
  const router = useRouter();
  const { toast } = useToast();
  const [on, setOn] = useState(enabled);
  const [notice, setNotice] = useState(String(noticeHours));
  const [failed, setFailed] = useState(false);
  const [isPending, startTransition] = useTransition();

  function save() {
    setFailed(false);
    startTransition(async () => {
      const result = await savePatientChangesSettings({
        patient_changes_enabled: on,
        patient_changes_notice_hours: notice,
      });
      if (!result.ok) {
        setFailed(true);
        return;
      }
      toast({ tone: 'success', title: tc('saved') });
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
      </CardHeader>
      <CardBody className="space-y-4">
        <p className="text-sm text-ink-600">{t('intro')}</p>
        {failed ? <Alert tone="danger">{t('invalid')}</Alert> : null}
        {on && !bookingEnabled ? <Alert tone="info">{t('cancelOnly')}</Alert> : null}

        <Toggle checked={on} onChange={setOn} label={t('enabled')} showLabel />

        <Field
          label={t('noticeHours')}
          htmlFor="patient_changes_notice"
          hint={t('noticeHoursHint')}
        >
          <LtrInput
            id="patient_changes_notice"
            type="number"
            min={0}
            max={168}
            value={notice}
            onChange={(event) => setNotice(event.target.value)}
          />
        </Field>

        <div className="flex justify-end">
          <Button type="button" size="sm" disabled={isPending} onClick={save}>
            {tc('save')}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
