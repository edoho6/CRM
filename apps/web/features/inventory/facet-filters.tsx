import { getTranslations } from 'next-intl/server';
import { Check, SlidersHorizontal, X } from 'lucide-react';
import { Link } from '@clinic/i18n/navigation';
import { cn } from '@clinic/ui/cn';
import { tcmStyle, type TcmScale } from '@/lib/tcm-colors';

/**
 * The faceted filter bar shared by the herb and formula catalogues.
 *
 * Every option wears the colour it will wear in the results, so choosing a
 * filter and reading the filtered list are the same visual act. Options within
 * a facet are alternatives (any of these tastes) and the facets themselves
 * narrow (…and any of these channels) — the way a practitioner says it out
 * loud.
 *
 * The panel is a plain `<details>` so it opens without JavaScript, and it
 * starts open whenever something is already filtered: an active filter must
 * never be able to hide behind a closed lid.
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
    <details
      open={activeCount > 0}
      className="rounded-card border border-ink-200 bg-white [&[open]_.facet-chevron]:rotate-180"
    >
      <summary className="flex list-none items-center gap-2 px-3 py-2 text-sm font-medium text-ink-700 transition-colors hover:bg-ink-50">
        <SlidersHorizontal className="h-4 w-4 text-ink-500" />
        {t('title')}
        {activeCount > 0 ? (
          <span className="rounded-full bg-jade-100 px-2 py-0.5 text-xs font-semibold text-jade-800">
            {activeCount}
          </span>
        ) : null}
        <span className="facet-chevron ms-auto text-xs text-ink-500 transition-transform">▾</span>
      </summary>

      <div className="space-y-4 border-t border-ink-100 px-3 py-3">
        {facets.map((facet) => (
          <fieldset key={facet.key}>
            <legend className="mb-1.5 text-xs font-semibold text-ink-500">{facet.heading}</legend>
            <div className="flex flex-wrap gap-1.5">
              {facet.options.map((option) => (
                <Link
                  key={option.value}
                  href={option.href}
                  scroll={false}
                  aria-pressed={option.selected}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium whitespace-nowrap transition-all hover:-translate-y-px hover:shadow-xs',
                    option.className ?? (facet.scale ? tcmStyle(facet.scale, option.value).chip : ''),
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
      </div>
    </details>
  );
}
