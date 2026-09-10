'use client';

import { useEffect, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Copy, ExternalLink } from 'lucide-react';
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
import { useLocale } from 'next-intl';
import { useRouter } from '@clinic/i18n/navigation';
import { saveBookingSettings } from './actions';

/**
 * The public booking page, as its owner sees it.
 *
 * One switch, one handle, and the words at the top of the page — theirs to
 * write. The link is shown whole and copied with a click, because the whole
 * point of the page is that it gets sent.
 *
 * Verification by SMS is offered but explained: it needs a sending service,
 * and until one is connected a code would be queued and never arrive, so the
 * switch says so rather than quietly locking every patient out.
 */
export function BookingSettingsForm({
  enabled,
  slug,
  intro,
  leadHours,
  horizonDays,
  verifySms,
  bookableTypes,
}: {
  enabled: boolean;
  slug: string | null;
  intro: string | null;
  leadHours: number;
  horizonDays: number;
  verifySms: boolean;
  /** How many treatment types are open to online booking. Zero is a page with nothing on it. */
  bookableTypes: number;
}) {
  const t = useTranslations('settings.booking');
  const tc = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();
  const [on, setOn] = useState(enabled);
  const [handle, setHandle] = useState(slug ?? '');
  const [text, setText] = useState(intro ?? '');
  const [lead, setLead] = useState(String(leadHours));
  const [horizon, setHorizon] = useState(String(horizonDays));
  const [verify, setVerify] = useState(verifySms);
  const [error, setError] = useState<string | null>(null);
  const [origin, setOrigin] = useState('');
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const url = handle && origin ? `${origin}/${locale}/book/${handle}` : '';

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await saveBookingSettings({
        booking_enabled: on,
        booking_slug: handle,
        booking_intro: text,
        booking_lead_hours: lead,
        booking_horizon_days: horizon,
        booking_verify_sms: verify,
      });
      if (!result.ok) {
        setError(result.error.key === 'errors.slugTaken' ? t('slugTaken') : t('invalid'));
        return;
      }
      toast({ tone: 'success', title: tc('saved') });
      router.refresh();
    });
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      toast({ tone: 'success', title: t('copied') });
    } catch {
      toast({ tone: 'danger', title: t('copyFailed') });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
      </CardHeader>
      <CardBody className="space-y-4">
        <p className="text-sm text-ink-600">{t('intro')}</p>
        {error ? <Alert tone="danger">{error}</Alert> : null}
        {on && bookableTypes === 0 ? <Alert tone="warning">{t('noTypes')}</Alert> : null}

        <Toggle checked={on} onChange={setOn} label={t('enabled')} showLabel />

        <Field label={t('slug')} htmlFor="booking_slug" hint={t('slugHint')} required>
          <LtrInput
            id="booking_slug"
            value={handle}
            onChange={(event) =>
              setHandle(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
            }
            placeholder="my-clinic"
            maxLength={40}
          />
        </Field>

        {url ? (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-ink-200 bg-ink-50 p-3">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              dir="ltr"
              className="min-w-0 flex-1 truncate text-sm text-jade-800 underline-offset-2 hover:underline"
            >
              {url}
            </a>
            <Button type="button" size="sm" variant="secondary" onClick={copy}>
              <Copy className="h-4 w-4" aria-hidden />
              {t('copy')}
            </Button>
            <Button asChild size="sm" variant="ghost">
              <a href={url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" aria-hidden />
                {t('open')}
              </a>
            </Button>
          </div>
        ) : null}

        <Field label={t('pageText')} htmlFor="booking_intro" hint={t('pageTextHint')}>
          <Textarea
            id="booking_intro"
            rows={4}
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
        </Field>

        <FieldGrid>
          <Field label={t('leadHours')} htmlFor="booking_lead" hint={t('leadHoursHint')}>
            <LtrInput
              id="booking_lead"
              type="number"
              min={0}
              max={720}
              value={lead}
              onChange={(event) => setLead(event.target.value)}
            />
          </Field>
          <Field label={t('horizonDays')} htmlFor="booking_horizon" hint={t('horizonDaysHint')}>
            <LtrInput
              id="booking_horizon"
              type="number"
              min={1}
              max={365}
              value={horizon}
              onChange={(event) => setHorizon(event.target.value)}
            />
          </Field>
        </FieldGrid>

        <div className="space-y-1">
          <Toggle checked={verify} onChange={setVerify} label={t('verifySms')} showLabel />
          <p className="text-xs text-ink-500">{t('verifySmsHint')}</p>
        </div>

        <div className="flex justify-end">
          <Button type="button" size="sm" disabled={isPending || !handle} onClick={save}>
            {tc('save')}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
