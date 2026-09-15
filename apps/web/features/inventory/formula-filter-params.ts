import { FORMULA_CATEGORIES, FORMULA_TCM_CATEGORIES } from '@clinic/domain';

/** Same URL-as-state approach as the herb catalogue; see herb-filter-params.ts. */

export interface FormulaFilters {
  q: string;
  cat: string[];
  /** Classical, modified (built for one patient) or the clinic's own. */
  kind: string[];
  review: boolean;
}

export type FormulaFilterFacet = 'cat' | 'kind';

const ALLOWED: Record<FormulaFilterFacet, readonly string[]> = {
  cat: FORMULA_TCM_CATEGORIES,
  kind: FORMULA_CATEGORIES,
};

export interface FormulaSearchParams {
  q?: string;
  cat?: string;
  kind?: string;
  review?: string;
}

function parseList(raw: string | undefined, facet: FormulaFilterFacet): string[] {
  if (!raw) return [];
  const allowed = ALLOWED[facet];
  const seen = new Set<string>();
  for (const value of raw.split(',')) {
    const trimmed = value.trim();
    if (trimmed && allowed.includes(trimmed)) seen.add(trimmed);
  }
  return [...seen];
}

export function parseFormulaFilters(params: FormulaSearchParams): FormulaFilters {
  return {
    q: (params.q ?? '').trim(),
    cat: parseList(params.cat, 'cat'),
    kind: parseList(params.kind, 'kind'),
    review: params.review === '1',
  };
}

export function activeFormulaFilterCount(filters: FormulaFilters): number {
  return filters.cat.length + filters.kind.length + (filters.review ? 1 : 0);
}

export function formulaFilterQuery(filters: FormulaFilters): Record<string, string> {
  const query: Record<string, string> = {};
  if (filters.q) query.q = filters.q;
  if (filters.cat.length) query.cat = filters.cat.join(',');
  if (filters.kind.length) query.kind = filters.kind.join(',');
  if (filters.review) query.review = '1';
  return query;
}

export function toggledFormulaQuery(
  filters: FormulaFilters,
  facet: FormulaFilterFacet,
  value: string,
): Record<string, string> {
  const current = filters[facet];
  const next = current.includes(value)
    ? current.filter((entry) => entry !== value)
    : [...current, value];
  return formulaFilterQuery({ ...filters, [facet]: next });
}
