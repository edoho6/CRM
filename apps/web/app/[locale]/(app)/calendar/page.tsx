import { headers } from 'next/headers';
import { userAgent } from 'next/server';
import { setRequestLocale } from 'next-intl/server';
import type {
  AppointmentType,
  AppointmentWithRelations,
  Location,
  Patient,
  Room,
} from '@clinic/db/types';
import { getAbilities, getClinicScope } from '@/lib/session';
import { dateKeyIn, zonedMidnight } from '@clinic/domain';
import { resolveRange } from '@/lib/date-range';
import { pageFrom, pageRange } from '@/components/pagination';
import { DiaryList, type DiaryListRow } from '@/features/appointments/diary-list';
import type { PaymentStatusRow } from '@/features/billing/payment-summary';
import { CalendarView } from '@/features/appointments/calendar-view';
import {
  type CalendarViewMode,
  addDays,
  fromDateKey,
  monthGridDays,
  startOfWeek,
  toDateKey,
} from '@/features/appointments/date-utils';
import type {
  BlockedWindow,
  DayException,
  WorkingBlock,
} from '@/features/appointments/availability';
import { pageTitle } from '@/lib/page-title';

export const generateMetadata = pageTitle('nav', 'calendar');

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
    range?: string;
    page?: string;
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
    range: rangeParam,
    page: pageParam,
  } = await searchParams;
  setRequestLocale(locale);

  const scope = await getClinicScope();
  if (!scope) return null;
  const abilities = await getAbilities();

  const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

  // A phone opens on the day. Decided here, from the request, rather than in
  // the browser after the week had already been drawn — that drew a week and
  // then swapped it for a day: a flash and a second round trip on every visit.
  // A view named in the URL always wins, so the switch works on a phone too.
  const phone = userAgent({ headers: await headers() }).device.type === 'mobile';
  const view: CalendarViewMode =
    viewParam === 'day' || viewParam === 'month' || viewParam === 'list' || viewParam === 'range'
      ? viewParam
      : viewParam === 'week' || !phone
        ? 'week'
        : 'day';

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
    // The list asks its own paged question below; the grid behind it draws
    // nothing, so the window is only the day in view.
    if (view === 'list') return [addDays(anchor, -1), addDays(anchor, 2)];
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
  ] = await Promise.all([
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

  const appointments = appointmentsResult.data ?? [];

  /*
   * Where each booking on screen stands with money: the grid paints a paid one
   * green, and the details window shows the state and lets the desk mark it
   * paid. The same view the patient's file reads, which counts an invoice
   * raised against the treatment and a payment marked by hand. Only for
   * someone who sees money; the identifiers go in slices so a busy month is not
   * one very long address.
   */
  const payments: Record<string, PaymentStatusRow> = {};
  let canBill = false;
  if (abilities.money && view !== 'list' && appointments.length > 0) {
    const ids = appointments.map((appointment) => appointment.id);
    const slices = [];
    for (let index = 0; index < ids.length; index += 100)
      slices.push(ids.slice(index, index + 100));
    const [settings, answers] = await Promise.all([
      // No provider set up means "raise an invoice" would only ever fail.
      scope.supabase
        .from('clinic_payment_settings')
        .select('is_active')
        .maybeSingle<{ is_active: boolean }>(),
      Promise.all(
        slices.map((slice) =>
          scope.supabase
            .from('appointment_payment_status')
            .select('*')
            .in('appointment_id', slice)
            .returns<(PaymentStatusRow & { appointment_id: string })[]>(),
        ),
      ),
    ]);
    canBill = settings.data?.is_active === true;
    for (const answer of answers)
      for (const row of answer.data ?? []) payments[row.appointment_id] = row;
  }

  const list = view === 'list' ? await loadList() : null;

  /**
   * The list view: the diary's rows grouped by day, filtered and paged in the
   * query (the treatments page it replaces did the same). With no filter it
   * runs from today forward, so today's appointments are the first thing on
   * the page and the next ones follow them.
   */
  async function loadList() {
    if (!scope) return null;
    const timeZone = scope.context.clinic.timezone;
    const range = resolveRange({ range: rangeParam, from: fromParam, to: toParam });
    // Nothing chosen: from today on, in order — today's appointments first,
    // then who comes after. The past presets (a week, a month, all) read
    // latest first, the way the treatments list did; today and a chosen span
    // read in the order they happen.
    const upcoming = !rangeParam && !fromParam && !toParam;
    const ascending = upcoming || range.preset === 'today' || range.preset === 'custom';
    const midnight = (key: string, plusDays = 0) => {
      const [year, month, day] = key.split('-').map(Number) as [number, number, number];
      return zonedMidnight(year, month, day + plusDays, timeZone);
    };
    const todayKey = dateKeyIn(new Date(), timeZone);
    const page = pageFrom(pageParam);

    let query = scope.supabase
      .from('appointments')
      .select(
        'id, start_at, status, reminder_sent_at, confirmation_response, patient:patients(id, full_name), encounter:encounters(id, status)',
        { count: 'exact' },
      )
      .neq('status', 'cancelled')
      .order('start_at', { ascending })
      .range(...pageRange(page));
    if (upcoming) query = query.gte('start_at', midnight(todayKey).toISOString());
    if (range.to) query = query.lt('start_at', midnight(range.to, 1).toISOString());
    if (range.from) query = query.gte('start_at', midnight(range.from).toISOString());
    const { data, count } = await query.returns<DiaryListRow[]>();
    const rows = data ?? [];

    const payments = new Map<string, PaymentStatusRow>();
    let canBill = false;
    if (abilities.money && rows.length > 0) {
      const [{ data: paymentRows }, { data: settings }] = await Promise.all([
        scope.supabase
          .from('appointment_payment_status')
          // Everything, the hand mark (paid_at, paid_method) included.
          .select('*')
          .in(
            'appointment_id',
            rows.map((row) => row.id),
          )
          .returns<(PaymentStatusRow & { appointment_id: string })[]>(),
        // No provider set up means "raise an invoice" would only ever fail.
        scope.supabase
          .from('clinic_payment_settings')
          .select('is_active')
          .maybeSingle<{ is_active: boolean }>(),
      ]);
      for (const row of paymentRows ?? []) payments.set(row.appointment_id, row);
      canBill = settings?.is_active === true;
    }

    return (
      <DiaryList
        rows={rows}
        matching={count ?? null}
        page={page}
        payments={payments}
        canBill={canBill}
        showRecords={abilities.clinicalRecords}
        showPayments={abilities.money}
        query={{ range: rangeParam, from: fromParam, to: toParam }}
        timeZone={timeZone}
        todayKey={todayKey}
      />
    );
  }

  return (
    <>
      <CalendarView
        appointments={appointments}
        payments={abilities.money ? payments : null}
        canBill={canBill}
        list={list}
        renderedAt={new Date().toISOString()}
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
