import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PageBody } from '@clinic/ui';
import type { Locale } from '@clinic/domain';
import { redirect } from '@clinic/i18n/navigation';
import { PageHeader } from '@/components/app-shell';
import { getClinicScope } from '@/lib/session';
import { listConversations, loadConversation, openConversationForPatient } from '@/features/whatsapp/actions';
import { InboxWorkspace } from '@/features/whatsapp/inbox-workspace';
import { MessagesNav } from '@/features/whatsapp/messages-nav';
import type { PatientOption } from '@/features/whatsapp/types';
import { pageTitle } from '@/lib/page-title';

export const generateMetadata = pageTitle('messages', 'title');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * WhatsApp, inside the system. The page brings the threads with it, and the
 * one named in the address (`?c=`) with its messages, so the first paint is
 * the conversation and not a spinner. `?patient=` — the button in a file —
 * opens or makes that patient's thread and lands on it.
 */
export default async function MessagesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ c?: string | string[]; patient?: string | string[] }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const scope = await getClinicScope();
  if (!scope) return null;
  const t = await getTranslations('messages');
  const query = await searchParams;

  const patientParam = typeof query.patient === 'string' ? query.patient : null;
  if (patientParam && UUID.test(patientParam)) {
    const opened = await openConversationForPatient(patientParam);
    if (opened.ok) {
      redirect({ href: { pathname: '/messages', query: { c: opened.data.id } }, locale: locale as Locale });
    }
  }

  const [list, { data: patientRows }, { data: opener }] = await Promise.all([
    listConversations(),
    scope.supabase
      .from('patients')
      .select('id, full_name, phone')
      .eq('is_active', true)
      .order('last_name')
      .order('first_name')
      .limit(2000)
      .returns<{ id: string; full_name: string; phone: string | null }[]>(),
    scope.supabase
      .from('clinic_automations')
      .select('whatsapp_template_id')
      .eq('kind', 'conversation_opener')
      .maybeSingle<{ whatsapp_template_id: string | null }>(),
  ]);
  const conversations = list.ok ? list.data : [];
  const wanted = typeof query.c === 'string' ? query.c : null;
  const initialActiveId = wanted && conversations.some((row) => row.id === wanted) ? wanted : null;
  const thread = initialActiveId ? await loadConversation(initialActiveId) : null;
  const patients: PatientOption[] = (patientRows ?? []).map((row) => ({ id: row.id, fullName: row.full_name, phone: row.phone }));

  return (
    <>
      <PageHeader title={t('title')} description={t('inbox.subtitle')} below={<MessagesNav current="inbox" />} />
      <PageBody width="wide">
        <InboxWorkspace
          lineConfigured={Boolean(scope.context.clinic.whatsapp_number)}
          openerConfigured={Boolean(opener?.whatsapp_template_id?.trim())}
          conversations={conversations}
          initialActiveId={initialActiveId}
          initialMessages={thread?.ok ? thread.data.messages : []}
          patients={patients}
        />
      </PageBody>
    </>
  );
}
