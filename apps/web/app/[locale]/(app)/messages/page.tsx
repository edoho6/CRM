import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PageBody } from '@clinic/ui';
import { PageHeader } from '@/components/app-shell';
import { getClinicScope } from '@/lib/session';
import { MessageQueue, type QueueRow } from '@/features/messages/message-queue';

const SELECT =
  '*, patient:patients(id, full_name), appointment:appointments(id, start_at)';

/**
 * What is waiting to be sent, and what went.
 *
 * Reminders are queued by the hour from the diary; task alerts by the minute.
 * The queue is what a practitioner works through in the evening until a
 * sending service takes it over — and the history is the answer to "did she
 * get the reminder".
 */
export default async function MessagesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('messages');

  const scope = await getClinicScope();
  if (!scope) return null;

  const monthAgo = new Date();
  monthAgo.setDate(monthAgo.getDate() - 30);

  const [queuedResult, historyResult] = await Promise.all([
    scope.supabase
      .from('message_log')
      .select(SELECT)
      .eq('status', 'queued')
      .order('created_at', { ascending: true })
      .limit(200)
      .returns<QueueRow[]>(),
    scope.supabase
      .from('message_log')
      .select(SELECT)
      .neq('status', 'queued')
      .gte('created_at', monthAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(200)
      .returns<QueueRow[]>(),
  ]);

  return (
    <>
      <PageHeader title={t('title')} description={t('subtitle')} />
      <PageBody width="narrow">
        <MessageQueue queued={queuedResult.data ?? []} history={historyResult.data ?? []} />
      </PageBody>
    </>
  );
}
