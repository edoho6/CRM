'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { RefreshCw, Send } from 'lucide-react';
import { Badge, Button, Card, CardBody, CardHeader, CardTitle, Field, Select, useToast } from '@clinic/ui';
import type { MessageChannel, MessageLogEntry } from '@clinic/db/types';
import { MESSAGE_STATUS_TONES, statusTone } from '@clinic/domain';
import { formatDateTime } from '@clinic/i18n';
import { Link, useRouter } from '@clinic/i18n/navigation';
import { messageErrorKey } from '@/features/messages/error-labels';
import { sendTestMessage } from './actions';

type TestChannel = Exclude<MessageChannel, 'push'>;

/** Queued this long without going means no sending service has picked it up. */
const STALE_MINUTES = 10;

/**
 * A message to yourself.
 *
 * The one way to know the sending service is connected without waiting for
 * a real reminder: queue a test to your own phone and watch it go. The card
 * shows the newest test's fate — waiting, sent, or failed with the reason in
 * words — and says plainly when it has waited too long to be anything but
 * "not connected yet".
 */
export function TestMessageCard({
  channel,
  phone,
  email,
  latest,
  renderedAt,
}: {
  channel: MessageChannel;
  phone: string | null;
  email: string | null;
  latest: MessageLogEntry | null;
  /**
   * When the server drew this page, as epoch milliseconds. Deciding "has this
   * been sitting in the queue too long" from the browser's own clock would
   * answer differently on the server and in the browser, and a message whose
   * minute falls between the two would make the two disagree.
   */
  renderedAt: number;
}) {
  const t = useTranslations('settings.messaging.test');
  const tMessages = useTranslations('messages');
  const router = useRouter();
  const { toast } = useToast();
  const [via, setVia] = useState<TestChannel>(channel === 'push' ? 'whatsapp' : channel);
  const [isPending, startTransition] = useTransition();

  const recipient = via === 'email' ? email : phone;

  function send() {
    startTransition(async () => {
      const result = await sendTestMessage(via);
      if (!result.ok) {
        toast({ tone: 'danger', title: t('failed') });
        return;
      }
      toast({ tone: 'success', title: t('queued') });
      router.refresh();
    });
  }

  const stale =
    latest?.status === 'queued' &&
    renderedAt - new Date(latest.created_at).getTime() > STALE_MINUTES * 60_000;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
      </CardHeader>
      <CardBody className="space-y-4">
        <p className="text-sm text-ink-600">{t('intro')}</p>

        <Field label={t('channel')} htmlFor="test_channel">
          <Select id="test_channel" value={via} onChange={(event) => setVia(event.target.value as TestChannel)}>
            <option value="whatsapp">{tMessages('channels.whatsapp')}</option>
            <option value="sms">{tMessages('channels.sms')}</option>
            <option value="email">{tMessages('channels.email')}</option>
          </Select>
        </Field>

        {recipient ? (
          <p className="text-sm text-ink-700">
            {t('recipient')}{' '}
            <span dir="ltr" className="font-medium tabular-nums text-ink-900">
              {recipient}
            </span>
          </p>
        ) : (
          <p className="text-sm text-amber-800">
            {via === 'email' ? t('noEmail') : t('noPhone')}{' '}
            {via !== 'email' ? (
              <Link href="/account" className="font-medium underline-offset-2 hover:underline">
                {t('toAccount')}
              </Link>
            ) : null}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button type="button" size="sm" disabled={isPending || !recipient} onClick={send}>
            <Send className="h-4 w-4" aria-hidden />
            {t('send')}
          </Button>
        </div>

        {latest ? (
          <div className="space-y-1 rounded-lg border border-ink-200 bg-ink-50 p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-ink-600">{t('latest')}</span>
              <span dir="ltr" className="text-xs tabular-nums text-ink-500">
                {formatDateTime(new Date(latest.created_at))}
              </span>
              <Badge tone={statusTone(MESSAGE_STATUS_TONES, latest.status)}>
                {tMessages(`status.${latest.status}`)}
              </Badge>
              <Button type="button" size="sm" variant="ghost" className="ms-auto" onClick={() => router.refresh()}>
                <RefreshCw className="h-4 w-4" aria-hidden />
                {t('refresh')}
              </Button>
            </div>
            {latest.status === 'failed' || latest.status === 'skipped' ? (
              <p className="text-red-700">{tMessages(`errors.${messageErrorKey(latest.error_code)}`)}</p>
            ) : null}
            {stale ? <p className="text-amber-800">{t('notConnected')}</p> : null}
            {latest.status === 'queued' && !stale ? <p className="text-ink-600">{t('waiting')}</p> : null}
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}
