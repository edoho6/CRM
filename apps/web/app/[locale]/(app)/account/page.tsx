import { getTranslations, setRequestLocale } from 'next-intl/server';
import { CalendarCog, CreditCard, Palette } from 'lucide-react';
import { Card, CardBody, CardHeader, CardTitle } from '@clinic/ui';
import type { AppointmentType } from '@clinic/db/types';
import { PageHeader } from '@/components/app-shell';
import { getClinicScope } from '@/lib/session';
import { AppointmentTypesManager } from '@/features/settings/appointment-types-manager';
import { AppearanceSettings } from '@/features/settings/appearance-settings';

/**
 * The personal area.
 *
 * Everything a practitioner shapes for themself, in one place: how the interface
 * looks, and the treatment types their own diary and invoices are built from.
 * It sits above Settings in the navigation because it is opened far more often —
 * Settings holds the things you configure once, this holds the things you adjust
 * as the practice changes.
 *
 * The split is by ownership rather than by subject. A treatment type is a thing
 * *this practitioner* offers; the clinic's name and its payment provider belong
 * to the practice as a whole and stay in Settings, where a second practitioner
 * joining later would not expect to find their own preferences.
 */
export default async function AccountPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('account');
  const tTypes = await getTranslations('settings.appointmentTypes');

  const scope = await getClinicScope();
  if (!scope) return null;

  const { data: types } = await scope.supabase
    .from('appointment_types')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
    .returns<AppointmentType[]>();

  return (
    <>
      <PageHeader title={t('title')} description={t('subtitle')} />

      <div className="max-w-4xl space-y-5">
        <Card>
          <CardHeader>
            <CardTitle>
              <span className="inline-flex items-center gap-2">
                <Palette className="h-4 w-4 text-ink-600" aria-hidden />
                {t('appearance')}
              </span>
            </CardTitle>
          </CardHeader>
          <CardBody>
            <AppearanceSettings />
          </CardBody>
        </Card>

        <section>
          <h2 className="mb-1 flex items-center gap-2 text-base font-semibold text-ink-900">
            <CalendarCog className="h-4 w-4 text-ink-600" aria-hidden />
            {tTypes('title')}
          </h2>
          <p className="mb-3 text-sm text-ink-600">{tTypes('subtitle')}</p>
          <AppointmentTypesManager types={types ?? []} />
        </section>

        {/* Where the money is configured is a property of the practice rather
            than of the person, so it is named here and lives in Settings. */}
        <Card>
          <CardHeader>
            <CardTitle>
              <span className="inline-flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-ink-600" aria-hidden />
                {t('payments')}
              </span>
            </CardTitle>
          </CardHeader>
          <CardBody>
            <p className="text-sm text-ink-700">{t('paymentsBody')}</p>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
