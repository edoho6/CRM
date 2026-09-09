import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { AppointmentType, AppointmentWithRelations, Location, Patient, Room } from '@clinic/db/types';
import { PageHeader } from '@/components/app-shell';
import { getClinicScope } from '@/lib/session';
import { CalendarView, type CalendarViewMode } from '@/features/appointments/calendar-view';
import {
  addDays,
  fromDateKey,
  monthGridDays,
  startOfWeek,
  toDateKey,
} from '@/features/appointments/date-utils';
import type { BlockedWindow, DayException, WorkingBlock } from '@/features/appointments/availability';

const APPOINTMENT_SELECT =
  'id, clinic_id, patient_id, practitioner_id, appointment_type_id, start_at, end_at, status, location, notes, cancelled_reason, cancelled_at, created_by, created_at, updated_at, ' +
  'room_id, location_id, reminder_sent_at, confirmation_token, confirmation_response, responded_at, ' +
  'room:rooms(id, name, color), place:locations(id, name, color), ' +
  'patient:patients(id, first_name, last_name, full_name, phone), ' +
  'appointment_type:appointment_types(id, name_he, name_en, color)';

export default async function CalendarPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    date?: string;
    view?: string;
    patient?: string;
    new?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const { locale } = await params;
  const {
    date,
    view: viewParam,
    patient: patientParam,
    new: newParam,
    from: fromParam,
    to: toParam,
  } = await searchParams;
  setRequestLocale(locale);

  const t = await getTranslations('appointments');
  const scope = await getClinicScope();
  if (!scope) return null;

  const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

  const view: CalendarViewMode =
    viewParam === 'day' || viewParam === 'month' || viewParam === 'range' ? viewParam : 'week';

  const anchorKey = date && DATE_KEY.test(date) ? date : toDateKey(new Date());
  const anchor = fromDateKey(anchorKey);

  const rangeFrom = fromParam && DATE_KEY.test(fromParam) ? fromParam : null;
  const rangeTo = toParam && DATE_KEY.test(toParam) ? toParam : null;

  /*
   * What to fetch, per view. A day either side of whatever is visible, so an
   * appointment that straddles midnight in the practitioner's time zone still
   * appears at both ends.
   *
   * The month grid runs to whole weeks, so it can reach several days into the
   * neighbouring months — fetching the calendar month alone would leave those
   * leading and trailing cells wrongly empty.
   */
  const [windowStart, windowEnd] = (() => {
    if (view === 'day') return [addDays(anchor, -1), addDays(anchor, 2)];
    if (view === 'month') {
      const grid = monthGridDays(anchor);
      return [addDays(grid[0]!, -1), addDays(grid[grid.length - 1]!, 2)];
    }
    if (view === 'range') {
      const start = rangeFrom ? fromDateKey(rangeFrom) : addDays(anchor, -7);
      const end = rangeTo ? fromDateKey(rangeTo) : addDays(anchor, 7);
      // A backwards range would produce an empty query rather than an empty
      // view; clamping keeps the panel explicable.
      return end >= start
        ? [addDays(start, -1), addDays(end, 2)]
        : [addDays(start, -1), addDays(start, 2)];
    }
    return [addDays(startOfWeek(anchor), -1), addDays(startOfWeek(anchor), 8)];
  })();

  const rangeStart = windowStart;
  const rangeEnd = windowEnd;

  const [
    appointmentsResult,
    typesResult,
    patientsResult,
    blocksResult,
    exceptionsResult,
    roomsResult,
    blockedResult,
    locationsResult,
  ] =
    await Promise.all([
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
      .select('id, full_name, phone')
      .eq('is_active', true)
      .order('last_name', { ascending: true })
      .limit(1000)
      .returns<Pick<Patient, 'id' | 'full_name' | 'phone'>[]>(),
    // When this practitioner works, so the grid can shade the hours they do not
    // and the dialog can say so before a booking is saved.
    scope.supabase
      .from('practitioner_schedules')
      .select('weekday, start_time, end_time')
      .eq('practitioner_id', scope.context.membership.user_id)
      .eq('is_active', true)
      .returns<WorkingBlock[]>(),
    scope.supabase
      .from('schedule_exceptions')
      .select('date, is_closed, start_time, end_time, reason')
      .eq('practitioner_id', scope.context.membership.user_id)
      .gte('date', toDateKey(windowStart))
      .lte('date', toDateKey(windowEnd))
      .returns<DayException[]>(),
    scope.supabase
      .from('rooms')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
      .returns<Room[]>(),
    // Hours away inside the window, each with its reason, for the grid to
    // shade and the dialog to name.
    scope.supabase
      .from('schedule_blocks')
      .select('id, start_at, end_at, reason')
      .eq('practitioner_id', scope.context.membership.user_id)
      .lt('start_at', windowEnd.toISOString())
      .gt('end_at', windowStart.toISOString())
      .order('start_at', { ascending: true })
      .returns<BlockedWindow[]>(),
    scope.supabase
      .from('locations')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
      .returns<Location[]>(),
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
        rangeFrom={rangeFrom}
        rangeTo={rangeTo}
        availability={{
          blocks: blocksResult.data ?? [],
          exceptions: exceptionsResult.data ?? [],
          blocked: blockedResult.data ?? [],
        }}
        defaultPatientId={patientParam}
        openNewOnLoad={newParam === '1'}
        rooms={roomsResult.data ?? []}
        locations={locationsResult.data ?? []}
        reminderTemplate={scope.context.clinic.reminder_template ?? null}
        clinicName={scope.context.clinic.name}
      />
    </>
  );
}
