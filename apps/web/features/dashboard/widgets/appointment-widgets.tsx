'use client';

import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { Badge } from '@clinic/ui';
import { defineWidget } from '@clinic/domain/widgets';
import type { Locale } from '@clinic/domain';
import { Link } from '@clinic/i18n/navigation';
import { useAsyncData } from '@/lib/use-supabase';
import { appointmentTypeName, patientFullName } from '@/lib/display';
import { registerWidget } from '../registry';
import { WidgetEmpty, WidgetLoading } from '../widget-frame';

interface AppointmentRow {
  id: string;
  start_at: string;
  end_at: string;
  status: string;
  patient: { id: string; first_name: string; last_name: string; full_name: string } | null;
  appointment_type: { name_he: string; name_en: string; color: string } | null;
}

const SELECT =
  'id, start_at, end_at, status, patient:patients(id, first_name, last_name, full_name), appointment_type:appointment_types(name_he, name_en, color)';

function statusTone(status: string) {
  switch (status) {
    case 'completed':
      return 'success' as const;
    case 'cancelled':
    case 'no_show':
      return 'danger' as const;
    case 'checked_in':
      return 'info' as const;
    default:
      return 'neutral' as const;
  }
}

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

  if (rows.length === 0) {
    return <WidgetEmpty>{emptyLabel}</WidgetEmpty>;
  }

  return (
    <ul className="divide-y divide-ink-100">
      {rows.map((row) => (
        <li key={row.id}>
          <Link
            href={{ pathname: '/calendar', query: { date: row.start_at.slice(0, 10) } }}
            className="flex items-center gap-3 py-2 transition-colors hover:bg-ink-50"
          >
            <span
              aria-hidden
              className="h-8 w-1 shrink-0 rounded-full"
              style={{ backgroundColor: row.appointment_type?.color ?? '#cbd5e1' }}
            />
            <span className="w-24 shrink-0 text-xs font-medium text-ink-700 tabular-nums" dir="ltr">
              {showDate
                ? format.dateTime(new Date(row.start_at), 'short')
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
            <Badge tone={statusTone(row.status)}>{tStatus(row.status)}</Badge>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Start and end of "today" in the browser's local time. */
function todayBounds() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

function TodayAppointmentsWidget() {
  const t = useTranslations('widgets.todayAppointments');
  const { start, end } = todayBounds();

  const { data, loading } = useAsyncData<AppointmentRow[]>(
    async (supabase) => {
      const { data: rows, error } = await supabase
        .from('appointments')
        .select(SELECT)
        .gte('start_at', start)
        .lt('start_at', end)
        .neq('status', 'cancelled')
        .order('start_at', { ascending: true });
      if (error) throw new Error(error.message);
      return (rows ?? []) as unknown as AppointmentRow[];
    },
    [start, end],
  );

  if (loading) return <WidgetLoading />;
  return <AppointmentList rows={data ?? []} emptyLabel={t('empty')} />;
}

function UpcomingAppointmentsWidget() {
  const t = useTranslations('widgets.upcomingAppointments');
  const now = new Date();
  const horizon = new Date(now);
  horizon.setDate(horizon.getDate() + 7);
  const from = now.toISOString();
  const to = horizon.toISOString();

  const { data, loading } = useAsyncData<AppointmentRow[]>(
    async (supabase) => {
      const { data: rows, error } = await supabase
        .from('appointments')
        .select(SELECT)
        .gte('start_at', from)
        .lte('start_at', to)
        .neq('status', 'cancelled')
        .order('start_at', { ascending: true })
        .limit(25);
      if (error) throw new Error(error.message);
      return (rows ?? []) as unknown as AppointmentRow[];
    },
    [from, to],
  );

  if (loading) return <WidgetLoading />;
  return <AppointmentList rows={data ?? []} emptyLabel={t('empty')} showDate />;
}

registerWidget(
  defineWidget<Record<string, never>>({
    type: 'today-appointments',
    displayName: { he: 'התורים של היום', en: "Today's appointments" },
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
    displayName: { he: 'התורים הקרובים', en: 'Upcoming appointments' },
    icon: 'CalendarRange',
    defaultSize: 'lg',
    defaultConfig: {},
    component: UpcomingAppointmentsWidget,
    singleton: true,
  }),
);
