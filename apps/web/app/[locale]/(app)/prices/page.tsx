import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Store, Tags } from 'lucide-react';
import { Button, EmptyState } from '@clinic/ui';
import { Link } from '@clinic/i18n/navigation';
import { PageHeader } from '@/components/app-shell';
import { Pagination, pageFrom } from '@/components/pagination';
import { RememberQuery } from '@/components/remember-query';
import { parseSort, sortQuery } from '@/lib/sort-params';
import { getClinicScope } from '@/lib/session';
import { CatalogueSearch } from '@/features/reference/catalogue-search';
import {
  PRICE_DEFAULT_SORT,
  PRICE_SORT_KEYS,
  parsePriceFilters,
  priceFilterQuery,
  type PriceSearchParams,
} from '@/features/prices/price-filter-params';
import { PriceFilters } from '@/features/prices/price-filters';
import { PriceTable } from '@/features/prices/price-table';
import { listOffers, listProducts, listStores } from '@/features/prices/queries';

/**
 * What the shops charge for what a clinic buys, side by side.
 *
 * The list is shared by every clinic on the service and is filled by a job
 * that reads the shops' public product pages about once a day (SECURITY.md,
 * "Shared tables"). This page only reads: the shops, a page of products, and
 * their offers. Buying happens at the shop, through the link on each price.
 */
export default async function PricesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<PriceSearchParams>;
}) {
  const { locale } = await params;
  const rawParams = await searchParams;
  setRequestLocale(locale);

  const filters = parsePriceFilters(rawParams);
  const page = pageFrom(rawParams.page);
  const sort = parseSort(rawParams, PRICE_SORT_KEYS, PRICE_DEFAULT_SORT);
  const t = await getTranslations('prices');

  const scope = await getClinicScope();
  if (!scope) return null;

  const stores = await listStores(scope.supabase);
  const activeStoreIds = [...stores.values()].filter((store) => store.status === 'active').map((store) => store.id);
  const { rows, count } = await listProducts(scope.supabase, filters, sort, page);
  const offers = await listOffers(
    scope.supabase,
    rows.map((row) => row.id),
    activeStoreIds,
  );
  const filtered = filters.q !== '' || filters.cat.length > 0 || filters.compared;

  return (
    <>
      <PageHeader
        title={t('title')}
        description={t('subtitle', { count: count ?? rows.length })}
        below={<p className="text-xs text-ink-600">{t('provenance')}</p>}
        actions={
          scope.context.isPlatformAdmin ? (
            <Button asChild variant="secondary">
              <Link href="/prices/stores">
                <Store className="h-4 w-4" aria-hidden />
                {t('stores.title')}
              </Link>
            </Button>
          ) : undefined
        }
      />

      <div className="mb-4 space-y-3">
        <RememberQuery id="prices" keys={['q', 'cat', 'min', 'sort', 'dir']} />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <PriceFilters filters={filters} />
          <CatalogueSearch initialQuery={filters.q} placeholder={t('search')} />
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<Tags className="h-8 w-8" />}
          title={filtered ? t('emptyFiltered') : t('empty')}
          description={filtered ? undefined : t('emptyBody')}
        />
      ) : (
        <PriceTable rows={rows} offers={offers} stores={stores} sort={sort} />
      )}

      <Pagination
        page={page}
        total={count}
        shown={rows.length}
        pathname="/prices"
        query={{ ...priceFilterQuery(filters), ...sortQuery(sort, PRICE_DEFAULT_SORT) }}
      />
    </>
  );
}
