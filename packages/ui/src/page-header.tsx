import * as React from 'react';
import { cn } from './cn';

/**
 * The heading of a page, and the one place a page's primary action lives.
 *
 * Every screen starts with this, at the same size, with the same rhythm
 * beneath it — so the eye learns once where the title, the caption and the
 * button are, and never has to look for them again.
 *
 * `size` exists for the two screens that are not app pages: the sign-in
 * family (centred, narrow) and print, where a larger title reads better on
 * paper. Nothing else may pick a size.
 *
 * `banner` is for a warning that belongs to the whole page (low stock, a
 * signed record): it sits under the title as a real alert rather than being
 * smuggled into the caption in a different colour.
 *
 * `below` is a strip that sits tight under the header — a tag row, a sub
 * navigation — and takes the header's bottom margin with it, so callers stop
 * pulling content up with negative margins.
 */
export function PageHeader({
  title,
  description,
  actions,
  banner,
  below,
  size = 'page',
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  banner?: React.ReactNode;
  below?: React.ReactNode;
  size?: 'page' | 'auth' | 'print';
  className?: string;
}) {
  return (
    <div className={cn(below ? 'mb-4' : 'mb-5', className)}>
      <div
        className={cn(
          'flex flex-wrap items-start justify-between gap-3',
          size === 'auth' && 'justify-center text-center',
        )}
      >
        <div className="min-w-0">
          <h1
            className={cn(
              'font-semibold text-ink-900',
              size === 'print' ? 'text-2xl' : 'text-xl',
            )}
          >
            {title}
          </h1>
          {/* A `div`, not a `p`: callers put real markup here (a `<nav>` on the
              treatment page), and a `<nav>` inside a `<p>` is invalid HTML that
              the browser silently repairs — differently from the server. */}
          {description ? <div className="mt-0.5 text-sm text-ink-600">{description}</div> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {banner ? <div className="mt-3">{banner}</div> : null}
      {below ? <div className="mt-3">{below}</div> : null}
    </div>
  );
}
