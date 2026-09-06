'use client';

import { useTranslations } from 'next-intl';
import { CalendarPlus, PackagePlus, UserPlus, CalendarDays } from 'lucide-react';
import { defineWidget } from '@clinic/domain/widgets';
import { Link } from '@clinic/i18n/navigation';
import { useAsyncData } from '@/lib/use-supabase';
import { registerWidget } from '../registry';
import { WidgetLoading } from '../widget-frame';

interface PatientStats {
  active: number;
  newThisMonth: number;
}

function PatientStatsWidget() {
  const t = useTranslations('widgets.patientStats');

  const { data, loading } = useAsyncData<PatientStats>(async (supabase) => {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    // `head: true` asks Postgres for the count only — no rows cross the wire.
    const [activeResult, newResult] = await Promise.all([
      supabase.from('patients').select('id', { count: 'exact', head: true }).eq('is_active', true),
      supabase
        .from('patients')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', monthStart.toISOString()),
    ]);

    if (activeResult.error) throw new Error(activeResult.error.message);
    if (newResult.error) throw new Error(newResult.error.message);

    return { active: activeResult.count ?? 0, newThisMonth: newResult.count ?? 0 };
  });

  if (loading) return <WidgetLoading />;

  return (
    <div className="grid h-full grid-cols-2 gap-3">
      <div className="flex flex-col justify-center rounded-lg bg-jade-50 px-3 py-2">
        <span className="text-2xl font-semibold text-jade-800 tabular-nums">{data?.active ?? 0}</span>
        <span className="text-xs text-jade-700">{t('activePatients')}</span>
      </div>
      <div className="flex flex-col justify-center rounded-lg bg-ink-50 px-3 py-2">
        <span className="text-2xl font-semibold text-ink-800 tabular-nums">
          {data?.newThisMonth ?? 0}
        </span>
        <span className="text-xs text-ink-600">{t('newThisMonth')}</span>
      </div>
    </div>
  );
}

function QuickActionsWidget() {
  const t = useTranslations('widgets.quickActions');

  const actions = [
    { href: '/patients/new' as const, label: t('newPatient'), icon: UserPlus },
    { href: '/calendar' as const, label: t('newAppointment'), icon: CalendarPlus },
    { href: '/inventory/batches/receive' as const, label: t('receiveStock'), icon: PackagePlus },
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
    displayName: { he: 'מטופלים', en: 'Patients' },
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
    displayName: { he: 'פעולות מהירות', en: 'Quick actions' },
    icon: 'Zap',
    defaultSize: 'sm',
    defaultConfig: {},
    component: QuickActionsWidget,
    singleton: true,
  }),
);
