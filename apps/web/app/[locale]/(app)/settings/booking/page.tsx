import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PageBody } from '@clinic/ui';
import { PageHeader } from '@/components/app-shell';
import { getClinicScope } from '@/lib/session';
import { SettingsNav } from '@/features/settings/settings-nav';
import { BookingSettingsForm } from '@/features/settings/booking-settings-form';

export default async function BookingSettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('settings');

  const scope = await getClinicScope();
  if (!scope) return null;

  const { count } = await scope.supabase
    .from('appointment_types')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true)
    .eq('online_bookable', true);

  const clinic = scope.context.clinic;

  return (
    <>
      <PageHeader title={t('booking.title')} description={t('booking.subtitle')} below={<SettingsNav />} />
      <PageBody width="narrow">
        <BookingSettingsForm
          enabled={clinic.booking_enabled === true}
          slug={clinic.booking_slug ?? clinic.slug}
          intro={clinic.booking_intro ?? null}
          leadHours={clinic.booking_lead_hours ?? 24}
          horizonDays={clinic.booking_horizon_days ?? 60}
          verifySms={clinic.booking_verify_sms === true}
          bookableTypes={count ?? 0}
        />
      </PageBody>
    </>
  );
}
