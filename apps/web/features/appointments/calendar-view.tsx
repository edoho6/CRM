'use client';

import { useMemo, useState } from 'react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { CalendarPlus, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button, cn, TIME_INPUT_LANG } from '@clinic/ui';
import type { Locale } from '@clinic/domain';
import { usePathname, useRouter } from '@clinic/i18n/navigation';
import type { AppointmentType, AppointmentWithRelations, Patient } from '@clinic/db/types';
import { appointmentTypeName, patientFullName } from '@/lib/display';
import { AppointmentDialog, type AppointmentDraft } from './appointment-dialog';
import {
  closureFor,
  isClosedDay,
  openIntervalsFor,
  type Availability,
} from './availability';
import {
  addDays,
  addMinutes,
  addMonths,
  combineDateAndTime,
  daysBetween,
  fromDateKey,
  isSameDay,
  isSameMonth,
  minutesSinceMidnight,
  monthGridDays,
  startOfMonth,
  startOfWeek,
  toDateKey,
} from './date-utils';
import { formatDate } from '@clinic/i18n';

/**
 * Four ways to look at the diary.
 *
 * Day and week are a time grid, because the question there is "what is the shape
 * of this day" and a grid answers it at a glance. Month and a chosen range are
 * lists: a time grid over thirty days is unreadable at any width, and the
 * question changes to "which days have something in them".
 */
export type CalendarViewMode = 'day' | 'week' | 'month' | 'range';

/** Visible hours. Outside these the grid would be mostly empty scrolling. */
const DAY_START_HOUR = 7;
const DAY_END_HOUR = 22;
const SLOT_MINUTES = 30;
const SLOT_HEIGHT = 28; // px per 30 minutes

const TOTAL_MINUTES = (DAY_END_HOUR - DAY_START_HOUR) * 60;
const SLOT_COUNT = TOTAL_MINUTES / SLOT_MINUTES;

interface PositionedAppointment {
  appointment: AppointmentWithRelations;
  top: number;
  height: number;
  column: number;
  columns: number;
}

/**
 * Lays out a day's appointments, splitting overlapping ones into side-by-side
 * columns so a double-booked slot is visible rather than hidden underneath.
 */
