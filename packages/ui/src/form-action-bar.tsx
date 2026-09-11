'use client';

import * as React from 'react';
import { cn } from './cn';

/**
 * The buttons that save a long form, stuck to the bottom of the window.
 *
 * Every long form used to end its buttons at the foot of the page — a
 * consultation's worth of scrolling away from where the typing is. This bar
 * sits over the page's bottom edge (and over a phone's tab bar and home
 * indicator, through `--bottom-bar` and the safe-area inset), with the
 * actions at the trailing edge and a `status` slot at the leading edge for
 * "saved a moment ago" or "3 answers missing".
 *
 * The negative margins undo the page's own padding so the bar runs edge to
 * edge under `xl`; above it the form is narrower than the window and the bar
 * gets its own rounded top and side borders.
 */
export function FormActionBar({
  status,
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { status?: React.ReactNode }) {
  const barRef = React.useRef<HTMLDivElement>(null);

  /*
   * A field that Tab reaches while it lies under this bar counts as "in view"
   * for the browser, so nothing scrolls, and the person types into a box they
   * cannot see. scroll-margin does not help: it only shapes a scroll that
   * happens. So when focus lands on something the bar covers, the field is
   * brought to the middle of the window — whichever panel scrolls.
   */
  React.useEffect(() => {
    const onFocus = (event: FocusEvent) => {
      const bar = barRef.current;
      const target = event.target;
      if (!bar || !(target instanceof HTMLElement) || bar.contains(target)) return;
      const under = bar.getBoundingClientRect();
      const box = target.getBoundingClientRect();
      if (box.bottom > under.top && box.top < under.bottom) target.scrollIntoView({ block: 'center' });
    };
    document.addEventListener('focusin', onFocus);
    return () => document.removeEventListener('focusin', onFocus);
  }, []);

  return (
    <div
      ref={barRef}
      className={cn(
        'no-print sticky bottom-[var(--bottom-bar,0px)] z-sticky -mx-4 mt-6 flex flex-wrap items-center justify-end gap-2',
        'border-t border-ink-200 bg-white px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]',
        'sm:-mx-6 sm:px-6 xl:mx-0 xl:rounded-t-lg xl:border-x xl:px-4',
        className,
      )}
      {...props}
    >
      {status ? (
        <p className="me-auto text-xs text-ink-600" role="status" aria-live="polite">
          {status}
        </p>
      ) : null}
      {children}
    </div>
  );
}
