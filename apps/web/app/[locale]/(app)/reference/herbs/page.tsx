import { HerbsCatalogue } from '@/features/reference/herbs-catalogue';
import type { HerbSearchParams } from '@/features/inventory/herb-filter-params';
import { pageTitle } from '@/lib/page-title';

export const generateMetadata = pageTitle('inventory.herbs', 'title');

/** The materia medica: every herb except the Western ones, which have their own list. */
export default async function HerbsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<HerbSearchParams>;
}) {
  const { locale } = await params;
  return <HerbsCatalogue locale={locale} rawParams={await searchParams} />;
}
