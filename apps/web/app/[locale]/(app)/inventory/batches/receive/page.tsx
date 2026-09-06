import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Herb, Supplier } from '@clinic/db/types';
import { PageHeader } from '@/components/app-shell';
import { getClinicScope } from '@/lib/session';
import { InventoryNav } from '@/features/inventory/inventory-nav';
import { ReceiveForm } from '@/features/inventory/receive-form';

export default async function ReceiveStockPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ herb?: string }>;
}) {
  const { locale } = await params;
  const { herb } = await searchParams;
  setRequestLocale(locale);

  const t = await getTranslations('inventory.batches');

  const scope = await getClinicScope();
  if (!scope) return null;

  const [{ data: herbs }, { data: suppliers }] = await Promise.all([
    scope.supabase
      .from('herbs')
      .select('*')
      .eq('is_active', true)
      .order('pinyin_name', { ascending: true })
      .returns<Herb[]>(),
    scope.supabase
      .from('suppliers')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true })
      .returns<Supplier[]>(),
  ]);

  return (
    <>
      <PageHeader title={t('receive')} />
      <InventoryNav />
      <ReceiveForm herbs={herbs ?? []} suppliers={suppliers ?? []} defaultHerbId={herb} />
    </>
  );
}
