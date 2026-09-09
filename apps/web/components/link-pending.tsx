'use client';

import { useLinkStatus } from 'next/link';
import { cn } from '@clinic/ui';

/**
 * The small sign that a click was heard.
 *
 * Rendered inside a menu link; it knows, from the link itself, whether the
 * navigation it started is still in flight. Fixed in size and shown after a
 * short delay, so a fast page never flashes it and a slow one shows a dot
 * rather than a layout shift. Purely visual — the page's own live region
 * says "loading" to a screen reader.
 */
export function LinkPending({ className }: { className?: string }) {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden
      className={cn(
        'h-1.5 w-1.5 shrink-0 rounded-full bg-jade-600 transition-opacity delay-100',
        pending ? 'animate-pulse opacity-100' : 'opacity-0',
        className,
      )}
    />
  );
}
