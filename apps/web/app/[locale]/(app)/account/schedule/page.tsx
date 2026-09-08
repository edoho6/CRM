import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { PractitionerSchedule, ScheduleException } from '@clinic/db/types';
import { PageHeader } from '@/components/app-shell';
import { getClinicScope } from '@/lib/session';
import { ScheduleForm } from '@/features/settings/schedule-form';

/**
 * When this practitioner works.
 *
 * In the personal area rather than in Settings, because working hours belong to
 * a person and not to the practice — the moment a second practitioner joins,
 * each has their own and neither should be editing the other's.
 *
 * Past exceptions are not loaded. A closure from last March is history, and a
 * list that accumulates them makes the one that matters — next week's — harder
 * to find.
 */
export default async function SchedulePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('schedule');

  const scope = await getClinicScope();
  if (!scope) return null;

  const practitionerId = scope.context.membership.user_id;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [schedulesResult, exceptionsResult] = await Promise.all([
    scope.supabase
      .from('practitioner_schedules')
      .select('*')
      .eq('practitioner_id', practitionerId)
      .order('weekday', { ascending: true })
      .order('start_time', { ascending: true })
      .returns<PractitionerSchedule[]>(),
    scope.supabase
      .from('schedule_exceptions')
      .select('*')
      .eq('practitioner_id', practitionerId)
      .gte('date', today.toISOString().slice(0, 10))
      .order('date', { ascending: true })
      .limit(200)
      .returns<ScheduleException[]>(),
  ]);

  return (
    <>
      <PageHeader title={t('title')} description={t('subtitle')} />
      <div className="max-w-3xl">
        <ScheduleForm
          schedules={schedulesResult.data ?? []}
          exceptions={exceptionsResult.data ?? []}
        />
      </div>
    </>
  );
}
