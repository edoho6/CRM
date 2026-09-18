'use client';

import { useState } from 'react';

import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { Badge } from '@clinic/ui';
import { defineWidget } from '@clinic/domain/widgets';
import {
  APPOINTMENT_STATUS_TONES,
  DEFAULT_ENTRY_COLOR,
  dayBoundsIn,
  statusTone,
  type Locale,
} from '@clinic/domain';
import { Link } from '@clinic/i18n/navigation';
import { useAsyncData } from '@/lib/use-supabase';
import { appointmentTypeName, patientFullName } from '@/lib/display';
import { registerWidget } from '../registry';
import { WidgetEmpty, WidgetLoading, WidgetError } from '../widget-frame';
import { useDashboardContext, useWidgetInitialData } from '../dashboard-context';
import {
  fetchTodayAppointments,
  fetchUpcomingAppointments,
  upcomingHorizon,
  type AppointmentRow,
} from '../queries/appointments';
import { formatDate } from '@clinic/i18n';

/** A dashboard tile shows a handful and points at the diary for the rest. */
const APPOINTMENT_LIMIT = 6;

function AppointmentList({
  rows,
  emptyLabel,
  showDate,
}: {
  rows: AppointmentRow[];
  emptyLabel: string;
  showDate?: boolean;
}) {
  const locale = useLocale() as Locale;
  const format = useFormatter();
  const tStatus = useTranslations('appointments.status');
  const tc = useTranslations('common');

  if (rows.length === 0) {
    return <WidgetEmpty>{emptyLabel}</WidgetEmpty>;
  }

  return (
    <>
      <ul className="divide-y divide-ink-100">
        {rows.slice(0, APPOINTMENT_LIMIT).map((row) => (
          <li key={row.id}>
            <Link
              href={{ pathname: '/calendar', query: { date: row.start_at.slice(0, 10) } }}
              className="flex items-center gap-3 py-2 transition-colors hover:bg-ink-50"
            >
              <span
                aria-hidden
                className="h-8 w-1 shrink-0 rounded-full"
                style={{ backgroundColor: row.appointment_type?.color ?? DEFAULT_ENTRY_COLOR }}
              />
              <span
                className="w-24 shrink-0 text-xs font-medium text-ink-700 tabular-nums"
                dir="ltr"
              >
                {showDate
                  ? formatDate(new Date(row.start_at))
                  : format.dateTime(new Date(row.start_at), 'time')}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-ink-900">
                  {patientFullName(row.patient)}
                </span>
                <span className="block truncate text-xs text-ink-500">
                  {appointmentTypeName(row.appointment_type, locale)}
                </span>
              </span>
              <Badge tone={statusTone(APPOINTMENT_STATUS_TONES, row.status)}>
                {tStatus(row.status)}
              </Badge>
            </Link>
          </li>
        ))}
      </ul>
      {rows.length > APPOINTMENT_LIMIT ? (
        <Link
          href="/calendar"
          className="mt-1 flex items-center justify-center gap-1 rounded-md py-1.5 text-xs font-medium text-jade-800 underline-offset-2 hover:bg-jade-50 hover:underline"
        >
          {tc('viewAll')}
        </Link>
      ) : null}
    </>
  );
}

function TodayAppointmentsWidget() {
  const t = useTranslations('widgets.todayAppointments');
  const { timeZone } = useDashboardContext();
  // Fixed once per mount, and in the clinic's zone: the day as the clinic
  // counts it, wherever this happens to render.
  const [{ start, end }] = useState(() => {
    const bounds = dayBoundsIn(new Date(), timeZone);
    return { start: bounds.start.toISOString(), end: bounds.end.toISOString() };
  });
  const initial = useWidgetInitialData<AppointmentRow[]>('today-appointments');
  const { data, loading, error, reload } = useAsyncData<AppointmentRow[]>(
    (supabase) => fetchTodayAppointments(supabase, start, end),
    [start, end],
    { initial },
  );

  if (loading) return <WidgetLoading />;
  if (error && !data) return <WidgetError onRetry={reload} />;
  return <AppointmentList rows={data ?? []} emptyLabel={t('empty')} />;
}

function UpcomingAppointmentsWidget() {
  const t = useTranslations('widgets.upcomingAppointments');
  // Fixed once per mount. Taken on every render, "now" moved by a few
  // milliseconds each time, the dependencies changed, the fetch ran again,
  // the spinner came back, and the widget twitched without end.
  const [{ from, to }] = useState(() => {
    const now = new Date();
    return { from: now.toISOString(), to: upcomingHorizon(now).toISOString() };
  });
  const initial = useWidgetInitialData<AppointmentRow[]>('upcoming-appointments');
  const { data, loading, error, reload } = useAsyncData<AppointmentRow[]>(
    (supabase) => fetchUpcomingAppointments(supabase, from, to),
    [from, to],
    { initial },
  );

  if (loading) return <WidgetLoading />;
  if (error && !data) return <WidgetError onRetry={reload} />;
  return <AppointmentList rows={data ?? []} emptyLabel={t('empty')} showDate />;
}

registerWidget(
  defineWidget<Record<string, never>>({
    type: 'today-appointments',
    icon: 'CalendarClock',
    defaultSize: 'lg',
    defaultConfig: {},
    component: TodayAppointmentsWidget,
    singleton: true,
  }),
);

registerWidget(
  defineWidget<Record<string, never>>({
    type: 'upcoming-appointments',
    icon: 'CalendarRange',
    defaultSize: 'lg',
    defaultConfig: {},
    component: UpcomingAppointmentsWidget,
    singleton: true,
  }),
);
