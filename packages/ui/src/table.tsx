import * as React from 'react';
import { cn } from './cn';
import { CellLabels } from './cell-labels';

/**
 * Table primitives.
 *
 * The wrapper scrolls horizontally on its own so a wide table never forces the
 * whole page to scroll sideways — which in RTL is especially disorienting.
 *
 * `responsive` goes further on a phone: under `md` the rows become stacked
 * cards, each cell labelled with its column heading (see `.table-cards` in
 * the app's stylesheet and `CellLabels`). A six-column table on a 390px
 * screen was a sideways scroll in both directions; a list of cards is read
 * top to bottom like everything else on the phone.
 */
export function TableWrapper({
  className,
  responsive = false,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { responsive?: boolean }) {
  return (
    <div
      className={cn(
        'overflow-x-auto rounded-card border border-ink-200 bg-white',
        responsive && 'table-cards',
        className,
      )}
      {...props}
    >
      {responsive ? <CellLabels /> : null}
      {children}
    </div>
  );
}

export function Table({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return <table className={cn('w-full border-collapse text-sm', className)} {...props} />;
}

/**
 * `numeric` aligns a column of money or quantities to the end and sets
 * tabular figures, so the digits line up under one another and 1,200 is
 * visibly more than 980. Text stays at the start.
 */
export function Th({
  className,
  numeric = false,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return (
    <th
      scope="col"
      className={cn(
        'border-b border-ink-200 bg-ink-50 px-3 py-2 text-xs font-semibold whitespace-nowrap text-ink-600',
        numeric ? 'text-end' : 'text-start',
        className,
      )}
      {...props}
    />
  );
}

export function Td({
  className,
  numeric = false,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return (
    <td
      className={cn(
        'border-b border-ink-100 px-3 py-2 align-middle',
        numeric ? 'text-end tabular-nums' : 'text-start',
        className,
      )}
      {...props}
    />
  );
}

/**
 * A table row.
 *
 * `sort` carries the comparable value of each cell — a date as a timestamp, a
 * quantity as a number, a name as a string — for `SortBody` to order by.
 *
 * It travels as a `data-sort` attribute rather than as a React prop because the
 * rows are built in Server Components: by the time they reach the client
 * sorter, `Tr` has already run on the server and only the plain `<tr>` element
 * survives. Attributes survive that crossing; props do not.
 */
export function Tr({
  className,
  sort,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement> & {
  sort?: Record<string, string | number | boolean | null | undefined>;
}) {
  return (
    <tr
      // The hover tint itself is a global rule (`tbody tr:hover` in each app's
      // globals.css) so that it also follows keyboard focus into the row and
      // flips correctly in dark mode. This used to paint a second, different
      // tint on top of that one. All that is left here is the fade.
      className={cn('transition-shadow', className)}
      data-sort={sort ? JSON.stringify(sort) : undefined}
      {...props}
    />
  );
}
