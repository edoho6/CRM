'use client';

import { useState, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Field,
  FieldGrid,
  LtrInput,
  Textarea,
  Toggle,
  useToast,
} from '@clinic/ui';
import type { ClinicAutomation, MessageChannel } from '@clinic/db/types';
import { automationDefault, fillAutomationTemplate, isMarketingAutomation, type AutomationKind, type Locale } from '@clinic/domain';
import { useRouter } from '@clinic/i18n/navigation';
import { saveAutomation } from './actions';

/**
 * One automated message, as its owner sets it.
 *
 * A switch, its timing, its wording with a preview that fills the blanks
 * with an example — the same shape as the reminder's card above it, so the
 * fourth one reads like the first. The fields a kind does not use are not
 * shown: a birthday greeting has an hour, not a delay.
 *
 * Three of the four are advertising in the law's eyes, and the card says
 * so where the switch is: they go only to a patient who agreed to hear from
 * the clinic, and each ends with a way out.
 */
export function AutomationCard({
  kind,
  row,
  clinicName,
  channel,
  bookingEnabled,
  reviewUrlSet,
}: {
  kind: AutomationKind;
  row: ClinicAutomation | null;
  clinicName: string;
  channel: MessageChannel;
  /** The booking page is on: the nudge can carry its link. */
  bookingEnabled: boolean;
  /** The clinic's Google page is set: the review request has somewhere to point. */
  reviewUrlSet: boolean;
}) {
  const t = useTranslations('settings.messaging');
  const tc = useTranslations('common');
  const locale = useLocale() as Locale;
  const router = useRouter();
  const { toast } = useToast();
  const [on, setOn] = useState(row?.enabled ?? false);
  const [delayHours, setDelayHours] = useState(String(row?.delay_hours ?? 24));
  const [inactiveDays, setInactiveDays] = useState(String(row?.inactive_days ?? 90));
  const [sendHour, setSendHour] = useState(String(row?.send_hour ?? 10));
  const [template, setTemplate] = useState(row?.template ?? '');
  const [templateId, setTemplateId] = useState(row?.whatsapp_template_id ?? '');
  const [isPending, startTransition] = useTransition();

  const marketing = isMarketingAutomation(kind);
  const usesDelay = kind === 'treatment_followup' || kind === 'review_request';
  const usesHour = kind === 'birthday' || kind === 'inactive_reengage';

  // The built-in wording lives in the domain package, held to the database's
  // by a test, so this preview and the message that goes out cannot drift.
  const preview = fillAutomationTemplate(kind, template, locale, {
    name: t('sampleName'),
    clinic: clinicName,
    link: 'https://g.page/…',
    booking_link: bookingEnabled ? 'https://…/book/…' : '',
    unsubscribe: 'https://…/unsubscribe/…',
  });

  function save() {
    startTransition(async () => {
      const result = await saveAutomation(kind, {
        enabled: on,
        delay_hours: delayHours,
        inactive_days: inactiveDays,
        send_hour: sendHour,
        template,
        whatsapp_template_id: templateId,
      });
      if (!result.ok) {
        toast({ tone: 'danger', title: tc('errorGeneric') });
        return;
      }
      toast({ tone: 'success', title: tc('saved') });
      router.refresh();
    });
  }

  const prefix = `automation_${kind}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t(`kinds.${kind}.title`)}</CardTitle>
      </CardHeader>
      <CardBody className="space-y-4">
        <p className="text-sm text-ink-600">{t(`kinds.${kind}.intro`)}</p>
        {marketing ? <p className="text-xs text-ink-600">{t('consentNote')}</p> : null}
        {kind === 'review_request' && on && !reviewUrlSet ? (
          <Alert tone="warning">{t('kinds.review_request.noUrl')}</Alert>
        ) : null}

        <Toggle checked={on} onChange={setOn} label={t('enabled')} showLabel />

        <FieldGrid>
          {usesDelay ? (
            <Field label={t(`kinds.${kind}.timing`)} htmlFor={`${prefix}_delay`}>
              <LtrInput
                id={`${prefix}_delay`}
                type="number"
                min={1}
                max={720}
                value={delayHours}
                disabled={!on}
                onChange={(event) => setDelayHours(event.target.value)}
              />
            </Field>
          ) : null}
          {kind === 'inactive_reengage' ? (
            <Field label={t('kinds.inactive_reengage.days')} htmlFor={`${prefix}_days`}>
              <LtrInput
                id={`${prefix}_days`}
                type="number"
                min={14}
                max={730}
                value={inactiveDays}
                disabled={!on}
                onChange={(event) => setInactiveDays(event.target.value)}
              />
            </Field>
          ) : null}
          {usesHour ? (
            <Field label={t(`kinds.${kind}.timing`)} htmlFor={`${prefix}_hour`} hint={t('hourHint')}>
              <LtrInput
                id={`${prefix}_hour`}
                type="number"
                min={6}
                max={20}
                value={sendHour}
                disabled={!on}
                onChange={(event) => setSendHour(event.target.value)}
              />
            </Field>
          ) : null}
        </FieldGrid>

        <Field label={t('template')} htmlFor={`${prefix}_template`} hint={t(`kinds.${kind}.placeholders`)}>
          <Textarea
            id={`${prefix}_template`}
            rows={3}
            value={template}
            placeholder={automationDefault(kind, locale, { hasBookingLink: bookingEnabled })}
            onChange={(event) => setTemplate(event.target.value)}
          />
        </Field>
        <div className="rounded-lg border border-ink-200 bg-ink-50 p-3">
          <p className="text-xs font-medium text-ink-600">{t('preview')}</p>
          <p className="mt-1 text-sm whitespace-pre-wrap text-ink-800" dir="auto">
            {preview}
          </p>
        </div>

        {/* A message the clinic starts on WhatsApp must be a template Meta
            approved; the id comes from the sending service once it is. */}
        {channel === 'whatsapp' ? (
          <Field label={t('whatsappTemplateId')} htmlFor={`${prefix}_wa`} hint={t('whatsappTemplateHint')}>
            <LtrInput
              id={`${prefix}_wa`}
              value={templateId}
              maxLength={80}
              onChange={(event) => setTemplateId(event.target.value)}
            />
          </Field>
        ) : null}

        <div className="flex justify-end">
          <Button type="button" size="sm" disabled={isPending} onClick={save}>
            {tc('save')}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
