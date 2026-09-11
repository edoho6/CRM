import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PageBody } from '@clinic/ui';
import { PageHeader } from '@/components/app-shell';
import { getClinicScope } from '@/lib/session';
import { SettingsNav } from '@/features/settings/settings-nav';
import { ClinicSettingsForm } from '@/features/settings/clinic-settings-form';
import { ReminderTemplateForm } from '@/features/settings/reminder-template-form';
import { pageTitle } from '@/lib/page-title';

export const generateMetadata = pageTitle('settings', 'title');

export default async function SettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('settings');

  const scope = await getClinicScope();
  if (!scope) return null;

  return (
    <>
      <PageHeader title={t('title')} description={t('subtitle')} below={<SettingsNav />} />
      <ClinicSettingsForm
        name={scope.context.clinic.name}
        tracksInventory={scope.context.clinic.tracks_inventory !== false}
      />
      <PageBody width="narrow" className="mt-6">
        <ReminderTemplateForm
          template={scope.context.clinic.reminder_template ?? null}
          enabled={scope.context.clinic.reminders_enabled !== false}
          hoursBefore={scope.context.clinic.reminder_hours_before ?? 24}
          channel={scope.context.clinic.reminder_channel ?? 'whatsapp'}
          clinicName={scope.context.clinic.name}
        />
      </PageBody>
    </>
  );
}
