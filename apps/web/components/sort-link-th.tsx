'use client';

import { useSearchParams } from 'next/navigation';
import { ArrowDownAZ, ArrowUpAZ, ChevronsUpDown } from 'lucide-react';
import { Th, cn } from '@clinic/ui';
import { Link, usePathname } from '@clinic/i18n/navigation';
import type { SortState } from '@/lib/sort-params';

/**
 * A header cell that sorts the whole list, not just the page in view.
 *
 * It is a link that rewrites `sort` and `dir` in the URL and drops `page`,
 * because the first page of a newly ordered list is where the reader expects
 * to land. Everything else in the query — search, filters — is carried through.
 * A click on the active column flips its direction; on another column it
 * starts ascending. Looks the same as the in-page `SortTh`, so a reader never
 * has to learn which tables reorder where.
 */
export function SortLinkTh({
  sortKey,
  sort,
  defaultSort,
  children,
  className,
}: {
  sortKey: string;
  /** The order the page is currently in. */
  sort: SortState;
  /** The order the page has with nothing in the URL, so that state stays unspoken. */
  defaultSort: SortState;
  children: React.ReactNode;
  className?: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isActive = sort.key === sortKey;
  const ascending = !isActive || sort.dir === 'asc';
  const Icon = !isActive ? ChevronsUpDown : ascending ? ArrowDownAZ : ArrowUpAZ;

  const next = { key: sortKey, dir: isActive && ascending ? 'desc' : 'asc' } as const;
  const query = new URLSearchParams(searchParams.toString());
  query.delete('page');
  if (next.key === defaultSort.key && next.dir === defaultSort.dir) {
    query.delete('sort');
    query.delete('dir');
  } else {
    query.set('sort', next.key);
    query.set('dir', next.dir);
  }

  return (
    <Th
      className={cn('p-0', className)}
      aria-sort={isActive ? (ascending ? 'ascending' : 'descending') : 'none'}
    >
      <Link
        href={{ pathname, query: Object.fromEntries(query) }}
        scroll={false}
        className={cn(
          'group flex w-full items-center gap-1.5 px-3 py-2 text-start text-xs font-semibold transition-colors',
          isActive ? 'text-jade-800' : 'text-ink-600 hover:text-ink-900',
        )}
      >
        <span>{children}</span>
        <Icon
          aria-hidden
          className={cn(
            'h-3.5 w-3.5 shrink-0 transition-opacity',
            isActive ? 'opacity-100' : 'opacity-40 group-hover:opacity-80',
          )}
        />
      </Link>
    </Th>
  );
}
