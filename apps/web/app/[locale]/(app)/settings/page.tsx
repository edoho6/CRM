import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PageHeader } from '@/components/app-shell';
import { getClinicScope } from '@/lib/session';
import { ClinicSettingsForm } from '@/features/settings/clinic-settings-form';

export default async function SettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('settings');

  const scope = await getClinicScope();
  if (!scope) return null;

  return (
    <>
      <PageHeader title={t('title')} description={t('subtitle')} />
      <ClinicSettingsForm
        name={scope.context.clinic.name}
        tracksInventory={scope.context.clinic.tracks_inventory !== false}
      />
    </>
  );
}
