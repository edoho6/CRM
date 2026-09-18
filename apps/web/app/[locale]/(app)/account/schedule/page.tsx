import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { PractitionerSchedule, ScheduleException } from '@clinic/db/types';
import { dateKeyIn } from '@clinic/domain';
import { PageBody } from '@clinic/ui';
import { PageHeader } from '@/components/app-shell';
import { SettingsNav } from '@/features/settings/settings-nav';
import { getAbilities, getClinicScope } from '@/lib/session';
import { ScheduleForm } from '@/features/settings/schedule-form';
import { CalendarFeedCard } from '@/features/settings/calendar-feed-card';
import type { CalendarFeed } from '@clinic/db/types';
import { pageTitle } from '@/lib/page-title';

export const generateMetadata = pageTitle('schedule', 'title');

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
export default async function SchedulePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('schedule');

  const scope = await getClinicScope();
  const abilities = await getAbilities();
  if (!scope) return null;

  const practitionerId = scope.context.membership.user_id;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [schedulesResult, exceptionsResult, feedResult] = await Promise.all([
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
    // Only the owner's row comes back — the policy sees to that — so this is
    // either their feed or nothing.
    scope.supabase
      .from('calendar_feeds')
      .select('*')
      .eq('practitioner_id', practitionerId)
      .maybeSingle<CalendarFeed>(),
  ]);

  return (
    <>
      <PageHeader
        title={t('title')}
        description={t('subtitle')}
        below={<SettingsNav clinicSettings={abilities.settings} />}
      />
      <PageBody width="narrow">
        <ScheduleForm
          schedules={schedulesResult.data ?? []}
          exceptions={exceptionsResult.data ?? []}
          today={dateKeyIn(new Date(), scope.context.clinic.timezone)}
        />
        <CalendarFeedCard
          token={feedResult.data?.token ?? null}
          lastFetchedAt={feedResult.data?.last_fetched_at ?? null}
        />
      </PageBody>
    </>
  );
}
