'use client';

import {
  createContext,
  useContext,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import {
  DndContext,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from '@dnd-kit/core';
import { ChevronLeft, ChevronRight, Info, List, Plus } from 'lucide-react';
import type { Location, Room } from '@clinic/db/types';
import { AppointmentBlock, DRAG_SNAP_MINUTES } from './appointment-block';
import { ConfirmationDot } from './confirmation-status';
import { BlockDayDialog } from './block-day-dialog';
import { DayAddMenu } from './day-add-menu';
import { NowLine } from './now-line';
import {
  Button,
  Dialog,
  DialogContent,
  PageHeader,
  Popover,
  SegmentedControl,
  cn,
  useToast,
} from '@clinic/ui';
import { describeActionError } from '@/lib/action-error';
import { moveAppointment } from './actions';
import { HeaderTools } from '@/components/header-tools';
import { toPaymentSummary, type PaymentStatusRow } from '@/features/billing/payment-summary';
import { DateInput } from '@/components/date-input';
import { PAID_ENTRY_COLOR, dateKeyIn, type Locale } from '@clinic/domain';
import { Link, usePathname, useRouter } from '@clinic/i18n/navigation';
import type { AppointmentType, AppointmentWithRelations, Patient } from '@clinic/db/types';
import { appointmentTypeName, patientFullName } from '@/lib/display';
import { AppointmentDialog, type AppointmentDraft } from './appointment-dialog';
import { AppointmentDetails } from './appointment-details';
import {
  blockedWindowsFor,
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
  rangeGridDays,
  startOfDay,
  startOfMonth,
  startOfWeek,
  toDateKey,
  type CalendarViewMode,
} from './date-utils';
import { formatDate } from '@clinic/i18n';
import {
  DAY_END_HOUR,
  DAY_START_HOUR,
  SLOT_COUNT,
  SLOT_HEIGHT_REM,
  SLOT_MINUTES,
  TOTAL_MINUTES,
  positionDay,
  slotsToRem,
} from './day-layout';

/** The clinic's today as YYYY-MM-DD, for the grids drawn below the view. */
const TodayKey = createContext('');

export function CalendarView({
  appointments,
  payments,
  canBill,
  list,
  renderedAt,
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
  rooms,
  locations,
  reminderTemplate,
  clinicName,
  timeZone,
}: {
  appointments: AppointmentWithRelations[];
  /**
   * Where each booking stands with money, keyed by appointment: paid ones are
   * drawn green, and the details window shows it and marks it. Null for a role
   * that does not see money.
   */
  payments: Record<string, PaymentStatusRow> | null;
  /** When the server drew the page, as ISO: what "already over" is measured from. */
  renderedAt: string;
  canBill: boolean;
  /** The list view, drawn on the server (`DiaryList`); null in every other view. */
  list: React.ReactNode;
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
  /** The rooms bookings go into; empty means the diary has no rooms. */
  rooms: Room[];
  /** The addresses the practice works from; empty means it has one and never says. */
  locations: Location[];
  reminderTemplate: string | null;
  clinicName: string;
  /** The clinic's zone: "today" is its day, not the server's or the browser's. */
  timeZone: string;
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
    // The list is its own table (`DiaryList`) and reads no days from here.
    if (view === 'day' || view === 'list') return [anchor];
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

  // A phone arrives on the day view: the page decides that from the request
  // (see calendar/page.tsx), so nothing here has to draw a week and swap it.

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
  const [blockDay, setBlockDay] = useState<Date | null>(null);
  // A block is read before it is edited: the click opens this, and the edit
  // form is a button inside it.
  const [details, setDetails] = useState<AppointmentWithRelations | null>(null);
  const roomLane = useMemo(
    () =>
      new Map(
        rooms.filter((room) => room.is_active !== false).map((room, index) => [room.id, index]),
      ),
    [rooms],
  );
  const [draft, setDraft] = useState<AppointmentDraft | null>(
    openNewOnLoad
      ? {
          patientId: defaultPatientId,
          start: combineDateAndTime(anchorDate, '09:00'),
          end: addMinutes(combineDateAndTime(anchorDate, '09:00'), defaultDuration),
        }
      : null,
  );

  // A block just dragged shows at its new hour before the server answers;
  // the server's own list, when it arrives, replaces the guess.
  const [moved, setMoved] = useState<Record<string, { start_at: string; end_at: string }>>({});
  const [movedFor, setMovedFor] = useState(appointments);
  if (movedFor !== appointments) {
    setMovedFor(appointments);
    setMoved({});
  }
  const shown = useMemo(
    () =>
      appointments.map((appointment) =>
        moved[appointment.id] ? { ...appointment, ...moved[appointment.id] } : appointment,
      ),
    [appointments, moved],
  );

  const byDay = useMemo(() => {
    const map = new Map<string, AppointmentWithRelations[]>();
    for (const appointment of shown) {
      const key = toDateKey(new Date(appointment.start_at));
      const list = map.get(key);
      if (list) list.push(appointment);
      else map.set(key, [appointment]);
    }
    return map;
  }, [shown]);

  // The page's clock, not the browser's: "over" decided at render in the
  // browser would disagree with the server's HTML for a visit ending between
  // the two, and React would redraw the diary (#418).
  const renderedAtMs = useMemo(() => new Date(renderedAt).getTime(), [renderedAt]);
  // Today by the same clock and on the clinic's calendar: the server runs in UTC,
  // where until two or three in the morning it is still yesterday.
  const todayKey = useMemo(() => dateKeyIn(new Date(renderedAt), timeZone), [renderedAt, timeZone]);
  // The everyday visit — the first type the clinic lists, the one a new
  // booking starts with. Its name on every block said nothing.
  const everydayTypeId = appointmentTypes.find((type) => type.is_active !== false)?.id ?? null;

  const paid = useMemo(
    () =>
      new Set(
        Object.entries(payments ?? {})
          .filter(([, row]) => row.payment_state === 'paid')
          .map(([id]) => id),
      ),
    [payments],
  );

  /*
   * The grid's panel runs to the bottom of the window.
   *
   * It was `100dvh - 14rem`: a guess at what the shell and the toolbar take,
   * which was too much on a desk (a third of the screen under the diary stood
   * empty) and wrong again whenever the sandbox banner or the open-files strip
   * was there. Measured instead, from where the panel actually starts, before
   * the first paint the browser makes of it; the class keeps the guess for the
   * server's HTML, so the bottom edge moves once, down, and nothing above it.
   */
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelHeight, setPanelHeight] = useState<number | null>(null);
  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const measure = () => {
      const top = panel.getBoundingClientRect().top + window.scrollY;
      const bar = document.querySelector<HTMLElement>('[data-tab-bar]');
      const barHeight = bar ? bar.getBoundingClientRect().height : 0;
      // The main column's own bottom padding, so the panel's border shows.
      const gap = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      setPanelHeight(Math.max(320, Math.floor(window.innerHeight - top - barHeight - gap)));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [view]);

  /*
   * A week that is not this week opens on the working morning, not at six.
   * This week, NowLine scrolls to the current hour; any other, the panel used
   * to open at the top of the grid — two shaded hours before anyone works.
   * The earliest of the first open hour and the first booking, half an hour
   * before it.
   */
  const hasToday = days.some((day) => toDateKey(day) === todayKey);
  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel || hasToday) return;
    let first = Number.POSITIVE_INFINITY;
    for (const day of days) {
      const open = openMinutes.get(toDateKey(day));
      if (open && open.length > 0) first = Math.min(first, open[0]!.start);
      for (const appointment of byDay.get(toDateKey(day)) ?? []) {
        first = Math.min(first, minutesSinceMidnight(new Date(appointment.start_at)));
      }
    }
    if (!Number.isFinite(first)) first = 8 * 60;
    const slots = Math.max(0, (first - DAY_START_HOUR * 60) / SLOT_MINUTES - 1);
    const rootPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    panel.scrollTop = slots * SLOT_HEIGHT_REM * rootPx;
    // Only when the dates change: a booking added later must not yank the panel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchorDate, view, hasToday]);

  // Dragging a block. The mouse needs a few pixels of intent so a click
  // still opens the details; a finger needs a moment so a swipe still
  // scrolls the day. The keyboard has a path of its own further down —
  // Space lifts, the arrows step a quarter hour or a day, Space drops —
  // kept out of dnd-kit's keyboard sensor, whose first arrow, pressed
  // before it has measured the block, sent the block across the day.
  const tAll = useTranslations();
  const { toast } = useToast();
  const [, startMove] = useTransition();
  // A stable id for dnd-kit's aria-describedby: its own counter differs between the server and the browser.
  const dndId = useId();
  const dragSensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  );
  const draggedName = (data: Record<string, unknown> | undefined) => {
    const appointment = data?.appointment as AppointmentWithRelations | undefined;
    return appointment ? patientFullName(appointment.patient) : '';
  };
  const dragAnnouncements: Announcements = {
    onDragStart: ({ active }) => t('drag.pickedUp', { patient: draggedName(active.data.current) }),
    onDragOver: () => undefined,
    onDragEnd: ({ active }) => t('drag.dropped', { patient: draggedName(active.data.current) }),
    onDragCancel: ({ active }) =>
      t('drag.cancelled', { patient: draggedName(active.data.current) }),
  };

  /** How far a booking may move and stay on the grid: whole quarter hours, whole days. */
  function moveBounds(appointment: AppointmentWithRelations) {
    const start = new Date(appointment.start_at);
    const duration = new Date(appointment.end_at).getTime() - start.getTime();
    const startMinutes = minutesSinceMidnight(start);
    const dayIndex = days.findIndex((day) => isSameDay(day, start));
    return {
      start,
      duration,
      minMinutes: DAY_START_HOUR * 60 - startMinutes,
      maxMinutes: DAY_END_HOUR * 60 - duration / 60_000 - startMinutes,
      minDays: dayIndex === -1 ? 0 : -dayIndex,
      maxDays: dayIndex === -1 ? 0 : days.length - 1 - dayIndex,
    };
  }
  const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));

  /**
   * Moves a booking by quarter hours and days: shown at once, written, and
   * put back with the overlap message if the hour is taken.
   */
  function applyMove(appointment: AppointmentWithRelations, minuteDelta: number, dayDelta: number) {
    const bounds = moveBounds(appointment);
    const minutes = clamp(minuteDelta, bounds.minMinutes, bounds.maxMinutes);
    const dayShift = clamp(dayDelta, bounds.minDays, bounds.maxDays);
    const nextStart = addMinutes(addDays(bounds.start, dayShift), minutes);
    if (nextStart.getTime() === bounds.start.getTime()) return;
    const nextEnd = new Date(nextStart.getTime() + bounds.duration);

    const times = { start_at: nextStart.toISOString(), end_at: nextEnd.toISOString() };
    setMoved((current) => ({ ...current, [appointment.id]: times }));
    startMove(async () => {
      const result = await moveAppointment(appointment.id, times);
      if (!result.ok) {
        setMoved((current) => {
          const { [appointment.id]: _dropped, ...rest } = current;
          return rest;
        });
        toast({ tone: 'danger', title: describeActionError(tAll, result.error?.key) });
        return;
      }
      toast({
        tone: 'success',
        title: t('drag.moved', {
          date: formatDate(nextStart),
          time: format.dateTime(nextStart, 'time'),
        }),
      });
      router.refresh();
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const data = event.active.data.current as
      { appointment: AppointmentWithRelations; node: { current: HTMLElement | null } } | undefined;
    const appointment = data?.appointment;
    const column = data?.node.current?.closest<HTMLElement>('[data-day-column]');
    if (!appointment || !column) return;
    const rect = column.getBoundingClientRect();
    const slotPx = rect.height / SLOT_COUNT;
    const minuteDelta =
      Math.round(((event.delta.y / slotPx) * SLOT_MINUTES) / DRAG_SNAP_MINUTES) * DRAG_SNAP_MINUTES;
    // Columns run in reading order: a move to the left is a later day in Hebrew.
    const dayDelta =
      days.length > 1 && rect.width > 0
        ? Math.round((isRtl ? -event.delta.x : event.delta.x) / rect.width)
        : 0;
    applyMove(appointment, minuteDelta, dayDelta);
  }

  // The keyboard's move: the lifted block, its offset so far, and a line
  // the screen reader hears at every step.
  const [keyMove, setKeyMove] = useState<{ id: string; minutes: number; days: number } | null>(
    null,
  );
  const [liveText, setLiveText] = useState('');
  function handleBlockKeyDown(
    event: React.KeyboardEvent<HTMLButtonElement>,
    appointment: AppointmentWithRelations,
  ) {
    const name = patientFullName(appointment.patient);
    const current = keyMove?.id === appointment.id ? keyMove : null;
    if (!current) {
      // Enter is the button's: it opens the details. Space lifts.
      if (event.key === ' ') {
        event.preventDefault();
        setKeyMove({ id: appointment.id, minutes: 0, days: 0 });
        setLiveText(t('drag.pickedUp', { patient: name }));
      }
      return;
    }
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      setKeyMove(null);
      setLiveText(t('drag.dropped', { patient: name }));
      applyMove(appointment, current.minutes, current.days);
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      setKeyMove(null);
      setLiveText(t('drag.cancelled', { patient: name }));
      return;
    }
    // Reading order: the next day is to the left in Hebrew.
    const later = isRtl ? 'ArrowLeft' : 'ArrowRight';
    const earlier = isRtl ? 'ArrowRight' : 'ArrowLeft';
    const bounds = moveBounds(appointment);
    let next = current;
    if (event.key === 'ArrowDown') {
      next = {
        ...current,
        minutes: clamp(current.minutes + DRAG_SNAP_MINUTES, bounds.minMinutes, bounds.maxMinutes),
      };
    } else if (event.key === 'ArrowUp') {
      next = {
        ...current,
        minutes: clamp(current.minutes - DRAG_SNAP_MINUTES, bounds.minMinutes, bounds.maxMinutes),
      };
    } else if (event.key === later && days.length > 1) {
      next = { ...current, days: clamp(current.days + 1, bounds.minDays, bounds.maxDays) };
    } else if (event.key === earlier && days.length > 1) {
      next = { ...current, days: clamp(current.days - 1, bounds.minDays, bounds.maxDays) };
    } else {
      return;
    }
    event.preventDefault();
    setKeyMove(next);
    const at = addMinutes(addDays(bounds.start, next.days), next.minutes);
    setLiveText(
      next.days ? `${formatDate(at)} ${format.dateTime(at, 'time')}` : format.dateTime(at, 'time'),
    );
  }

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
    router.push({ pathname, query: { date: dateKeyIn(new Date(), timeZone), view } });
  }

  function switchView(nextView: CalendarViewMode) {
    if (nextView === 'range') {
      // Opening the range view with nothing chosen would show a blank panel, so
      // it starts on the fortnight around today and is edited from there.
      router.push({
        pathname,
        query: {
          view: 'range',
          from: rangeFrom ?? toDateKey(addDays(fromDateKey(todayKey), -7)),
          to: rangeTo ?? toDateKey(addDays(fromDateKey(todayKey), 7)),
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

  /**
   * "New appointment" from the page header, with nothing clicked.
   *
   * The day is the one being looked at: today if it is in view, otherwise
   * the first day shown. The time is the next half hour when that day is
   * today, or the start of the working day — not a fixed 09:00 on the first
   * day of the week, which is what this used to draft in every view.
   */
  function openNew() {
    const now = new Date();
    const day =
      view === 'day' ? anchor : (days.find((candidate) => isSameDay(candidate, now)) ?? days[0]!);
    const open = openMinutes.get(toDateKey(day));
    const dayStart = open && open.length > 0 ? open[0]!.start : DAY_START_HOUR * 60;
    let minutes = dayStart;
    if (isSameDay(day, now)) {
      const next = Math.ceil(minutesSinceMidnight(now) / SLOT_MINUTES) * SLOT_MINUTES;
      minutes = Math.max(dayStart, next);
    }
    const clamped = Math.min(
      Math.max(minutes, DAY_START_HOUR * 60),
      DAY_END_HOUR * 60 - SLOT_MINUTES,
    );
    openSlot(day, (clamped - DAY_START_HOUR * 60) / SLOT_MINUTES);
  }

  function openAppointment(appointment: AppointmentWithRelations) {
    setDraft({
      id: appointment.id,
      patientId: appointment.patient_id,
      typeId: appointment.appointment_type_id,
      start: new Date(appointment.start_at),
      end: new Date(appointment.end_at),
      status: appointment.status,
      roomId: appointment.room_id,
      location: appointment.location,
      locationId: appointment.location_id,
      reminderSentAt: appointment.reminder_sent_at,
      confirmationToken: appointment.confirmation_token,
      confirmationResponse: appointment.confirmation_response,
      respondedAt: appointment.responded_at,
      patientPhone: appointment.patient?.phone ?? null,
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

  /*
   * One row, not three.
   *
   * The title, the stepping, the view switch and "new" used to sit on two rows
   * with the legend on a third, and on a laptop the three of them took the
   * height of four hours of the diary. Now the stepping and the dates sit
   * beside the title, the switches and "new" at the far end, and the legend
   * folds behind its own button.
   */
  const stepping =
    view === 'list' ? null : view !== 'range' ? (
      <div className="flex flex-wrap items-center gap-1">
        {/* Chevrons point in reading order: "previous" is towards the start edge. */}
        <Button
          variant="secondary"
          size="icon"
          onClick={() => navigate(-1)}
          aria-label={t('previousPeriod')}
          title={t('previousPeriod')}
        >
          {isRtl ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
        <Button
          variant="secondary"
          size="icon"
          onClick={() => navigate(1)}
          aria-label={t('nextPeriod')}
          title={t('nextPeriod')}
        >
          {isRtl ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Button>
        <Button variant="secondary" onClick={goToday}>
          {tc('today')}
        </Button>
        <span className="ms-1 text-sm font-medium text-ink-700">{rangeLabel}</span>
        {/* A diary with no working hours looks exactly like one with them —
            nothing is shaded either way — so the difference is said here. */}
        {availability.blocks.length === 0 && availability.exceptions.length === 0 ? (
          <Link
            href="/account/schedule"
            className="ms-2 text-xs font-medium text-amber-700 underline-offset-2 hover:underline"
          >
            {t('noHoursHint')}
          </Link>
        ) : null}
      </div>
    ) : (
      // The range view is anchored to its own two dates, so stepping and
      // "today" have nothing to act on and are replaced by the dates.
      <div className="flex flex-wrap items-center gap-1.5">
        <DateInput
          compact={false}
          aria-label={tFilters('from')}
          value={rangeFrom ?? toDateKey(days[0]!)}
          max={rangeTo ?? undefined}
          onChange={(event) => setRangeBound('from', event.target.value)}
        />
        <span className="text-sm text-ink-600">–</span>
        <DateInput
          compact={false}
          aria-label={tFilters('to')}
          value={rangeTo ?? toDateKey(days[days.length - 1]!)}
          min={rangeFrom ?? undefined}
          onChange={(event) => setRangeBound('to', event.target.value)}
        />
        <span className="ms-1 text-sm text-ink-600">
          {t('countInView', { count: totalInView })}
        </span>
      </div>
    );

  return (
    <TodayKey.Provider value={todayKey}>
      <PageHeader
        title={t('title')}
        aside={
          <>
            {stepping}
            {isTimeGrid ? (
              <CalendarLegend appointmentTypes={appointmentTypes} locale={locale} />
            ) : null}
          </>
        }
        className="mb-3"
        actions={
          <>
            {/* Shown at every width: a phone merely starts on the day. */}
            <SegmentedControl
              label={t('views.label')}
              size="md"
              value={view}
              onChange={(next) => switchView(next)}
              options={[
                { value: 'day', label: t('views.day') },
                { value: 'week', label: t('views.week') },
                { value: 'month', label: t('views.month') },
                { value: 'range', label: t('views.range') },
              ]}
            />
            {/* The list is a different kind of view — a table of what was done,
                not a stretch of time — so it is its own control, beside the
                others rather than one of them. */}
            <SegmentedControl
              label={t('views.list')}
              size="md"
              iconOnly
              value={view}
              onChange={(next) => switchView(next)}
              options={[
                {
                  value: 'list',
                  label: t('views.list'),
                  icon: <List className="h-4 w-4" aria-hidden />,
                },
              ]}
            />
            <Button onClick={openNew}>
              <Plus className="h-4 w-4" />
              {t('new')}
            </Button>
          </>
        }
      />
      <div className="space-y-3">
        {view === 'list' ? (
          list
        ) : !isTimeGrid ? (
          <MonthOrRangeView
            days={days}
            view={view}
            anchor={anchor}
            byDay={byDay}
            availability={availability}
            locale={locale}
            onOpen={setDetails}
            onAddOn={(day) => openSlot(day, 4)}
            onBlockOn={(day) => setBlockDay(day)}
          />
        ) : (
          // The hours scroll inside this panel, under a day row that stays
          // put, and the panel opens on the current time (NowLine scrolls it).
          // It used to be as tall as the day, so on a phone the whole page
          // scrolled and the day names left with it. The height is what the
          // window leaves after the shell and the toolbar; the floor keeps a
          // short window from squashing it to nothing. A week's grid is wider
          // than a phone and scrolls sideways inside the same panel.
          <DndContext
            id={dndId}
            sensors={dragSensors}
            onDragEnd={handleDragEnd}
            accessibility={{
              announcements: dragAnnouncements,
              screenReaderInstructions: { draggable: t('drag.instructions') },
            }}
          >
            <div
              data-time-grid
              data-scroll-panel
              ref={panelRef}
              // A max-height, not a height, so the print rule (`max-height: none !important`) still lays the whole day out.
              style={panelHeight ? { maxHeight: panelHeight } : undefined}
              className="max-h-[calc(100dvh-var(--bottom-bar,0px)-11rem)] min-h-[20rem] overflow-auto overscroll-contain rounded-card border border-ink-200 bg-white"
            >
              {/* What the keyboard's move says, for a screen reader. */}
              <p aria-live="assertive" role="status" className="sr-only">
                {liveText}
              </p>
              <div className={cn(days.length > 1 && 'min-w-[720px]')}>
                {/* Header row: time gutter + one cell per day. */}
                <div
                  className="sticky top-0 z-20 grid border-b border-ink-200 bg-white"
                  style={{ gridTemplateColumns: `4rem repeat(${days.length}, minmax(0, 1fr))` }}
                >
                  <div className="border-e border-ink-100" />
                  {days.map((day) => {
                    const today = toDateKey(day) === todayKey;
                    return (
                      <div
                        key={day.toISOString()}
                        className={cn(
                          'relative border-e border-ink-100 px-2 py-1 text-center last:border-e-0',
                          today && 'bg-jade-50',
                        )}
                      >
                        {/* One line — the weekday and the date side by side — where it
                            was two: the row is sticky, and every line it holds is a line
                            of the diary it hides. */}
                        <div
                          className={cn(
                            'flex items-baseline justify-center gap-1.5 text-sm leading-6',
                            today ? 'text-jade-900' : 'text-ink-800',
                          )}
                        >
                          <span
                            className={cn(
                              'text-xs font-medium',
                              today ? 'text-jade-800' : 'text-ink-600',
                            )}
                          >
                            {format.dateTime(day, { weekday: 'short' })}
                          </span>
                          <span
                            className={cn('tabular-nums', today ? 'font-semibold' : 'font-medium')}
                          >
                            {format.dateTime(day, { day: 'numeric', month: 'numeric' })}
                          </span>
                        </div>
                        {/* Book someone on this day, or close it — in the corner,
                        out of the way of the date. */}
                        <DayAddMenu
                          onNew={() => openSlot(day, 4)}
                          onBlock={() => setBlockDay(day)}
                          blocked={
                            Boolean(closureFor(day, availability)) ||
                            blockedWindowsFor(day, availability).length > 0
                          }
                          className="absolute top-1 end-1"
                        />
                      </div>
                    );
                  })}
                </div>

                {/* Body: time gutter + day columns with absolutely-placed events.
                The top padding gives the first hour's label room under the
                sticky row. */}
                <div
                  className="grid pt-2"
                  style={{ gridTemplateColumns: `4rem repeat(${days.length}, minmax(0, 1fr))` }}
                >
                  <div className="border-e border-ink-100">
                    {Array.from({ length: SLOT_COUNT }, (_, index) => {
                      const minutes = DAY_START_HOUR * 60 + index * SLOT_MINUTES;
                      const isHour = minutes % 60 === 0;
                      return (
                        <div
                          key={index}
                          style={{ height: slotsToRem(1) }}
                          className={cn('relative', isHour && 'border-t border-ink-100')}
                        >
                          {isHour ? (
                            <span
                              className="absolute -top-2 end-1.5 text-xs font-medium text-ink-600 tabular-nums"
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
                    const positioned = positionDay(dayAppointments, roomLane);
                    const today = toDateKey(day) === todayKey;
                    // Undefined means no schedule has been set, which shades nothing.
                    const open = openMinutes.get(key);

                    return (
                      <div
                        key={key}
                        data-day-column
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
                            !open ||
                            open.some(({ start, end }) => minutes >= start && minutes < end);
                          return (
                            <button
                              key={index}
                              type="button"
                              // Not a tab stop: 210 half-hour slots between the toolbar and
                              // the next control. The day's "+" menu is the keyboard's way in.
                              tabIndex={-1}
                              onClick={() => openSlot(day, index)}
                              style={{ height: slotsToRem(1) }}
                              className={cn(
                                // Light blue, the family of the bookings themselves: "a
                                // booking would go here". It was jade, the green that
                                // now means paid.
                                'block w-full transition-colors hover:bg-sky-50',
                                minutes % 60 === 0
                                  ? 'border-t border-ink-100'
                                  : 'border-t border-ink-50',
                                !working && 'bg-ink-100/70',
                              )}
                              aria-label={`${formatDate(day)} ${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}${working ? '' : ' · ' + t('outsideHours')}`}
                              title={`${formatDate(day)} ${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}${working ? '' : ' · ' + t('outsideHours')}`}
                            />
                          );
                        })}

                        {/* Hours away, drawn over the slots with their reason. The
                        slots stay clickable underneath: a block is a warning,
                        not a wall. */}
                        {blockedWindowsFor(day, availability).map((window) => {
                          const start = Math.max(0, window.start - DAY_START_HOUR * 60);
                          const end = Math.min(TOTAL_MINUTES, window.end - DAY_START_HOUR * 60);
                          if (end <= start) return null;
                          return (
                            <div
                              key={window.id}
                              aria-hidden
                              className="pointer-events-none absolute inset-x-0 z-[1] overflow-hidden border-y border-ink-300/60 px-1.5 py-0.5 text-xs leading-tight text-ink-600"
                              style={{
                                top: slotsToRem(start / SLOT_MINUTES),
                                height: slotsToRem((end - start) / SLOT_MINUTES),
                                backgroundImage:
                                  // Mixed from the ink colour, not from black: black on a dark
                                  // surface is nothing, and a closed afternoon read as open.
                                  'repeating-linear-gradient(135deg, color-mix(in srgb, var(--color-ink-900) 6%, transparent) 0 6px, color-mix(in srgb, var(--color-ink-900) 13%, transparent) 6px 8px)',
                              }}
                            >
                              <span className="truncate" dir="auto">
                                {window.reason ?? t('blockDay')}
                              </span>
                            </div>
                          );
                        })}

                        {today ? (
                          <NowLine
                            dayStartHour={DAY_START_HOUR}
                            slotMinutes={SLOT_MINUTES}
                            slotHeightRem={SLOT_HEIGHT_REM}
                            slotCount={SLOT_COUNT}
                          />
                        ) : null}

                        {positioned.map(({ appointment, top, height, column, columns }) => (
                          <AppointmentBlock
                            key={appointment.id}
                            appointment={appointment}
                            paid={paid.has(appointment.id)}
                            past={new Date(appointment.end_at).getTime() < renderedAtMs}
                            showType={appointment.appointment_type_id !== everydayTypeId}
                            top={top}
                            height={height}
                            column={column}
                            columns={columns}
                            // A week's column split into lanes leaves room for a
                            // name and an hour, and nothing else: the room is the
                            // lane and the stripe, the type is the tint, and the
                            // rest is one click away in the details.
                            narrow={days.length > 1 && columns > 1}
                            locale={locale}
                            slotHeightRem={SLOT_HEIGHT_REM}
                            slotMinutes={SLOT_MINUTES}
                            onOpen={() => setDetails(appointment)}
                            keyOffset={keyMove?.id === appointment.id ? keyMove : null}
                            onKeyDown={(event) => handleBlockKeyDown(event, appointment)}
                            onBlur={() => {
                              // Tabbing away mid-move is a cancel, said only by the block settling.
                              if (keyMove?.id === appointment.id) setKeyMove(null);
                            }}
                          />
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </DndContext>
        )}

        <AppointmentDetails
          appointment={details}
          locale={locale}
          onClose={() => setDetails(null)}
          payment={details && payments ? toPaymentSummary(payments[details.id]) : null}
          canBill={canBill}
          onEdit={(appointment) => {
            setDetails(null);
            openAppointment(appointment);
          }}
        />
        <AppointmentDialog
          availability={availability}
          open={dialogOpen}
          draft={draft}
          patients={patients}
          appointmentTypes={appointmentTypes}
          rooms={rooms}
          locations={locations}
          reminderTemplate={reminderTemplate}
          clinicName={clinicName}
          practitionerId={practitionerId}
          onOpenChange={setDialogOpen}
        />
        <BlockDayDialog
          day={blockDay}
          existing={
            blockDay
              ? (availability.exceptions.find((entry) => entry.date === toDateKey(blockDay)) ??
                null)
              : null
          }
          availability={availability}
          onOpenChange={(open) => !open && setBlockDay(null)}
        />
      </div>
    </TodayKey.Provider>
  );
}

/**
 * What the colours mean, said in words above the grid: the tint on a block is
 * its treatment type, the dot is whether the patient said they are coming. A
 * legend the diary carries itself, rather than a convention to remember.
 *
 * The rooms used to be here too, as a stripe down the edge of every block and a
 * row of colour keys above the week. Three colour systems on one grid is two
 * more than anyone reads, and which room a treatment is in is a question asked
 * by opening the booking, not by scanning the week. The stripe and its key are
 * both gone; the room is still on the block and in the details.
 */
function CalendarLegend({
  appointmentTypes,
  locale,
}: {
  appointmentTypes: AppointmentType[];
  locale: Locale;
}) {
  const t = useTranslations('appointments.legend');
  const tConfirmation = useTranslations('appointments.confirmation');
  const activeTypes = appointmentTypes.filter((type) => type.is_active !== false);
  const swatch = (background: string, border: string) => (
    <span
      aria-hidden
      className="h-3 w-3 shrink-0 rounded-sm border"
      style={{ backgroundColor: background, borderColor: border }}
    />
  );
  // Short words on the row, the full sentence as the title and in the panel.
  const dots = [
    { key: 'none', dot: 'border border-ink-300' },
    { key: 'sent', dot: 'bg-amber-500' },
    { key: 'confirmed', dot: 'bg-jade-600' },
    { key: 'declined', dot: 'bg-red-600' },
  ] as const;
  const body = (short: boolean) => (
    <>
      {activeTypes.length > 1
        ? activeTypes.map((type) => (
            <span key={type.id} className="inline-flex items-center gap-1">
              {swatch(`${type.color}33`, type.color)}
              {appointmentTypeName(type, locale)}
            </span>
          ))
        : null}
      <span className="inline-flex items-center gap-1">
        {swatch('var(--color-jade-100)', PAID_ENTRY_COLOR)}
        {t('paid')}
      </span>
      {dots.map(({ key, dot }) => (
        <span key={key} className="inline-flex items-center gap-1" title={tConfirmation(key)}>
          <span aria-hidden className={cn('h-2.5 w-2.5 shrink-0 rounded-full', dot)} />
          {short ? t(`short.${key}`) : tConfirmation(key)}
        </span>
      ))}
    </>
  );
  /*
   * Always in sight where the screen is wide: in the top bar, whose middle
   * stands empty — so it is read without a click and costs the diary no
   * height. It sat beside the dates first and pushed the view switch onto a
   * second row. Narrower than that, behind its button.
   */
  return (
    <>
      <HeaderTools slotId="top-bar-tools">
        <p
          aria-label={t('title')}
          className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-600"
        >
          {body(true)}
        </p>
      </HeaderTools>
      <Popover
        width={300}
        align="end"
        triggerLabel={t('title')}
        triggerTitle={t('title')}
        panelLabel={t('title')}
        className="xl:hidden"
        triggerClassName="inline-flex h-10 items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-3 text-sm font-medium text-ink-700 shadow-xs transition-colors hover:bg-ink-50 hover:text-ink-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        triggerContent={
          <>
            <Info className="h-4 w-4" aria-hidden />
            <span className="max-sm:sr-only">{t('title')}</span>
          </>
        }
      >
        <div className="flex flex-col gap-2 p-1 text-xs text-ink-600">{body(false)}</div>
      </Popover>
    </>
  );
}

/**
 * Month and chosen-range views.
 *
 * Neither is a time grid. Thirty days of a time grid at any usable width gives
 * columns too narrow to hold a patient's name, and the question being asked
 * over a month is not "what is the shape of Tuesday afternoon" but "which days
 * have something in them, and what".
 *
 * The month keeps the calendar's shape — seven columns, whole weeks — because
 * that shape is how a month is read. A chosen range can be read either way and
 * the answer depends on the span: a fortnight has a shape worth seeing, a list
 * of the six days that actually hold something is the faster answer for a
 * quarter. So the range offers both, and remembers nothing — the choice is a
 * glance, not a setting.
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
  onBlockOn,
}: {
  days: Date[];
  view: CalendarViewMode;
  anchor: Date;
  byDay: Map<string, AppointmentWithRelations[]>;
  availability: Availability;
  locale: Locale;
  onOpen: (appointment: AppointmentWithRelations) => void;
  onAddOn: (day: Date) => void;
  onBlockOn: (day: Date) => void;
}) {
  const t = useTranslations('appointments');
  const format = useFormatter();
  const [rangeLayout, setRangeLayout] = useState<'list' | 'calendar'>('list');

  if (view === 'range') {
    const withSomething = days.filter((day) => (byDay.get(toDateKey(day))?.length ?? 0) > 0);
    const first = days[0];
    const last = days.at(-1);
    const inRange = (day: Date) =>
      Boolean(first && last && day >= startOfDay(first) && day <= startOfDay(last));

    // The dates were chosen, and either shape is a fair answer to them.
    const layoutSwitch = (
      <div className="flex justify-end">
        <SegmentedControl
          label={t('rangeLayout.label')}
          value={rangeLayout}
          onChange={setRangeLayout}
          options={[
            { value: 'list', label: t('rangeLayout.list') },
            { value: 'calendar', label: t('rangeLayout.calendar') },
          ]}
        />
      </div>
    );

    if (rangeLayout === 'calendar' && first && last) {
      return (
        <div className="space-y-3">
          {layoutSwitch}
          <MonthGrid
            days={rangeGridDays(first, last)}
            // Outside the *range*, not outside a month: the padding days that
            // only exist so the weeks line up.
            isOutside={(day) => !inRange(day)}
            byDay={byDay}
            availability={availability}
            onOpen={onOpen}
            onAddOn={onAddOn}
            onBlockOn={onBlockOn}
          />
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {layoutSwitch}
        {withSomething.length === 0 ? (
          <div className="rounded-card border border-ink-200 bg-white p-8 text-center text-sm text-ink-600">
            {t('noneInRange')}
          </div>
        ) : (
          <div className="space-y-2">
            {withSomething.map((day) => (
              <section
                key={day.toISOString()}
                className="rounded-card border border-ink-200 bg-white"
              >
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
                        <ConfirmationDot appointment={appointment} className="self-center" />
                        <span
                          dir="ltr"
                          className="shrink-0 font-semibold tabular-nums text-ink-800"
                        >
                          {format.dateTime(new Date(appointment.start_at), 'time')}
                        </span>
                        <span className="min-w-0 flex-1 truncate font-medium text-ink-900">
                          {patientFullName(appointment.patient)}
                        </span>
                        {appointment.room ? (
                          <span className="shrink-0 truncate text-xs text-ink-600">
                            {appointment.room.name}
                          </span>
                        ) : null}
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
        )}
      </div>
    );
  }

  return (
    <MonthGrid
      days={days}
      isOutside={(day) => !isSameMonth(day, anchor)}
      byDay={byDay}
      availability={availability}
      onOpen={onOpen}
      onAddOn={onAddOn}
      onBlockOn={onBlockOn}
    />
  );
}

/**
 * Seven columns of whole weeks, used by the month and by a range asked to look
 * like one.
 *
 * A cell holds three bookings and then says how many more there are. That count
 * used to be a sentence you could not act on — the day was full and the only
 * way to read it was to switch to the day view and navigate to it. It opens the
 * day now: every booking, the hour and the name, in the order they happen.
 */
function MonthGrid({
  days,
  isOutside,
  byDay,
  availability,
  onOpen,
  onAddOn,
  onBlockOn,
}: {
  days: Date[];
  /** Days drawn muted: another month, or padding around a chosen range. */
  isOutside: (day: Date) => boolean;
  byDay: Map<string, AppointmentWithRelations[]>;
  availability: Availability;
  onOpen: (appointment: AppointmentWithRelations) => void;
  onAddOn: (day: Date) => void;
  onBlockOn: (day: Date) => void;
}) {
  const t = useTranslations('appointments');
  const tc = useTranslations('common');
  const format = useFormatter();
  const [dayOpen, setDayOpen] = useState<Date | null>(null);
  const todayKey = useContext(TodayKey);

  const dayOpenAppointments = dayOpen ? (byDay.get(toDateKey(dayOpen)) ?? []) : [];

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
            const today = toDateKey(day) === todayKey;
            // A closed day is tinted, and says something only when there is
            // something to say. "Closed" under every Saturday and every day off
            // is a word repeated ten times a month that carries no information
            // the grey does not; a closure with a reason written on it — a
            // holiday, a course — is the opposite, and keeps its line.
            const closure = closureFor(day, availability);
            const closed = isClosedDay(day, availability);
            const dayWindows = blockedWindowsFor(day, availability);
            // Leading and trailing days belong to the neighbouring months, or to
            // the weeks a chosen range only partly covers. They are shown,
            // because a week that stops halfway is worse, but muted so what is
            // being looked at is still obvious.
            const outside = isOutside(day);

            return (
              <div
                key={key}
                className={cn(
                  // `group` is what the "+" below keys its reveal on. It was
                  // missing, so the button was permanently invisible except
                  // under keyboard focus.
                  'group relative min-h-24 border-b border-e border-ink-100 p-1 last:border-e-0',
                  outside && 'bg-ink-50/60',
                  closed && !today && 'bg-ink-100/70',
                  today && 'bg-jade-50',
                )}
              >
                <span
                  className={cn(
                    'block px-1 text-sm font-medium tabular-nums',
                    today
                      ? 'font-semibold text-jade-800'
                      : outside
                        ? 'text-ink-500'
                        : 'text-ink-700',
                  )}
                >
                  {format.dateTime(day, { day: 'numeric' })}
                </span>
                {/* In the corner. Revealed on hover and on focus within the
                    cell, and shown outright on a touch screen, where there is
                    no hover to reveal it with. */}
                <DayAddMenu
                  onNew={() => onAddOn(day)}
                  onBlock={() => onBlockOn(day)}
                  blocked={Boolean(closure) || dayWindows.length > 0}
                  className="absolute top-1 end-1 opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100 pointer-coarse:opacity-100"
                />

                {dayWindows.length > 0 && !closed ? (
                  <ul className="px-1">
                    {dayWindows.slice(0, 2).map((window) => (
                      <li key={window.id} className="truncate text-xs text-ink-600" dir="auto">
                        <span dir="ltr" className="tabular-nums">
                          {String(Math.floor(window.start / 60)).padStart(2, '0')}:
                          {String(window.start % 60).padStart(2, '0')}
                        </span>{' '}
                        {window.reason ?? t('blockDay')}
                      </li>
                    ))}
                  </ul>
                ) : null}

                {closed && closure?.reason ? (
                  <p className="truncate px-1 text-xs text-ink-600">{closure.reason}</p>
                ) : null}

                <ul className="mt-0.5 space-y-0.5">
                  {dayAppointments.slice(0, 3).map((appointment) => (
                    <li key={appointment.id}>
                      <button
                        type="button"
                        onClick={() => onOpen(appointment)}
                        className="flex w-full items-baseline gap-1 rounded px-1 py-0.5 text-start text-xs hover:bg-ink-100"
                      >
                        <ConfirmationDot
                          appointment={appointment}
                          className="h-2 w-2 self-center"
                        />
                        <span dir="ltr" className="shrink-0 font-medium tabular-nums text-ink-700">
                          {format.dateTime(new Date(appointment.start_at), 'time')}
                        </span>
                        <span className="min-w-0 truncate text-ink-900">
                          {patientFullName(appointment.patient)}
                        </span>
                      </button>
                    </li>
                  ))}
                  {dayAppointments.length > 3 ? (
                    <li>
                      <button
                        type="button"
                        onClick={() => setDayOpen(day)}
                        className="w-full rounded px-1 py-0.5 text-start text-xs text-ink-600 underline-offset-2 hover:bg-ink-100 hover:text-ink-900 hover:underline"
                      >
                        {t('moreInDay', { count: dayAppointments.length - 3 })}
                      </button>
                    </li>
                  ) : null}
                </ul>
              </div>
            );
          })}
        </div>
      </div>

      {/* The whole day, opened from the count. Hour and name only: this answers
          "what else is in there", and every line opens the booking itself. */}
      <Dialog open={dayOpen !== null} onOpenChange={(open) => !open && setDayOpen(null)}>
        {dayOpen ? (
          <DialogContent
            title={format.dateTime(dayOpen, 'weekday')}
            description={t('countInDay', { count: dayOpenAppointments.length })}
            closeLabel={tc('close')}
            className="max-w-sm"
          >
            <ul className="divide-y divide-ink-100">
              {dayOpenAppointments.map((appointment) => (
                <li key={appointment.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setDayOpen(null);
                      onOpen(appointment);
                    }}
                    className="flex w-full items-baseline gap-2.5 rounded px-1 py-2 text-start text-sm hover:bg-ink-50"
                  >
                    <ConfirmationDot appointment={appointment} className="self-center" />
                    <span dir="ltr" className="shrink-0 font-semibold tabular-nums text-ink-800">
                      {format.dateTime(new Date(appointment.start_at), 'time')}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-ink-900">
                      {patientFullName(appointment.patient)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  );
}
