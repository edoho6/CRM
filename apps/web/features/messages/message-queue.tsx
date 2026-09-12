'use client';

import { useEffect, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Bell, Check, Copy, Mail, MessageCircle, RefreshCw, Smartphone, X } from 'lucide-react';
import { Badge, Button, Card, CardBody, Collapsible, EmptyState, cn, useToast } from '@clinic/ui';
import { formatDateTime } from '@clinic/i18n';
import { Link, useRouter } from '@clinic/i18n/navigation';
import { INVOICE_STATUS_TONES } from '@clinic/domain';
import type { MessageLogEntry } from '@clinic/db/types';
import { whatsappNumber } from '@/components/phone-actions';
import { markMessageSent, refreshMessageQueue, skipMessage } from './actions';

export type QueueRow = MessageLogEntry & {
  patient: { id: string; full_name: string } | null;
  appointment: { id: string; start_at: string } | null;
};

const CHANNEL_ICONS = { sms: Smartphone, whatsapp: MessageCircle, email: Mail, push: Bell } as const;

const STATUS_TONES = {
  queued: 'warning',
  sent: 'success',
  failed: 'danger',
  skipped: 'muted',
} as const;

/**
 * The messages waiting to go, and the ones that went.
 *
 * Until a sending service is connected, the queue is a list of things to send
 * this evening: each row opens WhatsApp with the text ready, and the tick
 * says it went. Once a service is connected the same rows go out on their
 * own and only the history is left to read. Either way the screen is the
 * same, which is the point — nothing changes for the person when the wiring
 * does.
 */
