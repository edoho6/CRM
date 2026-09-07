'use client';

import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@clinic/i18n/navigation';
import { cn } from '@clinic/ui';

const SECTIONS = [
  { href: '/settings', labelKey: 'general', exact: true },
  { href: '/settings/access', labelKey: 'access', exact: false },
  { href: '/settings/consent', labelKey: 'consent', exact: false },
  { href: '/billing/settings', labelKey: 'billing', exact: false },
] as const;

export function SettingsNav() {
  const t = useTranslations('settings.nav');
  const pathname = usePathname();

  return (
    <nav className="mb-5 flex flex-wrap items-center gap-1 rounded-lg border border-ink-200 bg-white p-1">
      {SECTIONS.map((section) => {
        const isActive = section.exact
          ? pathname === section.href
          : pathname.startsWith(section.href);
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
