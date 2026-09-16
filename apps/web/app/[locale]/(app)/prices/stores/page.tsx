import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { ShopFetchRun, ShopStore } from '@clinic/db/types';
import { PageHeader } from '@/components/app-shell';
import { getClinicScope } from '@/lib/session';
import { serverNow } from '@/lib/server-now';
import { StoreAdminPanel, type StoreStats } from '@/features/prices/store-admin-panel';
import { pageTitle } from '@/lib/page-title';

export const generateMetadata = pageTitle('prices.stores', 'title');

/**
 * The shops behind the price comparison, for whoever runs the service.
 *
 * A 404 for everyone else, like /platform: a door that is not there rather
 * than a locked one. Nothing on this page is a clinic's or a patient's — it
 * is the reader's own diary, and the two switches an admin may throw.
 */
export default async function PriceStoresPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const scope = await getClinicScope();
  if (!scope) return null;
  if (!scope.context.isPlatformAdmin) notFound();

  const t = await getTranslations('prices.stores');
  const [storesResult, statsResult, runsResult] = await Promise.all([
    scope.supabase.from('shop_stores').select('*').order('status').order('name').returns<ShopStore[]>(),
    scope.supabase.rpc('shop_store_stats'),
    scope.supabase
      .from('shop_fetch_runs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(40)
      .returns<ShopFetchRun[]>(),
  ]);

  return (
    <>
      <PageHeader title={t('title')} description={t('subtitle')} />
      <StoreAdminPanel
        stores={storesResult.data ?? []}
        stats={(Array.isArray(statsResult.data) ? statsResult.data : []) as StoreStats[]}
        runs={runsResult.data ?? []}
        canKnock={Boolean(process.env.SHOP_PRICES_SECRET && process.env.NEXT_PUBLIC_SUPABASE_URL)}
        renderedAt={serverNow()}
      />
    </>
  );
}
