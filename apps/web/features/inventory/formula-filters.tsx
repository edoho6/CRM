import { getTranslations } from 'next-intl/server';
import { FORMULA_CATEGORIES, FORMULA_TCM_CATEGORIES } from '@clinic/domain';
import { FacetFilters, type Facet } from './facet-filters';
import {
  activeFormulaFilterCount,
  formulaFilterQuery,
  toggledFormulaQuery,
  type FormulaFilters as FormulaFilterState,
} from './formula-filter-params';

const PATH = '/inventory/formulas';

export async function FormulaFilters({ filters }: { filters: FormulaFilterState }) {
  const tf = await getTranslations('inventory.formulas.fields');
  const tReview = await getTranslations('inventory.review');
  const [tFormulaTcm, tCategory] = await Promise.all([
    getTranslations('inventory.formulaTcmCategory'),
    getTranslations('inventory.formulas.category'),
  ]);

  const facets: Facet[] = [
    {
      key: 'cat',
      heading: tf('tcmCategory'),
      scale: 'formulaTcmCategory',
      options: FORMULA_TCM_CATEGORIES.map((value) => ({
        value,
        label: tFormulaTcm(value),
        selected: filters.cat.includes(value),
        href: { pathname: PATH, query: toggledFormulaQuery(filters, 'cat', value) },
      })),
    },
    {
      key: 'kind',
      heading: tf('category'),
      scale: null,
      options: FORMULA_CATEGORIES.map((value) => ({
        value,
        label: tCategory(value),
        selected: filters.kind.includes(value),
        href: { pathname: PATH, query: toggledFormulaQuery(filters, 'kind', value) },
        className: 'bg-ink-100 text-ink-700 ring-1 ring-ink-200',
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
          href: { pathname: PATH, query: formulaFilterQuery({ ...filters, review: !filters.review }) },
          className: 'bg-amber-100 text-amber-900 ring-1 ring-amber-300',
        },
      ],
    },
  ];

  return (
    <FacetFilters
      facets={facets}
      activeCount={activeFormulaFilterCount(filters)}
      clearHref={{ pathname: PATH, query: formulaFilterQuery({ q: filters.q, cat: [], kind: [], review: false }) }}
    />
  );
}
