import { getTranslations } from 'next-intl/server';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@clinic/ui';
import { Link } from '@clinic/i18n/navigation';

export const PAGE_SIZE = 50;
/** Reference catalogues are browsed alphabetically, so their pages run longer. */
export const CATALOGUE_PAGE = 100;

/** The page number from the URL: a positive integer, or the first page. */
export function pageFrom(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

/** The inclusive row range PostgREST expects for a page. */
export function pageRange(page: number, size = PAGE_SIZE): [number, number] {
  return [(page - 1) * size, page * size - 1];
}

/**
 * Previous / next, under a list, with where you are.
 *
 * Every list used to stop at a fixed number and say "showing 200 of 340"
 * with no way to the other 140: patient number 201 could only be found by
 * guessing their name into the search. The page is a URL parameter, so a
 * filtered page is linkable and the browser's back button steps through it.
 * Rendered only when there is more than one page — a single page needs no
 * furniture.
 */
export async function Pagination({
  page,
  total,
  shown,
  pathname,
  query,
  size = PAGE_SIZE,
}: {
  page: number;
  /** How many rows match in all, from a counted query. */
  total: number | null;
  /** How many rows are on this page. */
  shown: number;
  pathname: string;
  /** The rest of the URL's query, carried through unchanged. */
  query: Record<string, string | string[] | undefined>;
  size?: number;
}) {
  const t = await getTranslations('common.pagination');
  if (total === null || total <= size) return null;

  const pages = Math.max(1, Math.ceil(total / size));
  const from = (page - 1) * size + 1;
  const to = Math.min(total, from + shown - 1);

  const href = (target: number) => {
    const next: Record<string, string | string[]> = {};
    for (const [key, value] of Object.entries(query)) {
      if (Array.isArray(value) ? value.length > 0 : value) next[key] = value as string | string[];
    }
    if (target > 1) next.page = String(target);
    else delete next.page;
    return { pathname, query: next };
  };

  return (
    <nav
      aria-label={t('label')}
      className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm text-ink-600"
    >
      <span>{t('range', { from, to, total })}</span>
      <div className="flex items-center gap-1">
        <Button asChild variant="secondary" size="sm" disabled={page <= 1}>
          {page > 1 ? (
            <Link href={href(page - 1)} rel="prev">
              {/* Chevrons follow reading order: "previous" points to the start edge. */}
              <ChevronRight className="h-4 w-4 rtl:block ltr:hidden" aria-hidden />
              <ChevronLeft className="h-4 w-4 rtl:hidden ltr:block" aria-hidden />
              {t('previous')}
            </Link>
          ) : (
            <span aria-disabled="true">{t('previous')}</span>
          )}
        </Button>
        <span className="px-2 tabular-nums">{t('pageOf', { page, pages })}</span>
        <Button asChild variant="secondary" size="sm" disabled={page >= pages}>
          {page < pages ? (
            <Link href={href(page + 1)} rel="next">
              {t('next')}
              <ChevronLeft className="h-4 w-4 rtl:block ltr:hidden" aria-hidden />
              <ChevronRight className="h-4 w-4 rtl:hidden ltr:block" aria-hidden />
            </Link>
          ) : (
            <span aria-disabled="true">{t('next')}</span>
          )}
        </Button>
      </div>
    </nav>
  );
}
