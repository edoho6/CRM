import * as React from 'react';
import { cn } from './cn';

/**
 * How wide a page's content runs.
 *
 * Three widths, chosen by what the page holds: a form reads best narrow, a
 * detail page wants room for two columns, and a table or a calendar takes the
 * whole window. Before this each page picked its own `max-w-*`, and sibling
 * screens ended up at different widths for no reason a reader could see.
 */
export function PageBody({
  width = 'full',
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { width?: 'narrow' | 'wide' | 'full' }) {
  return (
    <div
      className={cn(
        'space-y-5',
        width === 'narrow' && 'max-w-3xl',
        width === 'wide' && 'max-w-5xl',
        className,
      )}
      {...props}
    />
  );
}
