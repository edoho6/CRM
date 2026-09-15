'use client';

import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { POINT_BODY_AREAS, POINT_CATEGORIES, POINT_CHANNELS } from '@clinic/domain';
import { cn } from '@clinic/ui';
import { Link, usePathname, useRouter } from '@clinic/i18n/navigation';
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
}: {
  initialQuery: string;
  channel: string;
  area: string;
  category: string;
  /** Only the points still waiting for a practitioner's confirmation. */
  review?: boolean;
  /** False over an empty catalogue: chips with nothing to filter are furniture. */
  withFilters?: boolean;
}) {
  const t = useTranslations('reference.points');
  const tFilters = useTranslations('inventory.herbs.filters');
  const tReview = useTranslations('inventory.review');
  const tChannel = useTranslations('reference.pointChannel');
  const tArea = useTranslations('reference.bodyArea');
  const tCategory = useTranslations('reference.pointCategory');
  const tc = useTranslations('common');
  const pathname = usePathname();
  const router = useRouter();
  const [, startTransition] = useTransition();

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
    return params;
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
                aria-pressed={channel === entry}
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
                aria-pressed={area === entry}
                className={chip(area === entry)}
                onClick={() => startTransition(() => router.refresh())}
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
                aria-pressed={category === entry}
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
              aria-pressed={review}
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
      </FilterDisclosure>
      ) : null}
    </div>
  );
}
