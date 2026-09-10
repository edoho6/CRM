import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { ChevronLeft } from 'lucide-react';
import { cn } from './cn';
import { focusRing } from './focus';

/**
 * A grouped list of rows — the shape a phone settings screen has.
 *
 * One rounded container, hairline dividers between rows, each row at least
 * 44px tall with a title, an optional second line, something leading (an
 * icon) and something trailing (a value, a badge, a chevron when the row
 * leads somewhere). A row that navigates is rendered `asChild` around a
 * link, so the whole row is the target and not only its text.
 */
export function List({ className, ...props }: React.HTMLAttributes<HTMLUListElement>) {
  return (
    <ul
      className={cn(
        'divide-y divide-ink-100 overflow-hidden rounded-card border border-ink-200 bg-white',
        className,
      )}
      {...props}
    />
  );
}

export function ListRow({
  asChild = false,
  leading,
  title,
  description,
  trailing,
  chevron = false,
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLElement> & {
  /** Render the row's props onto the child (a link), so the whole row navigates. */
  asChild?: boolean;
  leading?: React.ReactNode;
  title?: React.ReactNode;
  description?: React.ReactNode;
  trailing?: React.ReactNode;
  /** The row leads somewhere: a chevron on the trailing edge says so. */
  chevron?: boolean;
}) {
  const Comp = asChild ? Slot : 'div';
  const interactive = asChild || Boolean(props.onClick);
  return (
    <li>
      <Comp
        className={cn(
          'flex min-h-11 items-center gap-3 px-4 py-2.5 text-start text-sm text-ink-900',
          interactive && 'transition-colors active:bg-ink-100 hover:bg-ink-50',
          interactive && focusRing,
          className,
        )}
        {...props}
      >
        {leading ? <span className="shrink-0 text-ink-500">{leading}</span> : null}
        <span className="min-w-0 flex-1">
          {title ? <span className="block truncate font-medium">{title}</span> : null}
          {description ? (
            <span className="block truncate text-xs text-ink-600">{description}</span>
          ) : null}
          {children}
        </span>
        {trailing ? <span className="shrink-0 text-sm text-ink-600">{trailing}</span> : null}
        {chevron ? (
          // Points the way the row leads: forward in reading order.
          <ChevronLeft aria-hidden className="h-4 w-4 shrink-0 text-ink-400 rtl:rotate-0 ltr:rotate-180" />
        ) : null}
      </Comp>
    </li>
  );
}
