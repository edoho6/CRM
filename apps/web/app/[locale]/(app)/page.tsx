import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PageHeader } from '@/components/app-shell';
import { getClinicScope } from '@/lib/session';
import { DashboardGrid } from '@/features/dashboard/dashboard-grid';
import { GettingStarted } from '@/features/dashboard/getting-started';
import { defaultDashboardLayout } from '@/features/dashboard/default-layout';
import { parseStoredLayout } from '@/features/dashboard/layout-utils';
import { DEFAULT_TIME_ZONE, loadDashboardData } from '@/features/dashboard/loaders';
import { pageTitle } from '@/lib/page-title';
import { verifiedTotpFactor } from '@/lib/second-factor';

export const generateMetadata = pageTitle('nav', 'dashboard');

export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('dashboard');
  const scope = await getClinicScope();
  // The layout redirects in this case; returning early keeps the page renderable
  // during `next build` before any credentials exist.
  if (!scope) return null;

  const [{ data }, patientsCount, hoursCount, typesCount, factor] = await Promise.all([
    scope.supabase
      .from('dashboard_layouts')
      .select('layout')
      .eq('user_id', scope.context.membership.user_id)
      .eq('name', 'default')
      .maybeSingle<{ layout: unknown }>(),
    // Three head counts and the authenticator for the first-steps card:
    // cheap, and the card goes once every step is done.
    scope.supabase.from('patients').select('id', { count: 'exact', head: true }).limit(1),
    scope.supabase
      .from('practitioner_schedules')
      .select('id', { count: 'exact', head: true })
      .eq('practitioner_id', scope.context.membership.user_id)
      .limit(1),
    scope.supabase.from('appointment_types').select('id', { count: 'exact', head: true }).limit(1),
    verifiedTotpFactor(scope.supabase),
  ]);

  const tracksInventory = scope.context.clinic.tracks_inventory !== false;

  // A stored-but-empty layout is a real choice (the user removed every widget), so
  // only fall back to the default when nothing has ever been saved.
  const layout = data ? parseStoredLayout(data.layout) : defaultDashboardLayout(tracksInventory);
  // The widgets' own queries, run here for the first paint so the page
  // arrives with its numbers rather than as a grid of spinners.
  const timeZone = scope.context.clinic.timezone || DEFAULT_TIME_ZONE;
  // One clock for the page: the widgets read "now" from it on the server and
  // in the browser alike, so what is overdue does not change between the two.
  const renderedAt = new Date().toISOString();
  const initialData = await loadDashboardData(scope.supabase, layout, timeZone);
  const name = scope.context.profile?.full_name?.trim();

  return (
    <>
      <PageHeader title={name ? t('greeting', { name }) : t('title')} />
      <GettingStarted
        hasHours={(hoursCount.count ?? 0) > 0}
        hasTypes={(typesCount.count ?? 0) > 0}
        hasPatients={(patientsCount.count ?? 0) > 0}
        hasTwoFactor={Boolean(factor)}
      />
      <DashboardGrid
        initialLayout={layout}
        tracksInventory={tracksInventory}
        timeZone={timeZone}
        renderedAt={renderedAt}
        initialData={initialData}
      />
    </>
  );
}
