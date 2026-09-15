'use client';

import { useTranslations } from 'next-intl';
import { X } from 'lucide-react';
import { POINT_BODY_AREAS, POINT_CATEGORIES, POINT_CHANNELS } from '@clinic/domain';
import { cn } from '@clinic/ui';
import { Link, usePathname } from '@clinic/i18n/navigation';
import { CatalogueSearch } from './catalogue-search';
import { ReferenceNav } from './reference-nav';
import { FilterDisclosure } from '@/features/inventory/filter-disclosure';

/**
 * Finding a point.
 *
 * The two questions a practitioner actually arrives with — which channel, and
 * which part of the body — are answered by two rows of chips rather than a
 * dropdown tucked beside the search box. Typing a code is the fast path when
 * you already know it; browsing "everything on the knee" is the path when you
 * do not, and that one deserves to be visible.
 */
export function PointSearch({
  initialQuery,
  channel,
  area,
  category,
  review = false,
  withFilters = true,
  keep = {},
}: {
  initialQuery: string;
  channel: string;
  area: string;
  category: string;
  /** Only the points still waiting for a practitioner's confirmation. */
  review?: boolean;
  /** False over an empty catalogue: chips with nothing to filter are furniture. */
  withFilters?: boolean;
  /** What else belongs in the URL and is not a filter — the column sort. */
  keep?: Record<string, string>;
}) {
  const t = useTranslations('reference.points');
  const tFilters = useTranslations('inventory.herbs.filters');
  const tReview = useTranslations('inventory.review');
  const tChannel = useTranslations('reference.pointChannel');
  const tArea = useTranslations('reference.bodyArea');
  const tCategory = useTranslations('reference.pointCategory');
  const tc = useTranslations('common');
  const pathname = usePathname();

  /*
   * The URL this chip leads to.
   *
   * Every chip rebuilds the whole query, so anything not rebuilt here is
   * dropped — which is how picking a channel used to throw away a sort the
   * reader had just chosen. `keep` is what the page hands in for that.
   *
   * Passing `''` clears a facet, and `??` is deliberate: an empty string is a
   * value ("no channel"), only `undefined` means "leave this one alone".
   */
  const query = (next: { channel?: string; area?: string; category?: string; review?: boolean }) => {
    const params: Record<string, string> = {};
    if (initialQuery) params.q = initialQuery;
    const nextChannel = next.channel ?? channel;
    const nextArea = next.area ?? area;
    const nextCategory = next.category ?? category;
    const nextReview = next.review ?? review;
    if (nextChannel) params.channel = nextChannel;
    if (nextArea) params.area = nextArea;
    if (nextCategory) params.category = nextCategory;
    if (nextReview) params.review = '1';
    return { ...params, ...keep };
  };

  const chip = (selected: boolean) =>
    cn(
      'rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-all',
      selected
        ? 'bg-accent text-accent-fg shadow-xs'
        : 'bg-ink-100 text-ink-700 hover:-translate-y-px hover:bg-ink-200 hover:text-ink-900',
    );

  const activeCount = [channel, area, category].filter(Boolean).length + (review ? 1 : 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ReferenceNav />
        <CatalogueSearch initialQuery={initialQuery} placeholder={t('searchPlaceholder')} />
      </div>

      {withFilters ? (
      <FilterDisclosure title={tFilters('title')} activeCount={activeCount}>
        <fieldset>
          <legend className="mb-1.5 text-xs font-semibold text-ink-600">
            {t('filterByChannel')}
          </legend>
          <div className="flex flex-wrap gap-1.5">
            <Link
              href={{ pathname, query: query({ channel: '' }) }}
              scroll={false}
              className={chip(!channel)}
            >
              {tc('all')}
            </Link>
            {POINT_CHANNELS.map((entry) => (
              <Link
                key={entry}
                href={{ pathname, query: query({ channel: channel === entry ? '' : entry }) }}
                scroll={false}
                aria-current={channel === entry ? 'true' : undefined}
                className={chip(channel === entry)}
              >
                {tChannel(entry)}
              </Link>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-1.5 text-xs font-semibold text-ink-600">{t('filterByArea')}</legend>
          <div className="flex flex-wrap gap-1.5">
            <Link
              href={{ pathname, query: query({ area: '' }) }}
              scroll={false}
              className={chip(!area)}
            >
              {tc('all')}
            </Link>
            {/* Ordered head to foot, so the row reads like a body. */}
            {POINT_BODY_AREAS.map((entry) => (
              <Link
                key={entry}
                href={{ pathname, query: query({ area: area === entry ? '' : entry }) }}
                scroll={false}
                aria-current={area === entry ? 'true' : undefined}
                className={chip(area === entry)}
              >
                {tArea(entry)}
              </Link>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-1.5 text-xs font-semibold text-ink-600">
            {t('filterByCategory')}
          </legend>
          <div className="flex flex-wrap gap-1.5">
            <Link
              href={{ pathname, query: query({ category: '' }) }}
              scroll={false}
              className={chip(!category)}
            >
              {tc('all')}
            </Link>
            {POINT_CATEGORIES.map((entry) => (
              <Link
                key={entry}
                href={{ pathname, query: query({ category: category === entry ? '' : entry }) }}
                scroll={false}
                aria-current={category === entry ? 'true' : undefined}
                className={chip(category === entry)}
              >
                {tCategory(entry)}
              </Link>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-1.5 text-xs font-semibold text-ink-600">{t('filterByReview')}</legend>
          <div className="flex flex-wrap gap-1.5">
            <Link
              href={{ pathname, query: query({ review: !review }) }}
              scroll={false}
              aria-current={review ? 'true' : undefined}
              className={cn(
                'rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-all',
                review
                  ? 'bg-amber-200 text-amber-950 shadow-xs'
                  : 'bg-amber-100 text-amber-900 ring-1 ring-amber-300 hover:-translate-y-px',
              )}
            >
              {tReview('badge')}
            </Link>
          </div>
        </fieldset>

        {/* One way out of all of them, in the same place and the same words as
            the herb and formula catalogues. Without it the only way back to the
            full list was to find the "all" chip in each row that was set. */}
        {activeCount > 0 ? (
          <div className="border-t border-ink-100 pt-3">
            <Link
              href={{
                pathname,
                query: query({ channel: '', area: '', category: '', review: false }),
              }}
              scroll={false}
              className="inline-flex items-center gap-1 text-xs text-ink-500 underline-offset-2 hover:text-ink-800 hover:underline"
            >
              <X className="h-3 w-3" aria-hidden />
              {tc('clear')}
            </Link>
          </div>
        ) : null}
      </FilterDisclosure>
      ) : null}
    </div>
  );
}
