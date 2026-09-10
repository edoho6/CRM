'use client';

import * as React from 'react';
import { ArrowDownAZ, ArrowUpAZ, ChevronsUpDown } from 'lucide-react';
import { cn } from './cn';
import { Table, Th } from './table';
import {
  compareSortValues,
  nextSortState,
  parseSortValues,
  sortCollator,
  type SortDirection,
  type SortValues,
} from './sort-compare';

/**
 * Column sorting for any table in the app.
 *
 * The rows themselves stay server-rendered — a cell can hold a link, a badge,
 * an image, anything — and only the *order* is decided on the client. That is
 * why each row declares a plain map of comparable values instead of this
 * component trying to read text back out of the rendered cells: "3 October"
 * and "10 March" sort by their timestamps, not by their spelling.
 *
 * Sorting applies to the rows the page fetched, which is what a person means
 * when they click the header of the table in front of them.
 */

export type { SortValue, SortValues, SortDirection } from './sort-compare';

interface SortContextValue {
  activeKey: string | null;
  direction: SortDirection;
  toggle: (key: string) => void;
}

const SortContext = React.createContext<SortContextValue | null>(null);

export function SortableTable({
  children,
  className,
  defaultSortKey = null,
  defaultSortDirection = 'asc',
  sortDisabled = false,
}: {
  children: React.ReactNode;
  className?: string;
  /** Column the data already arrives sorted by, so the arrow starts truthful. */
  defaultSortKey?: string | null;
  defaultSortDirection?: SortDirection;
  /**
   * Plain headings, no sorting. For a paged list: sorting reorders only the
   * rows on this page, and an arrow that promises "by name" over a list it
   * cannot see is a lie. The headings stay so the columns are still named.
   */
  sortDisabled?: boolean;
}) {
  /**
   * Key and direction are one piece of state, not two.
   *
   * They were two, and `toggle` flipped the direction from inside the key's
   * updater — a side effect in a function React is free to call more than once.
   * Under StrictMode it does exactly that, so every flip happened twice and
   * cancelled itself: the second click on a column appeared to do nothing and
   * the table would only ever sort A→Z. Deriving both from one pure update
   * removes the possibility.
   */
  const [sort, setSort] = React.useState<{ key: string | null; direction: SortDirection }>({
    key: defaultSortKey,
    direction: defaultSortDirection,
  });

  const toggle = React.useCallback((key: string) => {
    setSort((current) => nextSortState(current, key));
  }, []);

  const value = React.useMemo(
    () => ({ activeKey: sort.key, direction: sort.direction, toggle }),
    [sort, toggle],
  );

  if (sortDisabled) return <Table className={className}>{children}</Table>;

  return (
    <SortContext.Provider value={value}>
      <Table className={className}>{children}</Table>
    </SortContext.Provider>
  );
}

/**
 * A header cell that sorts. Falls back to a plain header if it somehow ends up
 * outside a SortableTable, so a column can never become an inert dead button.
 */
export function SortTh({
  sortKey,
  children,
  className,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement> & { sortKey: string; numeric?: boolean }) {
  const context = React.useContext(SortContext);
  if (!context) {
    return (
      <Th className={className} {...props}>
        {children}
      </Th>
    );
  }

  const isActive = context.activeKey === sortKey;
  const ascending = !isActive || context.direction === 'asc';
  const Icon = !isActive ? ChevronsUpDown : ascending ? ArrowDownAZ : ArrowUpAZ;

  return (
    <Th
      className={cn('p-0', className)}
      aria-sort={isActive ? (ascending ? 'ascending' : 'descending') : 'none'}
      {...props}
    >
      <button
        type="button"
        onClick={() => context.toggle(sortKey)}
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
      </button>
    </Th>
  );
}

/**
 * Reorders its rows by the active column.
 *
 * Each row's comparable values arrive as the `data-sort` attribute that `Tr`
 * writes — see the note there for why an attribute and not a prop. A row
 * without one keeps its position, so a table can mix sortable rows with a
 * summary line that should always stay put.
 */
export function SortBody({
  children,
  locale,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement> & { locale?: string }) {
  const context = React.useContext(SortContext);
  const activeKey = context?.activeKey ?? null;
  const direction = context?.direction ?? 'asc';

  const rows = React.useMemo(
    () => React.Children.toArray(children).filter(React.isValidElement),
    [children],
  );

  const sorted = React.useMemo(() => {
    if (!activeKey) return rows;

    const collator = sortCollator(locale);
    const cache = new Map<React.ReactElement, SortValues>();
    const read = (row: React.ReactElement) => {
      let values = cache.get(row);
      if (!values) {
        values = parseSortValues((row.props as { 'data-sort'?: string })['data-sort']);
        cache.set(row, values);
      }
      return values[activeKey];
    };

    return [...rows].sort((left, right) =>
      compareSortValues(read(left), read(right), direction, collator),
    );
  }, [rows, activeKey, direction, locale]);

  return <tbody {...props}>{sorted}</tbody>;
}
