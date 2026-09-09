'use client';

import { useEffect, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { CalendarSync, Copy, RefreshCw } from 'lucide-react';
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Collapsible,
  LtrInput,
  useConfirm,
  useToast,
} from '@clinic/ui';
import { formatDateTime } from '@clinic/i18n';
import { ensureCalendarFeed, regenerateCalendarFeed } from './actions';

/**
 * The diary on the practitioner's own phone.
 *
 * One private address that Google Calendar and the iPhone both subscribe to.
 * No sign-in with Google, no app to install: paste the link once and the
 * bookings appear alongside everything else, and keep appearing as they are
 * made. One-way, from here outwards — a booking moved on the phone does not
 * move here, and the card says so.
 *
 * The address is a secret. Whoever has it sees the diary, names included, so
 * there is a button to change it, and the instructions say to treat it like a
 * password.
 */
export function CalendarFeedCard({
  token,
  lastFetchedAt,
}: {
  token: string | null;
  lastFetchedAt: string | null;
}) {
  const t = useTranslations('schedule.feed');
  const tc = useTranslations('common');
  const confirm = useConfirm();
  const { toast } = useToast();
  const [current, setCurrent] = useState(token);
  const [origin, setOrigin] = useState('');
  const [isPending, startTransition] = useTransition();

  // The host is only known in the browser, and a URL rendered on the server
  // would name whatever machine built the page.
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const url = current && origin ? `${origin}/api/calendar/${current}` : '';

  function create() {
    startTransition(async () => {
      const result = await ensureCalendarFeed();
      if (!result.ok) {
        toast({ tone: 'danger', title: tc('errorGeneric') });
        return;
      }
      setCurrent(result.data.token);
    });
  }

  async function regenerate() {
    const confirmed = await confirm({
      title: t('regenerateTitle'),
      body: t('regenerateBody'),
      confirmLabel: t('regenerate'),
      destructive: true,
    });
    if (!confirmed) return;
    startTransition(async () => {
      const result = await regenerateCalendarFeed();
      if (!result.ok) {
        toast({ tone: 'danger', title: tc('errorGeneric') });
        return;
      }
      setCurrent(result.data.token);
      toast({ tone: 'success', title: t('regenerated') });
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
        <CardTitle>
          <span className="inline-flex items-center gap-2">
            <CalendarSync className="h-4 w-4 text-ink-500" aria-hidden />
            {t('title')}
          </span>
        </CardTitle>
      </CardHeader>
      <CardBody className="space-y-4">
        <p className="text-sm text-ink-600">{t('intro')}</p>

        {current ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <LtrInput
                readOnly
                value={url}
                aria-label={t('url')}
                onFocus={(event) => event.currentTarget.select()}
                className="min-w-64 flex-1 text-xs"
              />
              <Button type="button" size="sm" variant="secondary" onClick={copy} disabled={!url}>
                <Copy className="h-4 w-4" aria-hidden />
                {t('copy')}
              </Button>
            </div>
            <Alert tone="warning">{t('secretWarning')}</Alert>
            {lastFetchedAt ? (
              <p className="text-xs text-ink-500">
                {t('lastFetched')} <span dir="ltr">{formatDateTime(lastFetchedAt)}</span>
              </p>
            ) : (
              <p className="text-xs text-ink-500">{t('neverFetched')}</p>
            )}

            <Collapsible title={t('google.title')}>
              <ol className="list-decimal space-y-1 ps-5 text-sm text-ink-700">
                <li>{t('google.step1')}</li>
                <li>{t('google.step2')}</li>
                <li>{t('google.step3')}</li>
              </ol>
              <p className="mt-2 text-xs text-ink-500">{t('google.note')}</p>
            </Collapsible>

            <Collapsible title={t('iphone.title')}>
              <ol className="list-decimal space-y-1 ps-5 text-sm text-ink-700">
                <li>{t('iphone.step1')}</li>
                <li>{t('iphone.step2')}</li>
                <li>{t('iphone.step3')}</li>
              </ol>
              <p className="mt-2 text-xs text-ink-500">{t('iphone.note')}</p>
            </Collapsible>

            <div className="flex justify-end">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={isPending}
                onClick={regenerate}
                className="text-ink-600"
              >
                <RefreshCw className="h-4 w-4" aria-hidden />
                {t('regenerate')}
              </Button>
            </div>
          </>
        ) : (
          <Button type="button" size="sm" disabled={isPending} onClick={create}>
            <CalendarSync className="h-4 w-4" aria-hidden />
            {t('create')}
          </Button>
        )}
      </CardBody>
    </Card>
  );
}
