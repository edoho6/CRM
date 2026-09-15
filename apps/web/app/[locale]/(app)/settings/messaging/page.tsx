import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PageBody } from '@clinic/ui';
import type { ClinicAutomation, MessageLogEntry } from '@clinic/db/types';
import { AUTOMATION_KINDS } from '@clinic/domain';
import { PageHeader } from '@/components/app-shell';
import { getClinicScope } from '@/lib/session';
import { SettingsNav } from '@/features/settings/settings-nav';
import { ReminderTemplateForm } from '@/features/settings/reminder-template-form';
import { AutomationCard } from '@/features/settings/automation-card';
import { GoogleReviewCard } from '@/features/settings/google-review-card';
import { TestMessageCard } from '@/features/settings/test-message-card';
import { WhatsappLineCard } from '@/features/settings/whatsapp-line-card';
import { pageTitle } from '@/lib/page-title';

export const generateMetadata = pageTitle('settings', 'messaging.title');

/**
 * Everything the clinic sends on its own, in one place: the reminder, the
 * four automated messages, the Google page the review request points to,
 * and a test to your own phone that says whether the sending service is
 * connected at all.
 */
export default async function MessagingSettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('settings');
  const tInbox = await getTranslations('messages.inbox');

  const scope = await getClinicScope();
  if (!scope) return null;

  const [{ data: automations }, { data: latestTest }, { data: auth }] = await Promise.all([
    scope.supabase.from('clinic_automations').select('*').returns<ClinicAutomation[]>(),
    scope.supabase
      .from('message_log')
      .select('*')
      .eq('template_key', 'test_message')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle<MessageLogEntry>(),
    scope.supabase.auth.getUser(),
  ]);

  const byKind = new Map((automations ?? []).map((row) => [row.kind, row] as const));
  const clinic = scope.context.clinic;
  const channel = clinic.reminder_channel ?? 'whatsapp';
  const bookingEnabled = clinic.booking_enabled === true && Boolean(clinic.booking_slug);
  const reviewUrlSet = Boolean(clinic.google_review_url);

  return (
    <>
      <PageHeader title={t('messaging.title')} description={t('messaging.subtitle')} below={<SettingsNav />} />
      <PageBody width="narrow">
        <ReminderTemplateForm
          template={clinic.reminder_template ?? null}
          enabled={clinic.reminders_enabled !== false}
          hoursBefore={clinic.reminder_hours_before ?? 24}
          channel={channel}
          pushEnabled={clinic.reminder_push_enabled !== false}
          whatsappTemplateId={byKind.get('appointment_reminder')?.whatsapp_template_id ?? null}
          clinicName={clinic.name}
        />
        <TestMessageCard
          channel={channel}
          phone={scope.context.profile?.phone ?? null}
          email={auth?.user?.email ?? null}
          latest={latestTest ?? null}
        />
        <WhatsappLineCard
          number={clinic.whatsapp_number ?? null}
          openerTemplateId={byKind.get('conversation_opener')?.whatsapp_template_id ?? null}
          openerText={tInbox('openerBody', { name: '{{1}}', clinic: '{{2}}' })}
        />
        {AUTOMATION_KINDS.map((kind) => (
          <AutomationCard
            key={kind}
            kind={kind}
            row={byKind.get(kind) ?? null}
            clinicName={clinic.name}
            channel={channel}
            bookingEnabled={bookingEnabled}
            reviewUrlSet={reviewUrlSet}
          />
        ))}
        <GoogleReviewCard url={clinic.google_review_url ?? null} />
      </PageBody>
    </>
  );
}
