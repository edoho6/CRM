import { getTranslations } from 'next-intl/server';
import { SHOP_CATEGORIES } from '@clinic/domain';
import { FacetFilters, type Facet } from '@/features/inventory/facet-filters';
import {
  activePriceFilterCount,
  priceFilterQuery,
  toggledCategory,
  type PriceFilters as PriceFilterState,
} from './price-filter-params';

const PATH = '/prices';
/** Shop categories have no TCM colour scale; every chip wears the same neutral. */
const CHIP = 'bg-ink-100 text-ink-900';

/** The categories a clinic buys, and the switch to the products two or more shops carry. */
export async function PriceFilters({ filters }: { filters: PriceFilterState }) {
  const t = await getTranslations('prices');
  const facets: Facet[] = [
    {
      key: 'cat',
      heading: t('filters.category'),
      scale: null,
      options: SHOP_CATEGORIES.map((value) => ({
        value,
        label: t(`categories.${value}`),
        selected: filters.cat.includes(value),
        href: { pathname: PATH, query: toggledCategory(filters, value) },
        className: CHIP,
      })),
    },
    {
      key: 'compared',
      heading: t('filters.compared'),
      scale: null,
      options: [
        {
          value: 'compared',
          label: t('filters.comparedOnly'),
          selected: filters.compared,
          href: { pathname: PATH, query: priceFilterQuery({ ...filters, compared: !filters.compared }) },
          className: CHIP,
        },
      ],
    },
  ];
  return (
    <FacetFilters
      facets={facets}
      activeCount={activePriceFilterCount(filters)}
      clearHref={{ pathname: PATH, query: priceFilterQuery({ q: filters.q, cat: [], compared: false }) }}
    />
  );
}
