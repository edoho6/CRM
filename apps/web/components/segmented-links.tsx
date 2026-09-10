'use client';

import type { ComponentProps } from 'react';
import { Link } from '@clinic/i18n/navigation';
import {
  SegmentCount,
  cn,
  segmentClasses,
  segmentGroupClasses,
  type SegmentedSize,
} from '@clinic/ui';

export interface SegmentedLink {
  href: ComponentProps<typeof Link>['href'];
  label: string;
  active: boolean;
  count?: number;
  icon?: React.ReactNode;
}

/**
 * A row of segments that are links.
 *
 * The same shape as `SegmentedControl`, for the choices that live in the URL:
 * a sub-navigation (settings, the reference library, the stock room), a
 * filter that the server applies, a date range. It looks identical to the
 * button version on purpose — a reader should not have to learn that one row
 * of pills switches a view and another loads a page.
 *
 * `as="nav"` for navigation between pages; the default is a filter group.
 */
export function SegmentedLinks({
  items,
  label,
  size = 'md',
  as = 'group',
  className,
}: {
  items: SegmentedLink[];
  /** The group's accessible name. */
  label: string;
  size?: SegmentedSize;
  as?: 'nav' | 'group';
  className?: string;
}) {
  const links = items.map((item) => (
    <Link
      key={typeof item.href === 'string' ? item.href : JSON.stringify(item.href)}
      href={item.href}
      aria-current={item.active ? 'page' : undefined}
      className={segmentClasses(item.active, size)}
    >
      {item.icon}
      {item.label}
      {item.count !== undefined ? <SegmentCount value={item.count} selected={item.active} /> : null}
    </Link>
  ));

  if (as === 'nav') {
    return (
      <nav aria-label={label} className={cn(segmentGroupClasses, className)}>
        {links}
      </nav>
    );
  }
  return (
    <div role="group" aria-label={label} className={cn(segmentGroupClasses, className)}>
      {links}
    </div>
  );
}
