import { getTranslations } from 'next-intl/server';
import { CHANNELS, TASTES, TCM_CATEGORIES, TEMPERATURES } from '@clinic/domain';
import { FacetFilters, type Facet } from './facet-filters';
import {
  activeFilterCount,
  herbFilterQuery,
  toggledQuery,
  type HerbFilterFacet,
  type HerbFilters as HerbFilterState,
} from './herb-filter-params';

const PATH = '/inventory/herbs';

/** The four materia medica axes a herb is looked up by, plus the review flag. */
export async function HerbFilters({ filters }: { filters: HerbFilterState }) {
  const tf = await getTranslations('inventory.herbs.fields');
  const tReview = await getTranslations('inventory.review');
  const [tTcm, tTemp, tTaste, tChannel] = await Promise.all([
    getTranslations('inventory.tcmCategory'),
    getTranslations('inventory.temperature'),
    getTranslations('inventory.taste'),
    getTranslations('inventory.channel'),
  ]);

  const build = (
    facet: HerbFilterFacet,
    heading: string,
    scale: Facet['scale'],
    values: readonly string[],
    label: (value: string) => string,
  ): Facet => ({
    key: facet,
    heading,
    scale,
    options: values.map((value) => ({
      value,
      label: label(value),
      selected: filters[facet].includes(value),
      href: { pathname: PATH, query: toggledQuery(filters, facet, value) },
    })),
  });

  const facets: Facet[] = [
    build('cat', tf('tcmCategory'), 'tcmCategory', TCM_CATEGORIES, (v) => tTcm(v as never)),
    build('temp', tf('temperature'), 'temperature', TEMPERATURES, (v) => tTemp(v as never)),
    build('taste', tf('tastes'), 'taste', TASTES, (v) => tTaste(v as never)),
    build('chan', tf('channels'), 'channel', CHANNELS, (v) => tChannel(v as never)),
    {
      key: 'review',
      heading: tReview('badge'),
      scale: null,
      options: [
        {
          value: 'review',
          label: tReview('badge'),
          selected: filters.review,
          href: {
            pathname: PATH,
            query: herbFilterQuery({ ...filters, review: !filters.review }),
          },
          className: 'bg-amber-100 text-amber-900 ring-1 ring-amber-300',
        },
      ],
    },
  ];

  return (
    <FacetFilters
      facets={facets}
      activeCount={activeFilterCount(filters)}
      clearHref={{
        pathname: PATH,
        query: herbFilterQuery({ q: filters.q, cat: [], temp: [], taste: [], chan: [], review: false }),
      }}
    />
  );
}
