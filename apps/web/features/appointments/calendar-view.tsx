'use client';

import { useMemo, useState } from 'react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { CalendarPlus, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button, cn } from '@clinic/ui';
import type { Locale } from '@clinic/domain';
import { usePathname, useRouter } from '@clinic/i18n/navigation';
import type { AppointmentType, AppointmentWithRelations, Patient } from '@clinic/db/types';
import { appointmentTypeName, patientFullName } from '@/lib/display';
import { AppointmentDialog, type AppointmentDraft } from './appointment-dialog';
import {
  addDays,
  addMinutes,
  combineDateAndTime,
  fromDateKey,
  isSameDay,
  minutesSinceMidnight,
  startOfWeek,
  toDateKey,
} from './date-utils';

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
  defaultPatientId,
  openNewOnLoad,
}: {
  appointments: AppointmentWithRelations[];
  patients: Pick<Patient, 'id' | 'full_name'>[];
  appointmentTypes: AppointmentType[];
  practitionerId: string;
  anchorDate: string;
  view: 'week' | 'day';
  defaultPatientId?: string;
  openNewOnLoad?: boolean;
}) {
  const t = useTranslations('appointments');
  const tc = useTranslations('common');
  const format = useFormatter();
  const locale = useLocale() as Locale;
  const isRtl = locale === 'he';
  const router = useRouter();
  const pathname = usePathname();

  const anchor = useMemo(() => fromDateKey(anchorDate), [anchorDate]);
  const days = useMemo(() => {
    if (view === 'day') return [anchor];
    const start = startOfWeek(anchor);
    return Array.from({ length: 7 }, (_, index) => addDays(start, index));
  }, [anchor, view]);

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

  function navigate(offsetDays: number) {
    const next = addDays(anchor, offsetDays);
    router.push({ pathname, query: { date: toDateKey(next), view } });
  }

  function goToday() {
    router.push({ pathname, query: { date: toDateKey(new Date()), view } });
  }

  function switchView(nextView: 'week' | 'day') {
    router.push({ pathname, query: { date: anchorDate, view: nextView } });
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
      : `${format.dateTime(days[0]!, 'short')} – ${format.dateTime(days[days.length - 1]!, 'short')}`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          {/* Chevrons point in reading order: "previous" is towards the start edge. */}
          <Button variant="secondary" size="icon" onClick={() => navigate(view === 'day' ? -1 : -7)} aria-label={tc('back')}>
            {isRtl ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
          <Button variant="secondary" size="icon" onClick={() => navigate(view === 'day' ? 1 : 7)} aria-label={tc('viewAll')}>
            {isRtl ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
          <Button variant="secondary" size="sm" onClick={goToday}>
            {tc('today')}
          </Button>
          <span className="ms-2 text-sm font-medium text-ink-700">{rangeLabel}</span>
        </div>

        <div className="flex items-center gap-1">
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
            size="sm"
            onClick={() => openSlot(view === 'day' ? anchor : days[0]!, 4)}
            className="ms-2"
          >
            <CalendarPlus className="h-4 w-4" />
            {t('new')}
          </Button>
        </div>
      </div>

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
                  <div className={cn('text-xs font-medium', today ? 'text-jade-800' : 'text-ink-600')}>
                    {format.dateTime(day, { weekday: 'short' })}
                  </div>
                  <div className={cn('text-sm', today ? 'font-semibold text-jade-900' : 'text-ink-800')}>
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
                        className="absolute -top-2 end-1.5 text-[11px] text-ink-400 tabular-nums"
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

              return (
                <div
                  key={key}
                  className={cn('relative border-e border-ink-100 last:border-e-0', today && 'bg-jade-50/40')}
                >
                  {/* Clickable background slots. */}
                  {Array.from({ length: SLOT_COUNT }, (_, index) => {
                    const minutes = DAY_START_HOUR * 60 + index * SLOT_MINUTES;
                    return (
                      <button
                        key={index}
                        type="button"
                        onClick={() => openSlot(day, index)}
                        style={{ height: SLOT_HEIGHT }}
                        className={cn(
                          'block w-full transition-colors hover:bg-jade-100/60',
                          minutes % 60 === 0 ? 'border-t border-ink-100' : 'border-t border-ink-50',
                        )}
                        aria-label={`${format.dateTime(day, 'short')} ${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`}
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
                          isCancelled
                            ? 'bg-ink-100 text-ink-400 line-through'
                            : 'text-ink-900',
                        )}
                      >
                        <span className="block truncate text-[11px] font-medium tabular-nums" dir="ltr">
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

      <AppointmentDialog
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
