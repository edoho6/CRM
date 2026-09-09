'use client';

import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from './cn';
import { focusRing } from './focus';

/**
 * A titled section that opens and closes.
 *
 * `<details>`/`<summary>` rather than a div with `aria-expanded`, because the
 * browser already gives this element the right semantics, keyboard behaviour and
 * find-in-page support for nothing. A hand-built accordion has to earn all three
 * back and usually gets the third wrong — text inside a closed div is invisible
 * to Ctrl+F, where a modern browser will open a `<details>` to reveal a match.
 *
 * `defaultOpen` rather than a controlled `open`: which sections a person has
 * expanded is their business for the length of a visit, not state the
 * application should be managing.
 */
export function Collapsible({
  title,
  icon,
  description,
  badge,
  defaultOpen = false,
  children,
  className,
}: {
  title: React.ReactNode;
  icon?: React.ReactNode;
  /** One line under the title, readable while the section is shut. */
  description?: React.ReactNode;
  /** A count or a status, shown on the closed row. */
  badge?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <details
      open={defaultOpen}
      className={cn(
        'group rounded-card border border-ink-200 bg-white',
        '[&[open]>summary]:border-b [&[open]>summary]:border-ink-100',
        className,
      )}
    >
      <summary
        className={cn(
          'flex cursor-pointer list-none items-center gap-3 px-4 py-3 transition-colors hover:bg-ink-50',
          focusRing,
          // Safari still paints its own triangle without this.
          '[&::-webkit-details-marker]:hidden',
        )}
      >
        {icon ? <span className="shrink-0 text-ink-600">{icon}</span> : null}

        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-ink-900">{title}</span>
          {description ? (
            <span className="mt-0.5 block text-xs text-ink-600">{description}</span>
          ) : null}
        </span>

        {badge ? <span className="shrink-0">{badge}</span> : null}

        {/* Rotates rather than swapping glyphs, so the direction of travel is
            visible. `rtl:` is not needed: a chevron pointing down means "opens
            downwards" in both scripts. */}
        <ChevronDown
          aria-hidden
          className="h-4 w-4 shrink-0 text-ink-500 transition-transform group-open:rotate-180"
        />
      </summary>

      <div className="px-4 py-4">{children}</div>
    </details>
  );
}
