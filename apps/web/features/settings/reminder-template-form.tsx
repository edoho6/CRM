'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Card, CardBody, CardHeader, CardTitle, Field, Textarea, useToast } from '@clinic/ui';
import { useRouter } from '@clinic/i18n/navigation';
import { fillReminderTemplate } from '@/features/appointments/confirmation';
import { saveReminderTemplate } from './actions';

/**
 * The words a patient gets the day before.
 *
 * One template for the clinic, with a preview underneath that fills the blanks
 * with an example, so what is being edited is the message and not a puzzle
 * about curly braces. Empty means the built-in text, in the patient's own
 * language.
 */
export function ReminderTemplateForm({
  template,
  clinicName,
}: {
  template: string | null;
  clinicName: string;
}) {
  const t = useTranslations('settings.reminders');
  const tReminder = useTranslations('appointments.reminder');
  const tc = useTranslations('common');
  const router = useRouter();
  const { toast } = useToast();
  const [value, setValue] = useState(template ?? '');
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
      const result = await saveReminderTemplate({ reminder_template: value });
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
      <CardBody className="space-y-3">
        <p className="text-sm text-ink-600">{t('intro')}</p>
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
