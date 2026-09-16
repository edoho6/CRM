import { getTranslations, setRequestLocale } from 'next-intl/server';
import {
  BadgeCheck,
  CalendarCog,
  ClipboardList,
  Clock,
  CreditCard,
  FileText,
  MapPin,
  Palette,
  ShieldCheck,
  Trash2,
  BellRing,
} from 'lucide-react';
import { Collapsible, PageBody } from '@clinic/ui';
import { Link } from '@clinic/i18n/navigation';
import type { AppointmentType, Location, Profile, Room } from '@clinic/db/types';
import { PageHeader } from '@/components/app-shell';
import { SettingsNav } from '@/features/settings/settings-nav';
import { getClinicScope } from '@/lib/session';
import { AppointmentTypesManager } from '@/features/settings/appointment-types-manager';
import { AppearanceSettings } from '@/features/settings/appearance-settings';
import { PractitionerForm } from '@/features/settings/practitioner-form';
import { LocationsManager } from '@/features/settings/locations-manager';
import { RoomsManager } from '@/features/settings/rooms-manager';
import { TwoFactorSettings } from '@/features/settings/two-factor-settings';
import { DeleteAccountPanel } from '@/features/settings/delete-account';
import { PushSettings } from '@clinic/native';
import { registerPushDevice } from '@/features/settings/push-actions';
import { verifiedTotpFactor } from '@/lib/second-factor';
import { pageTitle } from '@/lib/page-title';

export const generateMetadata = pageTitle('account', 'title');

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
  const tForms = await getTranslations('forms');
  const tPractitioner = await getTranslations('account.practitioner');
  const tSections = await getTranslations('account.sections');
  const tPlaces = await getTranslations('account.places');

  const scope = await getClinicScope();
  if (!scope) return null;
  const factor = await verifiedTotpFactor(scope.supabase);

  const [{ data: types }, { data: profile }, locationsResult, roomsResult] = await Promise.all([
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
      <PageHeader title={t('title')} description={t('subtitle')} below={<SettingsNav />} />

      {/* Collapsed by default, except the one that gates a printed document.
          Six open panels made a page that had to be scrolled to find anything;
          six headings make a page you read in one glance and open one of. */}
      <PageBody width="wide" className="space-y-3">
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
          title={t('twoFactor.title')}
          description={t('twoFactor.subtitle')}
          icon={<ShieldCheck className="h-4 w-4" aria-hidden />}
          badge={
            <span className="text-xs text-ink-600">
              {factor ? t('twoFactor.enabled') : t('twoFactor.disabled')}
            </span>
          }
        >
          <TwoFactorSettings enabled={Boolean(factor)} factorId={factor?.id ?? null} />
        </Collapsible>

        <Collapsible title={t('appearance')} icon={<Palette className="h-4 w-4" aria-hidden />}>
          <AppearanceSettings homePath={profile?.home_path ?? '/'} />
        </Collapsible>

        {/* Its own screen rather than a panel: seven days of switches and times
            plus a list of closures is more than belongs inside an accordion. */}
        <Collapsible
          title={t('schedule')}
          description={t('scheduleBody')}
          icon={<Clock className="h-4 w-4" aria-hidden />}
        >
          <Link
            href="/account/schedule"
            className="inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-jade-700 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            {t('scheduleManage')}
          </Link>
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

        {/* Beside the protocols, and for the same reason: a library the
            practitioner builds once and then uses from a patient's file or a
            treatment. It had a place of its own in the sidebar, which put a
            thing you touch a few times a year next to the diary. */}
        <Collapsible
          title={tForms('title')}
          description={tForms('subtitle')}
          icon={<FileText className="h-4 w-4" aria-hidden />}
        >
          <Link
            href="/forms"
            className="inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-jade-700 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            {tForms('manage')}
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

        {/* Alerts on this phone: only inside the store app is there anything
            to switch on; in a browser the card says so. */}
        <Collapsible
          title={t('push.title')}
          description={t('push.subtitle')}
          icon={<BellRing className="h-4 w-4" aria-hidden />}
        >
          <PushSettings
            locale={locale}
            register={registerPushDevice}
            labels={{
              unsupported: t('push.unsupported'),
              prompt: t('push.prompt'),
              granted: t('push.granted'),
              denied: t('push.denied'),
              enable: t('push.enable'),
              enabling: t('push.enabling'),
              failed: t('push.failed'),
            }}
          />
        </Collapsible>

        {/* Last, and closed: the one thing nobody comes here for, with what it
            means said in full before any button (the stores require it from
            inside the app; migration 40 does it). */}
        <Collapsible
          title={t('deletion.title')}
          description={t('deletion.subtitle')}
          icon={<Trash2 className="h-4 w-4" aria-hidden />}
        >
          <DeleteAccountPanel clinicName={scope.context.clinic.name} />
        </Collapsible>
      </PageBody>
    </>
  );
}
