import { HerbsCatalogue } from '@/features/reference/herbs-catalogue';
import type { HerbSearchParams } from '@/features/inventory/herb-filter-params';
import { pageTitle } from '@/lib/page-title';

export const generateMetadata = pageTitle('inventory.westernHerbs', 'title');

/**
 * The Western herbs, apart from the materia medica.
 *
 * They came from a second index at the same source and they are the same kind
 * of record — same table, same monograph, same stock — but they are not part
 * of the Chinese materia medica and they do not carry its categories. A
 * hundred and twenty Latin binomials interleaved with the pinyin made both
 * lists harder to read, so each now has its own.
 */
export default async function WesternHerbsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<HerbSearchParams>;
}) {
  const { locale } = await params;
  return <HerbsCatalogue locale={locale} rawParams={await searchParams} western />;
}