function positionDay(appointments: AppointmentWithRelations[]): PositionedAppointment[] {
  const sorted = [...appointments].sort(
    (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime(),
  );

  const positioned: PositionedAppointment[] = [];
  let cluster: AppointmentWithRelations[] = [];
  let clusterEnd = 0;

  const flush = () => {
    if (cluster.length === 0) return;
    // Greedy column assignment within the cluster.
    const columnEnds: number[] = [];
    const assignments = cluster.map((appointment) => {
      const start = new Date(appointment.start_at).getTime();
      const end = new Date(appointment.end_at).getTime();
      let column = columnEnds.findIndex((value) => value <= start);
      if (column === -1) {
        column = columnEnds.length;
      }
      columnEnds[column] = end;
      return { appointment, column };
    });

    const columns = columnEnds.length;
    for (const { appointment, column } of assignments) {
      const start = new Date(appointment.start_at);
      const end = new Date(appointment.end_at);
      const startMinutes = minutesSinceMidnight(start) - DAY_START_HOUR * 60;
      const endMinutes = minutesSinceMidnight(end) - DAY_START_HOUR * 60;
      const clampedStart = Math.max(0, startMinutes);
      const clampedEnd = Math.min(TOTAL_MINUTES, Math.max(endMinutes, clampedStart + 15));

      positioned.push({
        appointment,
        top: (clampedStart / SLOT_MINUTES) * SLOT_HEIGHT,
        height: Math.max(((clampedEnd - clampedStart) / SLOT_MINUTES) * SLOT_HEIGHT, 18),
        column,
        columns,
      });
    }
    cluster = [];
    clusterEnd = 0;
  };

  for (const appointment of sorted) {
    const start = new Date(appointment.start_at).getTime();
    const end = new Date(appointment.end_at).getTime();
    if (cluster.length > 0 && start >= clusterEnd) {
      flush();
    }
    cluster.push(appointment);
    clusterEnd = Math.max(clusterEnd, end);
  }
  flush();

  return positioned;
}

export function CalendarView({
  appointments,
  patients,
  appointmentTypes,
  practitionerId,
  anchorDate,
  view,
  rangeFrom,
  rangeTo,
  availability,
  defaultPatientId,
  openNewOnLoad,
}: {
  appointments: AppointmentWithRelations[];
  patients: Pick<Patient, 'id' | 'full_name' | 'phone'>[];
  appointmentTypes: AppointmentType[];
  practitionerId: string;
  anchorDate: string;
  view: CalendarViewMode;
  /** Inclusive bounds for the range view, as `YYYY-MM-DD`. */
  rangeFrom?: string | null;
  rangeTo?: string | null;
  /** When this practitioner works, for shading and for the booking warning. */
  availability: Availability;
  defaultPatientId?: string;
  openNewOnLoad?: boolean;
}) {
  const t = useTranslations('appointments');
  const tc = useTranslations('common');
  const tFilters = useTranslations('filters');
  const format = useFormatter();
  const locale = useLocale() as Locale;
  const isRtl = locale === 'he';
  const router = useRouter();
  const pathname = usePathname();

  const anchor = useMemo(() => fromDateKey(anchorDate), [anchorDate]);
  const days = useMemo(() => {
    if (view === 'day') return [anchor];
    if (view === 'month') return monthGridDays(anchor);
    if (view === 'range') {
      const from = rangeFrom ? fromDateKey(rangeFrom) : anchor;
      const to = rangeTo ? fromDateKey(rangeTo) : addDays(from, 13);
      const list = daysBetween(from, to);
      // An empty or backwards range still has to render something rather than
      // an unexplained blank panel.
      return list.length > 0 ? list : [anchor];
    }
    const start = startOfWeek(anchor);
    return Array.from({ length: 7 }, (_, index) => addDays(start, index));
  }, [anchor, view, rangeFrom, rangeTo]);

  /** Day and week draw a time grid; month and range draw lists. */
  const isTimeGrid = view === 'day' || view === 'week';

  /*
   * The open hours for each visible day, keyed by date.
   *
   * Computed once for the whole grid rather than per slot: a week view has 7
   * days times 30 slots, and working that out inside the loop would run the
   * lookup two hundred times for an answer that changes seven times.
   *
   * An empty map means no schedule has been set, which shades nothing: an empty
   * setting must not make the whole grid look closed.
   */
  const openMinutes = useMemo(() => {
    const map = new Map<string, { start: number; end: number }[] | null>();
    if (availability.blocks.length === 0 && availability.exceptions.length === 0) return map;
    for (const day of days) map.set(toDateKey(day), openIntervalsFor(day, availability));
    return map;
  }, [days, availability]);

  const defaultDuration = appointmentTypes[0]?.default_duration_minutes ?? 60;

  const [dialogOpen, setDialogOpen] = useState(Boolean(openNewOnLoad));
  const [draft, setDraft] = useState<AppointmentDraft | null>(
    openNewOnLoad
      ? {
          patientId: defaultPatientId,
          start: combineDateAndTime(anchorDate, '09:00'),
          end: addMinutes(combineDateAndTime(anchorDate, '09:00'), defaultDuration),
        }
      : null,
  );

  const byDay = useMemo(() => {
    const map = new Map<string, AppointmentWithRelations[]>();
    for (const appointment of appointments) {
      const key = toDateKey(new Date(appointment.start_at));
      const list = map.get(key);
      if (list) list.push(appointment);
      else map.set(key, [appointment]);
    }
    return map;
  }, [appointments]);

  function navigate(direction: -1 | 1) {
    // Each view steps by its own unit: a day, a week, a month. The range view
    // is anchored to its own dates and has nothing to step through.
    const next =
      view === 'day'
        ? addDays(anchor, direction)
        : view === 'month'
          ? addMonths(anchor, direction)
          : addDays(anchor, direction * 7);
    router.push({ pathname, query: { date: toDateKey(next), view } });
  }

  function goToday() {
    router.push({ pathname, query: { date: toDateKey(new Date()), view } });
  }

  function switchView(nextView: CalendarViewMode) {
    if (nextView === 'range') {
      // Opening the range view with nothing chosen would show a blank panel, so
      // it starts on the fortnight around today and is edited from there.
      router.push({
        pathname,
        query: {
          view: 'range',
          from: rangeFrom ?? toDateKey(addDays(new Date(), -7)),
          to: rangeTo ?? toDateKey(addDays(new Date(), 7)),
        },
      });
      return;
    }
    router.push({ pathname, query: { date: anchorDate, view: nextView } });
  }

  function setRangeBound(which: 'from' | 'to', value: string) {
    router.replace({
      pathname,
      query: {
        view: 'range',
        from: which === 'from' ? value : (rangeFrom ?? value),
        to: which === 'to' ? value : (rangeTo ?? value),
      },
    });
  }

  function openSlot(day: Date, slotIndex: number) {
    const minutes = DAY_START_HOUR * 60 + slotIndex * SLOT_MINUTES;
    const start = new Date(day);
    start.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
    setDraft({
      patientId: defaultPatientId,
      start,
      end: addMinutes(start, defaultDuration),
    });
    setDialogOpen(true);
  }

  function openAppointment(appointment: AppointmentWithRelations) {
    setDraft({
      id: appointment.id,
      patientId: appointment.patient_id,
      typeId: appointment.appointment_type_id,
      start: new Date(appointment.start_at),
      end: new Date(appointment.end_at),
      status: appointment.status,
      location: appointment.location,
      notes: appointment.notes,
    });
    setDialogOpen(true);
  }

  const rangeLabel =
    view === 'day'
      ? format.dateTime(anchor, 'weekday')
      : view === 'month'
        ? format.dateTime(startOfMonth(anchor), 'monthYear')
        : `${formatDate(days[0]!)} – ${formatDate(days[days.length - 1]!)}`;

  const totalInView = days.reduce((sum, day) => sum + (byDay.get(toDateKey(day))?.length ?? 0), 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1">
          {/* The range view is anchored to its own two dates, so stepping and
              "today" have nothing to act on and are hidden rather than left
              present and inert. */}
          {view !== 'range' ? (
            <>
              {/* Chevrons point in reading order: "previous" is towards the start edge. */}
              <Button
                variant="secondary"
                size="icon"
                onClick={() => navigate(-1)}
                aria-label={tc('back')}
              >
                {isRtl ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
              </Button>
              <Button
                variant="secondary"
                size="icon"
                onClick={() => navigate(1)}
                aria-label={tc('viewAll')}
              >
                {isRtl ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </Button>
              <Button variant="secondary" size="sm" onClick={goToday}>
                {tc('today')}
              </Button>
              <span className="ms-2 text-sm font-medium text-ink-700">{rangeLabel}</span>
            </>
          ) : (
            <div className="flex flex-wrap items-center gap-1.5">
              <input
                type="date"
                lang={TIME_INPUT_LANG}
                dir="ltr"
                aria-label={tFilters('from')}
                value={rangeFrom ?? ''}
                max={rangeTo ?? undefined}
                onChange={(event) => setRangeBound('from', event.target.value)}
                className="h-9 rounded-lg border border-ink-200 bg-white px-2 text-sm text-ink-900 tabular-nums shadow-xs outline-none focus:border-jade-600"
              />
              <span className="text-sm text-ink-600">–</span>
              <input
                type="date"
                lang={TIME_INPUT_LANG}
                dir="ltr"
                aria-label={tFilters('to')}
                value={rangeTo ?? ''}
                min={rangeFrom ?? undefined}
                onChange={(event) => setRangeBound('to', event.target.value)}
                className="h-9 rounded-lg border border-ink-200 bg-white px-2 text-sm text-ink-900 tabular-nums shadow-xs outline-none focus:border-jade-600"
              />
              <span className="ms-1 text-sm text-ink-600">
                {t('countInView', { count: totalInView })}
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1">
          <Button
            variant={view === 'day' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => switchView('day')}
          >
            {t('views.day')}
          </Button>
          <Button
            variant={view === 'week' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => switchView('week')}
          >
            {t('views.week')}
          </Button>
          <Button
            variant={view === 'month' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => switchView('month')}
          >
            {t('views.month')}
          </Button>
          <Button
            variant={view === 'range' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => switchView('range')}
          >
            {t('views.range')}
          </Button>
          <Button
            size="sm"
            onClick={() => openSlot(view === 'day' ? anchor : days[0]!, 4)}
            className="ms-2"
          >
            <CalendarPlus className="h-4 w-4" />
            {t('new')}
          </Button>
        </div>
      </div>

      {!isTimeGrid ? (
        <MonthOrRangeView
          days={days}
          view={view}
          anchor={anchor}
          byDay={byDay}
          availability={availability}
          locale={locale}
          onOpen={openAppointment}
          onAddOn={(day) => openSlot(day, 4)}
        />
      ) : (
        <div className="overflow-x-auto rounded-card border border-ink-200 bg-white">
          <div className="min-w-[720px]">
            {/* Header row: time gutter + one cell per day. */}
            <div
              className="grid border-b border-ink-200"
              style={{ gridTemplateColumns: `4rem repeat(${days.length}, minmax(0, 1fr))` }}
            >
              <div className="border-e border-ink-100" />
              {days.map((day) => {
                const today = isSameDay(day, new Date());
                return (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      'border-e border-ink-100 px-2 py-1.5 text-center last:border-e-0',
                      today && 'bg-jade-50',
                    )}
                  >
                    <div
                      className={cn(
                        'text-xs font-medium',
                        today ? 'text-jade-800' : 'text-ink-600',
                      )}
                    >
                      {format.dateTime(day, { weekday: 'short' })}
                    </div>
                    <div
                      className={cn(
                        'text-sm',
                        today ? 'font-semibold text-jade-900' : 'text-ink-800',
                      )}
                    >
                      {format.dateTime(day, { day: 'numeric', month: 'numeric' })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Body: time gutter + day columns with absolutely-placed events. */}
            <div
              className="grid"
              style={{ gridTemplateColumns: `4rem repeat(${days.length}, minmax(0, 1fr))` }}
            >
              <div className="border-e border-ink-100">
                {Array.from({ length: SLOT_COUNT }, (_, index) => {
                  const minutes = DAY_START_HOUR * 60 + index * SLOT_MINUTES;
                  const isHour = minutes % 60 === 0;
                  return (
                    <div
                      key={index}
                      style={{ height: SLOT_HEIGHT }}
                      className={cn('relative', isHour && 'border-t border-ink-100')}
                    >
                      {isHour ? (
                        <span
                          className="absolute -top-2 end-1.5 text-[11px] text-ink-500 tabular-nums"
                          dir="ltr"
                        >
                          {String(Math.floor(minutes / 60)).padStart(2, '0')}:00
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              {days.map((day) => {
                const key = toDateKey(day);
                const dayAppointments = byDay.get(key) ?? [];
                const positioned = positionDay(dayAppointments);
                const today = isSameDay(day, new Date());
                // Undefined means no schedule has been set, which shades nothing.
                const open = openMinutes.get(key);

                return (
                  <div
                    key={key}
                    className={cn(
                      'relative border-e border-ink-100 last:border-e-0',
                      today && 'bg-jade-50/40',
                    )}
                  >
                    {/* Clickable background slots.

                        Hours outside the working day are shaded rather than
                        removed: a practitioner does see someone at eight in the
                        evening, and a grid that will not let them book it is a
                        grid they work around. The shading says what the schedule
                        expects; the slot still takes a booking. */}
                    {Array.from({ length: SLOT_COUNT }, (_, index) => {
                      const minutes = DAY_START_HOUR * 60 + index * SLOT_MINUTES;
                      const working =
                        !open || open.some(({ start, end }) => minutes >= start && minutes < end);
                      return (
                        <button
                          key={index}
                          type="button"
                          onClick={() => openSlot(day, index)}
                          style={{ height: SLOT_HEIGHT }}
                          className={cn(
                            'block w-full transition-colors hover:bg-jade-100/60',
                            minutes % 60 === 0
                              ? 'border-t border-ink-100'
                              : 'border-t border-ink-50',
                            !working && 'bg-ink-100/70',
                          )}
                          aria-label={`${formatDate(day)} ${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}${working ? '' : ' · ' + t('outsideHours')}`}
                        />
                      );
                    })}

                    {positioned.map(({ appointment, top, height, column, columns }) => {
                      const color = appointment.appointment_type?.color ?? '#0ea5e9';
                      const isCancelled = appointment.status === 'cancelled';
                      const widthPercent = 100 / columns;
                      return (
                        <button
                          key={appointment.id}
                          type="button"
                          onClick={() => openAppointment(appointment)}
                          style={{
                            top,
                            height,
                            // Logical offsets keep events flowing in reading order.
                            insetInlineStart: `calc(${column * widthPercent}% + 2px)`,
                            width: `calc(${widthPercent}% - 4px)`,
                            borderInlineStartColor: color,
                            backgroundColor: isCancelled ? undefined : `${color}1a`,
                          }}
                          className={cn(
                            'absolute overflow-hidden rounded-md border-s-3 px-1.5 py-0.5 text-start transition-shadow hover:shadow-md',
                            isCancelled ? 'bg-ink-100 text-ink-500 line-through' : 'text-ink-900',
                          )}
                        >
                          <span
                            className="block truncate text-[11px] font-medium tabular-nums"
                            dir="ltr"
                          >
                            {format.dateTime(new Date(appointment.start_at), 'time')}
                          </span>
                          <span className="block truncate text-xs">
                            {patientFullName(appointment.patient)}
                          </span>
                          {height > 44 ? (
                            <span className="block truncate text-[11px] text-ink-500">
                              {appointmentTypeName(appointment.appointment_type, locale)}
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <AppointmentDialog
        availability={availability}
        open={dialogOpen}
        draft={draft}
        patients={patients}
        appointmentTypes={appointmentTypes}
        practitionerId={practitionerId}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}

/**
 * Month and chosen-range views.
 *
 * Both are lists rather than time grids. Thirty days of a time grid at any
 * usable width gives columns too narrow to hold a patient's name, and the
 * question being asked over a month is not "what is the shape of Tuesday
 * afternoon" but "which days have something in them, and what".
 *
 * The month keeps the calendar's shape — seven columns, whole weeks — because
 * that shape is how a month is read. The range is a plain agenda: an arbitrary
 * span has no shape to preserve, and days with nothing in them are dropped
 * rather than printed as empty rows.
 */
function MonthOrRangeView({
  days,
  view,
  anchor,
  byDay,
  availability,
  locale,
  onOpen,
  onAddOn,
}: {
  days: Date[];
  view: CalendarViewMode;
  anchor: Date;
  byDay: Map<string, AppointmentWithRelations[]>;
  availability: Availability;
  locale: Locale;
  onOpen: (appointment: AppointmentWithRelations) => void;
  onAddOn: (day: Date) => void;
}) {
  const t = useTranslations('appointments');
  const format = useFormatter();

  if (view === 'range') {
    const withSomething = days.filter((day) => (byDay.get(toDateKey(day))?.length ?? 0) > 0);

    if (withSomething.length === 0) {
      return (
        <div className="rounded-card border border-ink-200 bg-white p-8 text-center text-sm text-ink-600">
          {t('noneInRange')}
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {withSomething.map((day) => (
          <section key={day.toISOString()} className="rounded-card border border-ink-200 bg-white">
            <h3 className="border-b border-ink-100 px-3 py-2 text-sm font-semibold text-ink-900">
              {format.dateTime(day, 'weekday')}
            </h3>
            <ul className="divide-y divide-ink-100">
              {(byDay.get(toDateKey(day)) ?? []).map((appointment) => (
                <li key={appointment.id}>
                  <button
                    type="button"
                    onClick={() => onOpen(appointment)}
                    className="flex w-full items-baseline gap-3 px-3 py-2 text-start text-sm hover:bg-ink-50"
                  >
                    <span dir="ltr" className="shrink-0 tabular-nums text-ink-600">
                      {format.dateTime(new Date(appointment.start_at), 'time')}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-medium text-ink-900">
                      {patientFullName(appointment.patient)}
                    </span>
                    <span className="shrink-0 truncate text-xs text-ink-600">
                      {appointmentTypeName(appointment.appointment_type, locale)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-card border border-ink-200 bg-white">
      <div className="min-w-[640px]">
        <div className="grid grid-cols-7 border-b border-ink-200">
          {days.slice(0, 7).map((day) => (
            <div
              key={`head-${day.toISOString()}`}
              className="border-e border-ink-100 px-2 py-1.5 text-center text-xs font-medium text-ink-600 last:border-e-0"
            >
              {format.dateTime(day, { weekday: 'short' })}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {days.map((day) => {
            const key = toDateKey(day);
            const dayAppointments = byDay.get(key) ?? [];
            const today = isSameDay(day, new Date());
            // A closed day is tinted and named. The tint alone would be one more
            // grey among several here; the word is what actually reads.
            const closure = closureFor(day, availability);
            const closed = isClosedDay(day, availability);
            // Leading and trailing days belong to the neighbouring months. They
            // are shown, because a week that stops halfway is worse, but muted
            // so the month being looked at is still obvious.
            const outside = !isSameMonth(day, anchor);

            return (
              <div
                key={key}
                className={cn(
                  // `group` is what the "+" below keys its reveal on. It was
                  // missing, so the button was permanently invisible except
                  // under keyboard focus.
                  'group min-h-24 border-b border-e border-ink-100 p-1 last:border-e-0',
                  outside && 'bg-ink-50/60',
                  closed && !today && 'bg-ink-100/70',
                  today && 'bg-jade-50',
                )}
              >
                <div className="flex items-baseline justify-between gap-1">
                  <span
                    className={cn(
                      'text-xs tabular-nums',
                      today
                        ? 'font-semibold text-jade-800'
                        : outside
                          ? 'text-ink-500'
                          : 'text-ink-700',
                    )}
                  >
                    {format.dateTime(day, { day: 'numeric' })}
                  </span>
                  <button
                    type="button"
                    onClick={() => onAddOn(day)}
                    aria-label={t('new')}
                    // Revealed on hover and on focus within the cell, and shown
                    // outright on a touch screen, where there is no hover to
                    // reveal it with.
                    className="rounded px-1 text-xs text-ink-500 opacity-0 transition-opacity hover:bg-ink-100 hover:text-ink-900 focus-visible:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100 pointer-coarse:opacity-100"
                  >
                    +
                  </button>
                </div>

                {closed ? (
                  <p className="truncate px-1 text-[11px] text-ink-600">
                    {closure?.reason ? closure.reason : t('closedDay')}
                  </p>
                ) : null}

                <ul className="mt-0.5 space-y-0.5">
                  {dayAppointments.slice(0, 3).map((appointment) => (
                    <li key={appointment.id}>
                      <button
                        type="button"
                        onClick={() => onOpen(appointment)}
                        className="flex w-full items-baseline gap-1 rounded px-1 py-0.5 text-start text-[11px] hover:bg-ink-100"
                      >
                        <span dir="ltr" className="shrink-0 tabular-nums text-ink-600">
                          {format.dateTime(new Date(appointment.start_at), 'time')}
                        </span>
                        <span className="min-w-0 truncate text-ink-900">
                          {patientFullName(appointment.patient)}
                        </span>
                      </button>
                    </li>
                  ))}
                  {dayAppointments.length > 3 ? (
                    <li className="px-1 text-[11px] text-ink-600">
                      {t('moreInDay', { count: dayAppointments.length - 3 })}
                    </li>
                  ) : null}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
