'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Field,
  FieldGrid,
  LtrInput,
  Select,
  Textarea,
  Toggle,
  useToast,
} from '@clinic/ui';
import { useRouter } from '@clinic/i18n/navigation';
import type { MessageChannel } from '@clinic/db/types';
import { fillReminderTemplate } from '@/features/appointments/confirmation';
import { saveReminderSettings } from './actions';

/**
 * How the clinic reminds people.
 *
 * Whether at all, how long before, through which channel, and in what words —
 * with a preview underneath that fills the blanks with an example, so what is
 * being edited is the message and not a puzzle about curly braces. Empty
 * wording means the built-in text, in the patient's own language.
 *
 * The reminders are queued by the hour, and until a sending service is
 * connected they wait on the Messages screen to be sent by hand — which the
 * hint under the channel says plainly.
 */
export function ReminderTemplateForm({
  template,
  enabled,
  hoursBefore,
  channel,
  clinicName,
}: {
  template: string | null;
  enabled: boolean;
  hoursBefore: number;
  channel: MessageChannel;
  clinicName: string;
}) {
  const t = useTranslations('settings.reminders');
  const tReminder = useTranslations('appointments.reminder');
  const tc = useTranslations('common');
  const router = useRouter();
  const { toast } = useToast();
  const [value, setValue] = useState(template ?? '');
  const [on, setOn] = useState(enabled);
  const [hours, setHours] = useState(String(hoursBefore));
  const [via, setVia] = useState<MessageChannel>(channel);
  const [isPending, startTransition] = useTransition();

  // The built-in wording lives with the reminder itself, so the dialog that
  // sends it and this form that previews it can never drift apart.
  const preview = fillReminderTemplate(value.trim() || tReminder('defaultTemplate'), {
    name: t('sampleName'),
    date: '10/09/2026',
    time: '09:30',
    clinic: clinicName,
    link: 'https://…/confirm/…',
  });

  function save() {
    startTransition(async () => {
      const result = await saveReminderSettings({
        reminder_template: value,
        reminders_enabled: on,
        reminder_hours_before: hours,
        reminder_channel: via,
      });
      if (!result.ok) {
        toast({ tone: 'danger', title: tc('errorGeneric') });
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

        <Toggle checked={on} onChange={setOn} label={t('enabled')} showLabel />

        <FieldGrid>
          <Field label={t('hoursBefore')} htmlFor="reminder_hours">
            <LtrInput
              id="reminder_hours"
              type="number"
              min={1}
              max={168}
              value={hours}
              disabled={!on}
              onChange={(event) => setHours(event.target.value)}
            />
          </Field>
          <Field label={t('channel')} htmlFor="reminder_channel" hint={t('queueHint')}>
            <Select
              id="reminder_channel"
              value={via}
              disabled={!on}
              onChange={(event) => setVia(event.target.value as MessageChannel)}
            >
              <option value="whatsapp">{t('channels.whatsapp')}</option>
              <option value="sms">{t('channels.sms')}</option>
              <option value="email">{t('channels.email')}</option>
            </Select>
          </Field>
        </FieldGrid>

        <Field label={t('template')} htmlFor="reminder_template" hint={t('placeholders')}>
          <Textarea
            id="reminder_template"
            rows={4}
            value={value}
            placeholder={tReminder('defaultTemplate')}
            onChange={(event) => setValue(event.target.value)}
          />
        </Field>
        <div className="rounded-lg border border-ink-200 bg-ink-50 p-3">
          <p className="text-xs font-medium text-ink-600">{t('preview')}</p>
          <p className="mt-1 text-sm whitespace-pre-wrap text-ink-800" dir="auto">
            {preview}
          </p>
        </div>
        <div className="flex justify-end">
          <Button type="button" size="sm" disabled={isPending} onClick={save}>
            {tc('save')}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
