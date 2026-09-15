import { getTranslations } from 'next-intl/server';
import { FORMULA_CATEGORIES, FORMULA_TCM_CATEGORIES } from '@clinic/domain';
import { FacetFilters, type Facet } from './facet-filters';
import {
  activeFormulaFilterCount,
  formulaFilterQuery,
  toggledFormulaQuery,
  type FormulaFilters as FormulaFilterState,
} from './formula-filter-params';

const PATH = '/reference/formulas';

/** `keep` carries the column sort through every chip — see `HerbFilters`. */
export async function FormulaFilters({
  filters,
  keep = {},
}: {
  filters: FormulaFilterState;
  keep?: Record<string, string>;
}) {
  const tf = await getTranslations('inventory.formulas.fields');
  const tKind = await getTranslations('inventory.formulas.category');
  const tReview = await getTranslations('inventory.review');
  const tFormulaTcm = await getTranslations('inventory.formulaTcmCategory');

  const facets: Facet[] = [
    {
      // Classical, modified, the clinic's own. A treatment that adapted a
      // classical formula for one patient leaves a "modified" row behind, and
      // a catalogue that lists every one of those beside the classics is not
      // a catalogue; this is how the list is narrowed to the classics again.
      key: 'kind',
      heading: tf('category'),
      scale: null,
      options: FORMULA_CATEGORIES.map((value) => ({
        value,
        label: tKind(value),
        selected: filters.kind.includes(value),
        href: { pathname: PATH, query: { ...toggledFormulaQuery(filters, 'kind', value), ...keep } },
        className: filters.kind.includes(value)
          ? 'bg-accent text-accent-fg shadow-xs'
          : 'bg-ink-100 text-ink-700 hover:bg-ink-200 hover:text-ink-900',
      })),
    },
    {
      key: 'cat',
      heading: tf('tcmCategory'),
      scale: 'formulaTcmCategory',
      options: FORMULA_TCM_CATEGORIES.map((value) => ({
        value,
        label: tFormulaTcm(value),
        selected: filters.cat.includes(value),
        href: { pathname: PATH, query: { ...toggledFormulaQuery(filters, 'cat', value), ...keep } },
      })),
    },
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
            query: { ...formulaFilterQuery({ ...filters, review: !filters.review }), ...keep },
          },
          className: 'bg-amber-100 text-amber-900 ring-1 ring-amber-300',
        },
      ],
    },
  ];

  return (
    <FacetFilters
      facets={facets}
      activeCount={activeFormulaFilterCount(filters)}
      clearHref={{
        pathname: PATH,
        query: { ...formulaFilterQuery({ q: filters.q, cat: [], kind: [], review: false }), ...keep },
      }}
    />
  );
}
