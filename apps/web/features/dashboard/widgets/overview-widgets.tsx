'use client';

import { useTranslations } from 'next-intl';
import { CalendarPlus, ChartColumn, PackagePlus, UserPlus, CalendarDays } from 'lucide-react';
import { defineWidget } from '@clinic/domain/widgets';
import { Link } from '@clinic/i18n/navigation';
import { Stat } from '@clinic/ui';
import { monthStartIn } from '@clinic/domain';
import { useAsyncData } from '@/lib/use-supabase';
import { useDashboardContext, useWidgetInitialData } from '../dashboard-context';
import { fetchPatientStats, type PatientStats } from '../queries/patient-stats';
import { registerWidget } from '../registry';
import { WidgetLoading, WidgetError } from '../widget-frame';

function PatientStatsWidget() {
  const t = useTranslations('widgets.patientStats');

  const { timeZone } = useDashboardContext();
  const initial = useWidgetInitialData<PatientStats>('patient-stats');
  const { data, loading, error, reload } = useAsyncData<PatientStats>(
    (supabase) => fetchPatientStats(supabase, monthStartIn(new Date(), timeZone).toISOString()),
    [timeZone],
    { initial },
  );

  if (loading) return <WidgetLoading />;
  if (error && !data) return <WidgetError onRetry={reload} />;

  return (
    <div className="grid h-full grid-cols-2 gap-3">
      <div className="flex flex-col justify-center rounded-lg bg-jade-50 px-3 py-2">
        <Stat value={data?.active ?? 0} label={t('activePatients')} tone="accent" />
      </div>
      <div className="flex flex-col justify-center rounded-lg bg-ink-50 px-3 py-2">
        <Stat value={data?.newThisMonth ?? 0} label={t('newThisMonth')} />
      </div>
    </div>
  );
}

function QuickActionsWidget() {
  const t = useTranslations('widgets.quickActions');
  const { tracksInventory } = useDashboardContext();

  // Four tiles, always: the grid is two by two, and three tiles leave a hole.
  // A clinic that keeps no stock has no use for "receive stock", so its slot
  // goes to the reports instead of to a page the sidebar does not even list.
  const actions = [
    { href: '/patients/new' as const, label: t('newPatient'), icon: UserPlus },
    // `new=1` opens the booking dialog on arrival; without it this tile and
    // "open calendar" went to the same place under two names.
    {
      href: { pathname: '/calendar', query: { new: '1' } } as const,
      label: t('newAppointment'),
      icon: CalendarPlus,
    },
    tracksInventory
      ? { href: '/inventory/batches/receive' as const, label: t('receiveStock'), icon: PackagePlus }
      : { href: '/reports' as const, label: t('openReports'), icon: ChartColumn },
    { href: '/calendar' as const, label: t('openCalendar'), icon: CalendarDays },
  ];

  return (
    <div className="grid h-full grid-cols-2 gap-2">
      {actions.map((action) => (
        <Link
          key={action.label}
          href={action.href}
          className="flex flex-col items-center justify-center gap-1.5 rounded-lg border border-ink-200 px-2 py-3 text-center text-xs font-medium text-ink-700 transition-colors hover:border-jade-300 hover:bg-jade-50 hover:text-jade-800"
        >
          <action.icon className="h-4 w-4" aria-hidden />
          <span className="line-clamp-2">{action.label}</span>
        </Link>
      ))}
    </div>
  );
}

registerWidget(
  defineWidget<Record<string, never>>({
    type: 'patient-stats',
    icon: 'Users',
    defaultSize: 'sm',
    defaultConfig: {},
    component: PatientStatsWidget,
    singleton: true,
  }),
);

registerWidget(
  defineWidget<Record<string, never>>({
    type: 'quick-actions',
    icon: 'Zap',
    defaultSize: 'sm',
    defaultConfig: {},
    component: QuickActionsWidget,
    singleton: true,
  }),
);
