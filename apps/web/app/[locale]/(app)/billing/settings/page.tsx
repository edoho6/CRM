import { getTranslations, setRequestLocale } from 'next-intl/server';
import { siteUrl } from '@clinic/db';
import type { ClinicPaymentSettings } from '@clinic/db/types';
import { PageHeader } from '@/components/app-shell';
import { SettingsNav } from '@/features/settings/settings-nav';
import { getClinicScope } from '@/lib/session';
import { GrowSettingsForm } from '@/features/billing/grow-settings-form';

export default async function BillingSettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('billing.settings');

  const scope = await getClinicScope();
  if (!scope) return null;

  // Owner-only by RLS: a non-owner simply gets no row and an empty form they
  // cannot save, which is the correct outcome without a second permission check.
  const { data: settings } = await scope.supabase
    .from('clinic_payment_settings')
    .select('*')
    .eq('clinic_id', scope.context.clinic.id)
    .maybeSingle<ClinicPaymentSettings>();

  return (
    <>
      <PageHeader title={t('title')} />
      <SettingsNav />
      <GrowSettingsForm
        settings={settings ?? null}
        webhookUrl={`${siteUrl()}/api/billing/grow/webhook`}
      />
    </>
  );
}
