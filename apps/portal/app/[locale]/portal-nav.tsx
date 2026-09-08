'use client';

import { useTranslations } from 'next-intl';
import { CalendarDays, ClipboardList, ShieldCheck } from 'lucide-react';
import { cn } from '@clinic/ui';
import { Link } from '@clinic/i18n/navigation';

/**
 * Three places, so the portal is navigable once it has more than one page.
 *
 * A segmented row rather than a sidebar: the portal is opened on a phone, by
 * someone who visits it twice a year, and a navigation drawer is a thing to
 * learn. Three named destinations in a row need no learning.
 *
 * `current` is passed rather than read from the pathname, because the pages that
 * use it are Server Components that already know which one they are.
 */
export function PortalNav({ current }: { current: 'home' | 'forms' | 'consent' }) {
  const t = useTranslations('portal');

  const items = [
    { key: 'home', href: '/', icon: CalendarDays, label: t('nav.home') },
    { key: 'forms', href: '/forms', icon: ClipboardList, label: t('nav.forms') },
    { key: 'consent', href: '/consent', icon: ShieldCheck, label: t('nav.consent') },
  ] as const;

  return (
    <nav
      aria-label={t('nav.label')}
      className="flex flex-wrap items-center gap-1 rounded-lg border border-ink-200 bg-white p-1"
    >
      {items.map((item) => {
        const isActive = item.key === current;
        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              isActive ? 'bg-accent text-accent-fg' : 'text-ink-600 hover:bg-ink-50',
            )}
          >
            <item.icon className="h-4 w-4 shrink-0" aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
