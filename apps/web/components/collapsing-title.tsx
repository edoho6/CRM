'use client';

import { useEffect, useState } from 'react';
import { usePathname } from '@clinic/i18n/navigation';
import { cn } from '@clinic/ui';

/**
 * The page's title, in the top bar, once the page's own heading has scrolled
 * out of view — the way a large title on a phone folds into the bar.
 *
 * It watches the `<h1 data-page-title>` that `PageHeader` renders, with an
 * observer rather than a scroll listener, and re-attaches whenever the main
 * region's children change (a navigation, a skeleton giving way to the page).
 * `aria-hidden`: the h1 is still the page's accessible name; this is a
 * visual echo of it, not a second heading.
 *
 * Until the heading is out of view the slot shows `fallback` — the clinic's
 * name on a phone, nothing on a desk where the sidebar already says it.
 */
export function CollapsingTitle({
  fallback,
  className,
}: {
  fallback?: React.ReactNode;
  className?: string;
}) {
  const pathname = usePathname();
  const [title, setTitle] = useState('');
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const main = document.getElementById('main-content');
    if (!main) return;
    let observer: IntersectionObserver | null = null;

    const attach = () => {
      observer?.disconnect();
      observer = null;
      const heading = main.querySelector<HTMLElement>('[data-page-title]');
      setTitle(heading?.textContent?.trim() ?? '');
      setCollapsed(false);
      if (!heading) return;
      // Collapsed once the heading has gone up under the bar — not when it
      // leaves through the bottom of a short window.
      const bar = document.querySelector<HTMLElement>('[data-top-bar]');
      const offset = Math.round(bar?.getBoundingClientRect().bottom ?? 60);
      observer = new IntersectionObserver(
        ([entry]) => {
          if (!entry) return;
          setCollapsed(!entry.isIntersecting && entry.boundingClientRect.top < offset);
        },
        { rootMargin: `-${offset}px 0px 0px 0px`, threshold: 0 },
      );
      observer.observe(heading);
    };

    attach();
    const mutation = new MutationObserver(attach);
    mutation.observe(main, { childList: true });
    return () => {
      observer?.disconnect();
      mutation.disconnect();
    };
  }, [pathname]);

  const showTitle = collapsed && title !== '';
  return (
    <span
      data-collapsing-title
      data-collapsed={showTitle || undefined}
      className={cn('relative block min-w-0 truncate text-sm font-semibold text-ink-900', className)}
    >
      <span
        aria-hidden
        className={cn(
          'block truncate transition-opacity duration-(--duration-base)',
          showTitle ? 'opacity-100' : 'pointer-events-none absolute inset-0 opacity-0',
        )}
      >
        {title}
      </span>
      {!showTitle ? <span className="block truncate">{fallback}</span> : null}
    </span>
  );
}
