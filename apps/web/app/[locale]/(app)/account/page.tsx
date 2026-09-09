import { getTranslations, setRequestLocale } from 'next-intl/server';
import {
  BadgeCheck,
  CalendarCog,
  ClipboardList,
  Clock,
  CreditCard,
  MapPin,
  Palette,
} from 'lucide-react';
import { Collapsible } from '@clinic/ui';
import { Link } from '@clinic/i18n/navigation';
import type {
  AppointmentType,
  Location,
  Room,
  PractitionerSchedule,
  Profile,
  ScheduleException,
} from '@clinic/db/types';
import { PageHeader } from '@/components/app-shell';
import { getClinicScope } from '@/lib/session';
import { AppointmentTypesManager } from '@/features/settings/appointment-types-manager';
import { AppearanceSettings } from '@/features/settings/appearance-settings';
import { PractitionerForm } from '@/features/settings/practitioner-form';
import { ScheduleForm } from '@/features/settings/schedule-form';
import { LocationsManager } from '@/features/settings/locations-manager';
import { RoomsManager } from '@/features/settings/rooms-manager';

/**
 * The personal area.
 *
 * Everything a practitioner shapes for themself, in one place: how the interface
 * looks, and the treatment types their own diary and invoices are built from.
 * It sits above Settings in the navigation because it is opened far more often —
 * Settings holds the things you configure once, this holds the things you adjust
 * as the practice changes.
 *
 * The split is by ownership rather than by subject. A treatment type is a thing
 * *this practitioner* offers; the clinic's name and its payment provider belong
 * to the practice as a whole and stay in Settings, where a second practitioner
 * joining later would not expect to find their own preferences.
 */
export default async function AccountPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('account');
  const tTypes = await getTranslations('settings.appointmentTypes');
  const tProtocols = await getTranslations('protocols');
  const tPractitioner = await getTranslations('account.practitioner');
  const tSections = await getTranslations('account.sections');
  const tPlaces = await getTranslations('account.places');

  const scope = await getClinicScope();
  if (!scope) return null;

  const today = new Date().toISOString().slice(0, 10);

  const [
    { data: types },
    { data: profile },
    schedulesResult,
    exceptionsResult,
    locationsResult,
    roomsResult,
  ] =
    await Promise.all([
    scope.supabase
      .from('appointment_types')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
      .returns<AppointmentType[]>(),
    // Their own row. RLS keeps it to that, and the id is the session's.
    scope.supabase
      .from('profiles')
      .select('*')
      .eq('id', scope.context.membership.user_id)
      .maybeSingle<Profile>(),
    scope.supabase
      .from('practitioner_schedules')
      .select('*')
      .eq('practitioner_id', scope.context.membership.user_id)
      .order('weekday', { ascending: true })
      .order('start_time', { ascending: true })
      .returns<PractitionerSchedule[]>(),
    // Future closures only. A holiday from last March is history, and a list
    // that accumulates them buries next week's.
    scope.supabase
      .from('schedule_exceptions')
      .select('*')
      .eq('practitioner_id', scope.context.membership.user_id)
      .gte('date', today)
      .order('date', { ascending: true })
      .limit(400)
      .returns<ScheduleException[]>(),
    scope.supabase
      .from('locations')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
      .returns<Location[]>(),
    scope.supabase
      .from('rooms')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
      .returns<Room[]>(),
  ]);

  return (
    <>
      <PageHeader title={t('title')} description={t('subtitle')} />

      {/* Collapsed by default, except the one that gates a printed document.
          Six open panels made a page that had to be scrolled to find anything;
          six headings make a page you read in one glance and open one of. */}
      <div className="max-w-4xl space-y-3">
        <p className="text-xs text-ink-600">{tSections('hint')}</p>

        {/* Open on arrival, because everything printed for a patient carries
            these — and a treatment confirmation with them empty is a page a
            health fund will not accept. */}
        <Collapsible
          defaultOpen
          title={tPractitioner('title')}
          icon={<BadgeCheck className="h-4 w-4" aria-hidden />}
        >
          <PractitionerForm profile={profile} />
        </Collapsible>

        <Collapsible
          title={tTypes('title')}
          icon={<CalendarCog className="h-4 w-4" aria-hidden />}
          badge={
            <span className="text-xs text-ink-600">
              {tTypes('countBadge', { count: types?.length ?? 0 })}
            </span>
          }
        >
          <AppointmentTypesManager types={types ?? []} />
        </Collapsible>

        <Collapsible
          title={t('appearance')}
          icon={<Palette className="h-4 w-4" aria-hidden />}
        >
          <AppearanceSettings />
        </Collapsible>

        {/* Its own screen rather than a panel: seven days of switches and times
            plus a list of closures is more than belongs inside an accordion. */}
        <Collapsible
          title={t('schedule')}
          description={t('scheduleBody')}
          icon={<Clock className="h-4 w-4" aria-hidden />}
        >
          <ScheduleForm
            schedules={schedulesResult.data ?? []}
            exceptions={exceptionsResult.data ?? []}
          />
        </Collapsible>

        {/* Where, and in which bed. Side by side because they are one
            question asked twice: a room is a place inside a place. */}
        <Collapsible
          title={tPlaces('title')}
          description={tPlaces('subtitle')}
          icon={<MapPin className="h-4 w-4" aria-hidden />}
        >
          <div className="grid gap-6 lg:grid-cols-2">
            <section aria-labelledby="places-locations" className="space-y-2">
              <h3 id="places-locations" className="text-sm font-semibold text-ink-900">
                {tPlaces('locations')}
              </h3>
              <LocationsManager locations={locationsResult.data ?? []} />
            </section>
            <section aria-labelledby="places-rooms" className="space-y-2">
              <h3 id="places-rooms" className="text-sm font-semibold text-ink-900">
                {tPlaces('rooms')}
              </h3>
              <RoomsManager rooms={roomsResult.data ?? []} locations={locationsResult.data ?? []} />
            </section>
          </div>
        </Collapsible>

        <Collapsible
          title={tProtocols('title')}
          description={tProtocols('subtitle')}
          icon={<ClipboardList className="h-4 w-4" aria-hidden />}
        >
          <Link
            href="/account/protocols"
            className="inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-jade-700 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            {tProtocols('manage')}
          </Link>
        </Collapsible>

        {/* Where the money is configured is a property of the practice rather
            than of the person, so it is named here and lives in Settings. */}
        <Collapsible
          title={t('payments')}
          description={t('paymentsBody')}
          icon={<CreditCard className="h-4 w-4" aria-hidden />}
        >
          <Link
            href="/settings"
            className="inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-jade-700 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            {t('toSettings')}
          </Link>
        </Collapsible>
      </div>
    </>
  );
}
