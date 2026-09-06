import * as React from 'react';
import { cn } from './cn';

/**
 * Table primitives.
 *
 * The wrapper scrolls horizontally on its own so a wide table never forces the
 * whole page to scroll sideways — which in RTL is especially disorienting.
 */
export function TableWrapper({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('overflow-x-auto rounded-card border border-ink-200 bg-white', className)}
      {...props}
    />
  );
}

export function Table({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return <table className={cn('w-full border-collapse text-sm', className)} {...props} />;
}

export function Th({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope="col"
      className={cn(
        'border-b border-ink-200 bg-ink-50 px-3 py-2 text-start text-xs font-semibold whitespace-nowrap text-ink-600',
        className,
      )}
      {...props}
    />
  );
}

export function Td({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cn('border-b border-ink-100 px-3 py-2 text-start align-middle', className)} {...props} />
  );
}

export function Tr({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn('transition-colors hover:bg-ink-50/70', className)} {...props} />;
}
