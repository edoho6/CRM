import { getTranslations } from 'next-intl/server';
import { Check, X } from 'lucide-react';
import { Link } from '@clinic/i18n/navigation';
import { cn } from '@clinic/ui/cn';
import { tcmStyle, type TcmScale } from '@/lib/tcm-colors';
import { FilterDisclosure } from './filter-disclosure';

/**
 * The faceted filter bar shared by the herb and formula catalogues.
 *
 * Every option wears the colour it will wear in the results, so choosing a
 * filter and reading the filtered list are the same visual act. Options within
 * a facet are alternatives (any of these tastes) and the facets themselves
 * narrow (…and any of these channels) — the way a practitioner says it out
 * loud.
 *
 * The lid over it is `FilterDisclosure`, shared with the points catalogue.
 */

export interface FacetOption {
  value: string;
  label: string;
  selected: boolean;
  href: { pathname: string; query: Record<string, string> };
  /** Overrides the scale colour — used for options that are not a TCM scale. */
  className?: string;
}

export interface Facet {
  key: string;
  heading: string;
  scale: TcmScale | null;
  options: FacetOption[];
}

export async function FacetFilters({
  facets,
  activeCount,
  clearHref,
}: {
  facets: Facet[];
  activeCount: number;
  clearHref: { pathname: string; query: Record<string, string> };
}) {
  const t = await getTranslations('inventory.herbs.filters');
  const tc = await getTranslations('common');

  return (
    <FilterDisclosure title={t('title')} activeCount={activeCount}>
        {facets.map((facet) => (
          <fieldset key={facet.key}>
            <legend className="mb-1.5 text-xs font-semibold text-ink-500">{facet.heading}</legend>
            <div className="flex flex-wrap gap-1.5">
              {facet.options.map((option) => (
                <Link
                  key={option.value}
                  href={option.href}
                  scroll={false}
                  // A link may not carry aria-pressed (axe: aria-allowed-attr);
                  // "current" is the state a link is allowed to announce.
                  aria-current={option.selected ? 'true' : undefined}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium whitespace-nowrap transition-all hover:-translate-y-px hover:shadow-xs',
                    option.className ??
                      (facet.scale ? tcmStyle(facet.scale, option.value).chip : ''),
                    option.selected
                      ? 'ring-2 ring-ink-800 ring-offset-1'
                      : 'opacity-75 hover:opacity-100',
                  )}
                >
                  {option.selected ? <Check className="h-3 w-3" /> : null}
                  {option.label}
                </Link>
              ))}
            </div>
          </fieldset>
        ))}

        {activeCount > 0 ? (
          <div className="border-t border-ink-100 pt-3">
            <Link
              href={clearHref}
              scroll={false}
              className="inline-flex items-center gap-1 text-xs text-ink-500 underline-offset-2 hover:text-ink-800 hover:underline"
            >
              <X className="h-3 w-3" />
              {tc('clear')}
            </Link>
          </div>
        ) : null}
    </FilterDisclosure>
  );
}
