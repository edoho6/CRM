'use client';

import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@clinic/i18n/navigation';
import { cn } from '@clinic/ui';

/**
 * Sub-navigation for the reference library.
 *
 * Three catalogues, none of which knows anything about stock: what a herb is,
 * what a formula is made of, where a point sits.
 */
const SECTIONS = [
  { href: '/reference/herbs', labelKey: 'herbs' },
  { href: '/reference/formulas', labelKey: 'formulas' },
  { href: '/reference/points', labelKey: 'points' },
] as const;

export function ReferenceNav() {
  const t = useTranslations('nav');
  const pathname = usePathname();

  return (
    <nav className="mb-5 flex flex-wrap items-center gap-1 rounded-lg border border-ink-200 bg-white p-1">
      {SECTIONS.map((section) => {
        const isActive = pathname.startsWith(section.href);
        return (
          <Link
            key={section.href}
            href={section.href}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              isActive ? 'bg-jade-700 text-white' : 'text-ink-600 hover:bg-ink-50',
            )}
          >
            {t(section.labelKey)}
          </Link>
        );
      })}
    </nav>
  );
}
