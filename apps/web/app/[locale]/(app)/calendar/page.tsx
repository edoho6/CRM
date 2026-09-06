import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { AppointmentType, AppointmentWithRelations, Patient } from '@clinic/db/types';
import { PageHeader } from '@/components/app-shell';
import { getClinicScope } from '@/lib/session';
import { CalendarView } from '@/features/appointments/calendar-view';
import { addDays, fromDateKey, startOfWeek, toDateKey } from '@/features/appointments/date-utils';

const APPOINTMENT_SELECT =
  'id, clinic_id, patient_id, practitioner_id, appointment_type_id, start_at, end_at, status, location, notes, cancelled_reason, cancelled_at, created_by, created_at, updated_at, ' +
  'patient:patients(id, first_name, last_name, full_name, phone), ' +
  'appointment_type:appointment_types(id, name_he, name_en, color)';

export default async function CalendarPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ date?: string; view?: string; patient?: string; new?: string }>;
}) {
  const { locale } = await params;
  const { date, view: viewParam, patient: patientParam, new: newParam } = await searchParams;
  setRequestLocale(locale);

  const t = await getTranslations('appointments');
  const scope = await getClinicScope();
  if (!scope) return null;

  const view = viewParam === 'day' ? 'day' : 'week';
  const anchorKey = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : toDateKey(new Date());
  const anchor = fromDateKey(anchorKey);

  // Fetch a day either side of the visible range so appointments that straddle
  // midnight in the user's time zone still show up.
  const rangeStart = view === 'day' ? addDays(anchor, -1) : addDays(startOfWeek(anchor), -1);
  const rangeEnd = view === 'day' ? addDays(anchor, 2) : addDays(startOfWeek(anchor), 8);

  const [appointmentsResult, typesResult, patientsResult] = await Promise.all([
    scope.supabase
      .from('appointments')
      .select(APPOINTMENT_SELECT)
      .gte('start_at', rangeStart.toISOString())
      .lt('start_at', rangeEnd.toISOString())
      .order('start_at', { ascending: true })
      .returns<AppointmentWithRelations[]>(),
    scope.supabase
      .from('appointment_types')
      .select('*')
      .order('sort_order', { ascending: true })
      .returns<AppointmentType[]>(),
    scope.supabase
      .from('patients')
      .select('id, full_name')
      .eq('is_active', true)
      .order('last_name', { ascending: true })
      .limit(1000)
      .returns<Pick<Patient, 'id' | 'full_name'>[]>(),
  ]);

  return (
    <>
      <PageHeader title={t('title')} />
      <CalendarView
        appointments={appointmentsResult.data ?? []}
        appointmentTypes={typesResult.data ?? []}
        patients={patientsResult.data ?? []}
        practitionerId={scope.context.membership.user_id}
        anchorDate={anchorKey}
        view={view}
        defaultPatientId={patientParam}
        openNewOnLoad={newParam === '1'}
      />
    </>
  );
}
