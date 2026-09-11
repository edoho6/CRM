import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PageBody } from '@clinic/ui';
import { PageHeader } from '@/components/app-shell';
import { getClinicScope } from '@/lib/session';
import { NewEncounterPicker, type TodayVisit } from '@/features/encounters/new-encounter-picker';
import { pageTitle } from '@/lib/page-title';

export const generateMetadata = pageTitle('encounters', 'newPicker.title');

interface TodayRow {
  id: string;
  patient_id: string;
  start_at: string;
  patient: { full_name: string } | null;
  encounter: { id: string } | null;
}

/**
 * "New treatment" from the quick-create menu: pick whose, then go.
 *
 * Today's bookings that have no record yet come first; a search over every
 * active patient covers everyone else.
 */
export default async function NewEncounterPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('encounters');

  const scope = await getClinicScope();
  if (!scope) return null;

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);

  const [{ data: patients }, { data: todayRows }] = await Promise.all([
    scope.supabase
      .from('patients')
      .select('id, full_name, phone')
      .eq('is_active', true)
      .order('last_name', { ascending: true })
      .limit(2000)
      .returns<{ id: string; full_name: string; phone: string | null }[]>(),
    scope.supabase
      .from('appointments')
      .select('id, patient_id, start_at, patient:patients(full_name), encounter:encounters(id)')
      .eq('practitioner_id', scope.context.membership.user_id)
      .neq('status', 'cancelled')
      .gte('start_at', startOfDay.toISOString())
      .lt('start_at', endOfDay.toISOString())
      .order('start_at', { ascending: true })
      .returns<TodayRow[]>(),
  ]);

  const today: TodayVisit[] = (todayRows ?? [])
    .filter((row) => !row.encounter && row.patient)
    .map((row) => ({
      appointmentId: row.id,
      patientId: row.patient_id,
      patientName: row.patient!.full_name,
      startAt: row.start_at,
    }));

  return (
    <>
      <PageHeader title={t('newPicker.title')} description={t('newPicker.subtitle')} />
      <PageBody width="narrow">
        <NewEncounterPicker patients={patients ?? []} today={today} />
      </PageBody>
    </>
  );
}
