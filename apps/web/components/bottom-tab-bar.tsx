'use client';

import { useTranslations } from 'next-intl';
import { CalendarDays, LayoutDashboard, ListTodo, Menu, Users } from 'lucide-react';
import { Link, usePathname } from '@clinic/i18n/navigation';
import { SheetTrigger, cn } from '@clinic/ui';
import { LinkPending } from './link-pending';

/**
 * The four places a practitioner goes all day, one tap each, at the bottom
 * of a phone's screen where the thumb already is — and "more" for the rest.
 *
 * Under `lg` only: from there up the sidebar shows everything. It sits over
 * the page's bottom edge; the page, the toasts and every sticky bar read
 * `--bottom-bar` (set in globals.css when this element exists) to stay clear
 * of it, and the safe-area inset keeps it above the home indicator.
 *
 * Rendered inside the shell's `Sheet`, so "more" is the drawer's own
 * trigger: Radix then knows where to put focus back when the drawer closes.
 * A button that merely set the open state left focus on the page body.
 */
export const TAB_ROOTS = ['/', '/patients', '/calendar', '/tasks'] as const;

const TABS = [
  { href: '/', labelKey: 'home', icon: LayoutDashboard, exact: true },
  { href: '/patients', labelKey: 'patients', icon: Users, exact: false },
  { href: '/calendar', labelKey: 'calendar', icon: CalendarDays, exact: false },
  { href: '/tasks', labelKey: 'tasks', icon: ListTodo, exact: false },
] as const;

const itemClasses =
  'relative flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-xs font-medium transition-[color,opacity] duration-(--duration-fast) active:opacity-60';

export function BottomTabBar() {
  const t = useTranslations('nav');
  const pathname = usePathname();

  return (
    <nav
      data-tab-bar
      aria-label={t('tabBar')}
      className="no-print fixed inset-x-0 bottom-0 z-sticky flex border-t border-ink-200 bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
    >
      {TABS.map((tab) => {
        const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={cn(itemClasses, active ? 'text-jade-800' : 'text-ink-600')}
          >
            <tab.icon className="h-6 w-6" aria-hidden strokeWidth={active ? 2.25 : 2} />
            <span>{t(tab.labelKey)}</span>
            <LinkPending className="absolute top-1.5 end-[calc(50%-1rem)]" />
          </Link>
        );
      })}
      <SheetTrigger asChild>
        <button type="button" className={cn(itemClasses, 'text-ink-600 data-[state=open]:text-jade-800')}>
          <Menu className="h-6 w-6" aria-hidden />
          <span>{t('more')}</span>
        </button>
      </SheetTrigger>
    </nav>
  );
}
