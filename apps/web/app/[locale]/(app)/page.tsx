import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PageHeader } from '@/components/app-shell';
import { getClinicScope } from '@/lib/session';
import { DashboardGrid } from '@/features/dashboard/dashboard-grid';
import { DEFAULT_DASHBOARD_LAYOUT } from '@/features/dashboard/default-layout';
import { parseStoredLayout } from '@/features/dashboard/layout-utils';

export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('dashboard');
  const scope = await getClinicScope();
  // The layout redirects in this case; returning early keeps the page renderable
  // during `next build` before any credentials exist.
  if (!scope) return null;

  const { data } = await scope.supabase
    .from('dashboard_layouts')
    .select('layout')
    .eq('user_id', scope.context.membership.user_id)
    .eq('name', 'default')
    .maybeSingle<{ layout: unknown }>();

  // A stored-but-empty layout is a real choice (the user removed every widget), so
  // only fall back to the default when nothing has ever been saved.
  const layout = data ? parseStoredLayout(data.layout) : DEFAULT_DASHBOARD_LAYOUT;
  const name = scope.context.profile?.full_name?.trim();

  return (
    <>
      <PageHeader title={name ? t('greeting', { name }) : t('title')} />
      <DashboardGrid initialLayout={layout} />
    </>
  );
}
