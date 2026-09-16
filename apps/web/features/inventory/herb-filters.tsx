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

/**
 * The four materia medica axes a herb is looked up by, plus the review flag.
 *
 * `keep` is whatever else belongs in the URL and is none of this component's
 * business — the column sort. Every chip rebuilds the query from the filter
 * state alone, so anything not rebuilt is silently dropped, and picking a
 * category used to reset a list the reader had just sorted by weight.
 */
export async function HerbFilters({
  filters,
  keep = {},
  path = '/reference/herbs',
  hideCategory = false,
}: {
  filters: HerbFilterState;
  keep?: Record<string, string>;
  /** The list these chips filter; the Western herbs have a list of their own. */
  path?: string;
  /** Dropped where every row carries the same category, and the facet would be one chip. */
  hideCategory?: boolean;
}) {
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
      href: { pathname: path, query: { ...toggledQuery(filters, facet, value), ...keep } },
    })),
  });

  const facets: Facet[] = [
    ...(hideCategory
      ? []
      : [build('cat', tf('tcmCategory'), 'tcmCategory', TCM_CATEGORIES, (v) => tTcm(v as never))]),
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
            pathname: path,
            query: { ...herbFilterQuery({ ...filters, review: !filters.review }), ...keep },
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
        pathname: path,
        query: {
          ...herbFilterQuery({
            q: filters.q,
            cat: [],
            temp: [],
            taste: [],
            chan: [],
            review: false,
          }),
          ...keep,
        },
      }}
    />
  );
}
