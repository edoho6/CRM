import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Alert, PageBody } from '@clinic/ui';
import { PageHeader } from '@/components/app-shell';
import { Pagination, pageFrom, pageRange } from '@/components/pagination';
import { getClinicScope } from '@/lib/session';
import { MessageQueue, type QueueRow } from '@/features/messages/message-queue';
import { MessagesNav } from '@/features/whatsapp/messages-nav';
import { queueHealth } from '@/features/messages/queue-health';
import { pageTitle } from '@/lib/page-title';

export const generateMetadata = pageTitle('messages', 'queueTitle');

const SELECT = '*, patient:patients(id, full_name), appointment:appointments(id, start_at)';

/**
 * What is waiting to be sent, and what went.
 *
 * Reminders are queued by the hour from the diary; task alerts by the minute.
 * The queue is what a practitioner works through in the evening until a
 * sending service takes it over — and the history is the answer to "did she
 * get the reminder".
 */
export default async function MessagesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { locale } = await params;
  const { page: pageParam } = await searchParams;
  const page = pageFrom(pageParam);
  setRequestLocale(locale);
  const t = await getTranslations('messages');

  const scope = await getClinicScope();
  if (!scope) return null;

  const monthAgo = new Date();
  monthAgo.setDate(monthAgo.getDate() - 30);

  const [queuedResult, failedResult, historyResult, lastSendResult] = await Promise.all([
    scope.supabase
      .from('message_log')
      .select(SELECT)
      .eq('status', 'queued')
      .order('created_at', { ascending: true })
      .limit(200)
      .returns<QueueRow[]>(),
    // What the sending service refused, with its reason, and what it stopped
    // half-way through (stalled — it may have gone out): the person is the
    // fallback, so these come back as cards with the manual path.
    scope.supabase
      .from('message_log')
      .select(SELECT)
      .in('status', ['failed', 'stalled'])
      .gte('created_at', monthAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(100)
      .returns<QueueRow[]>(),
    scope.supabase
      .from('message_log')
      .select(SELECT, { count: 'exact' })
      .in('status', ['sent', 'skipped'])
      .gte('created_at', monthAgo.toISOString())
      .order('created_at', { ascending: false })
      .range(...pageRange(page))
      .returns<QueueRow[]>(),
    /*
     * The last thing a sending service put through, which is the only
     * evidence that there is one. `provider` is set by whatever sent it, so a
     * message marked sent by a person at this screen does not count as a sign
     * of life — that is precisely the case the alarm must not fire on.
     */
    scope.supabase
      .from('message_log')
      .select('sent_at')
      .eq('status', 'sent')
      .not('provider', 'is', null)
      .not('sent_at', 'is', null)
      .order('sent_at', { ascending: false })
      .limit(1)
      .maybeSingle<{ sent_at: string }>(),
  ]);

  const health = queueHealth({
    oldestQueuedAt: queuedResult.data?.[0]?.created_at ?? null,
    lastAutomaticSendAt: lastSendResult.data?.sent_at ?? null,
  });

  return (
    <>
      <PageHeader
        title={t('queueTitle')}
        description={t('subtitle')}
        below={<MessagesNav current="queue" />}
      />
      <PageBody width="narrow">
        {/* The one failure this screen cannot show by itself: a sending
            service that has stopped leaves a queue that looks ordinary and a
            week that looks quiet. Said in hours rather than as a status, so
            what to do next — send the day's reminders by hand — is obvious. */}
        {health.state === 'stalled' ? (
          <Alert tone="danger">
            {t('stalled', {
              hours: Math.floor((health.silentMinutes ?? 0) / 60),
              count: queuedResult.data?.length ?? 0,
            })}
          </Alert>
        ) : null}
        <MessageQueue
          queued={queuedResult.data ?? []}
          failed={failedResult.data ?? []}
          history={historyResult.data ?? []}
        />
        <Pagination
          page={page}
          total={historyResult.count ?? null}
          shown={historyResult.data?.length ?? 0}
          pathname="/messages/queue"
          query={{}}
        />
      </PageBody>
    </>
  );
}
