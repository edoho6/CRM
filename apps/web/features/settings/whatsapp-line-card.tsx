'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Card, CardBody, CardHeader, CardTitle, Field, LtrInput, useToast } from '@clinic/ui';
import { useRouter } from '@clinic/i18n/navigation';
import { saveWhatsappLine } from './actions';

/**
 * The clinic's WhatsApp line: the number as verified with the sending
 * service, which incoming messages are matched to and replies go out from,
 * and the approved template that opens a conversation with a patient who
 * has not written for a day.
 */
export function WhatsappLineCard({
  number,
  openerTemplateId,
  openerText,
}: {
  number: string | null;
  openerTemplateId: string | null;
  /** The wording to submit as the opener template, shown so it can be copied. */
  openerText: string;
}) {
  const t = useTranslations('settings.messaging.whatsapp');
  const tc = useTranslations('common');
  const router = useRouter();
  const { toast } = useToast();
  const [value, setValue] = useState(number ?? '');
  const [opener, setOpener] = useState(openerTemplateId ?? '');
  const [invalid, setInvalid] = useState(false);
  const [isPending, startTransition] = useTransition();

  function save() {
    setInvalid(false);
    startTransition(async () => {
      const result = await saveWhatsappLine({ whatsapp_number: value, opener_template_id: opener });
      if (!result.ok) {
        setInvalid(true);
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
        <Field label={t('number')} htmlFor="whatsapp_number" hint={t('numberHint')} error={invalid ? t('invalid') : undefined}>
          <LtrInput
            id="whatsapp_number"
            type="tel"
            value={value}
            placeholder="972501234567"
            onChange={(event) => setValue(event.target.value)}
          />
        </Field>
        <Field label={t('opener')} htmlFor="whatsapp_opener" hint={t('openerHint', { text: openerText })}>
          <LtrInput id="whatsapp_opener" value={opener} maxLength={80} onChange={(event) => setOpener(event.target.value)} />
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