export function MessageQueue({ queued, history }: { queued: QueueRow[]; history: QueueRow[] }) {
  const t = useTranslations('messages');
  const tc = useTranslations('common');
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState<Set<string>>(new Set());

  // The queue is filled on the hour. Opening this screen fills it now, so a
  // booking made twenty minutes ago is not missing from tonight's list.
  useEffect(() => {
    let cancelled = false;
    void refreshMessageQueue().then((result) => {
      if (!cancelled && result.ok && result.data.queued > 0) router.refresh();
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function refresh() {
    startTransition(async () => {
      const result = await refreshMessageQueue();
      if (!result.ok) {
        toast({ tone: 'danger', title: tc('errorGeneric') });
        return;
      }
      toast({ tone: 'success', title: t('refreshed', { count: result.data.queued }) });
      router.refresh();
    });
  }

  function sent(row: QueueRow) {
    setDone((current) => new Set(current).add(row.id));
    startTransition(async () => {
      const result = await markMessageSent(row.id);
      if (!result.ok) {
        setDone((current) => {
          const next = new Set(current);
          next.delete(row.id);
          return next;
        });
        toast({ tone: 'danger', title: tc('errorGeneric') });
        return;
      }
      router.refresh();
    });
  }

  function skip(row: QueueRow) {
    startTransition(async () => {
      const result = await skipMessage(row.id);
      if (!result.ok) {
        toast({ tone: 'danger', title: tc('errorGeneric') });
        return;
      }
      router.refresh();
    });
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast({ tone: 'success', title: t('copied') });
    } catch {
      toast({ tone: 'danger', title: t('copyFailed') });
    }
  }

  const waiting = queued.filter((row) => !done.has(row.id));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-ink-600">{t('queueIntro')}</p>
        <Button type="button" size="sm" variant="secondary" disabled={isPending} onClick={refresh}>
          <RefreshCw className="h-4 w-4" aria-hidden />
          {t('refresh')}
        </Button>
      </div>

      {waiting.length === 0 ? (
        <EmptyState title={t('queueEmpty')} description={t('queueEmptyBody')} />
      ) : (
        <ul className="space-y-2">
          {waiting.map((row) => {
            const Icon = CHANNEL_ICONS[row.channel];
            const wa =
              row.channel !== 'email' && row.recipient ? whatsappNumber(row.recipient) : null;
            return (
              <li key={row.id}>
                <Card>
                  <CardBody className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <Icon className="h-4 w-4 text-ink-500" aria-hidden />
                      <span className="sr-only">{t(`channels.${row.channel}`)}</span>
                      {row.patient ? (
                        <Link
                          href={`/patients/${row.patient.id}`}
                          className="font-medium text-ink-900 underline-offset-2 hover:underline"
                        >
                          {row.patient.full_name}
                        </Link>
                      ) : (
                        <span className="font-medium text-ink-900">{t('toMe')}</span>
                      )}
                      {/* A push row's recipient is a user id, not a number: nothing to show. */}
                      {row.recipient && row.channel !== 'push' ? (
                        <span dir="ltr" className="text-ink-600 tabular-nums">
                          {row.recipient}
                        </span>
                      ) : null}
                      {row.channel === 'push' ? (
                        <span className="text-xs text-ink-500">{t('pushQueued')}</span>
                      ) : null}
                      {row.appointment ? (
                        <span className="text-xs text-ink-500">
                          {t('forAppointment')}{' '}
                          <span dir="ltr">{formatDateTime(new Date(row.appointment.start_at))}</span>
                        </span>
                      ) : null}
                    </div>
                    <p className="whitespace-pre-wrap text-sm text-ink-800" dir="auto">
                      {row.body}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {wa ? (
                        <Button asChild size="sm">
                          <a
                            href={`https://wa.me/${wa}?text=${encodeURIComponent(row.body)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <MessageCircle className="h-4 w-4" aria-hidden />
                            {t('openWhatsApp')}
                          </a>
                        </Button>
                      ) : row.channel === 'email' && row.recipient ? (
                        <Button asChild size="sm">
                          <a
                            href={`mailto:${row.recipient}?subject=${encodeURIComponent(row.subject ?? '')}&body=${encodeURIComponent(row.body)}`}
                          >
                            <Mail className="h-4 w-4" aria-hidden />
                            {t('openEmail')}
                          </a>
                        </Button>
                      ) : null}
                      <Button type="button" size="sm" variant="ghost" onClick={() => copy(row.body)}>
                        <Copy className="h-4 w-4" aria-hidden />
                        {t('copy')}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={isPending}
                        onClick={() => sent(row)}
                        className="ms-auto"
                      >
                        <Check className="h-4 w-4" aria-hidden />
                        {t('markSent')}
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-9 w-9 text-ink-500"
                        aria-label={t('skip')}
                        title={t('skip')}
                        disabled={isPending}
                        onClick={() => skip(row)}
                      >
                        <X className="h-4 w-4" aria-hidden />
                      </Button>
                    </div>
                  </CardBody>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {history.length > 0 ? (
        <Collapsible title={`${t('history')} · ${history.length}`}>
          <ul className="divide-y divide-ink-100">
            {history.map((row) => {
              const Icon = CHANNEL_ICONS[row.channel];
              return (
                <li key={row.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                  <Icon className="h-4 w-4 shrink-0 text-ink-500" aria-hidden />
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-medium text-ink-900">
                      {row.patient?.full_name ?? t('toMe')}
                    </span>
                    <span className="text-ink-500"> · </span>
                    <span className="text-ink-600" dir="auto">
                      {row.body}
                    </span>
                  </span>
                  <span dir="ltr" className={cn('text-xs tabular-nums text-ink-500')}>
                    {formatDateTime(new Date(row.sent_at ?? row.created_at))}
                  </span>
                  <Badge tone={STATUS_TONES[row.status]}>{t(`status.${row.status}`)}</Badge>
                </li>
              );
            })}
          </ul>
        </Collapsible>
      ) : null}
    </div>
  );
}

// Keeps the shared tone dictionary's import from being tree-shaken into a lint
// complaint if the invoice tones ever move here; harmless otherwise.
void INVOICE_STATUS_TONES;
