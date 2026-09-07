'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Accessibility,
  BookOpen,
  Boxes,
  CalendarDays,
  ClipboardList,
  FlaskConical,
  LayoutDashboard,
  Leaf,
  LogOut,
  Menu,
  Receipt,
  Settings,
  Users,
  X,
} from 'lucide-react';
import { Link, usePathname } from '@clinic/i18n/navigation';
import { Button, cn } from '@clinic/ui';
import { LanguageSwitcher } from './language-switcher';
import { GlobalSearch } from '@/features/quick-bar/global-search';
import { QuickCreateMenu } from '@/features/quick-bar/quick-create-menu';

/**
 * The reference library and the stock room are separate destinations, because
 * they answer different questions: "what is this herb" versus "have I got any".
 * A clinic that holds no stock never sees the second one.
 */
const NAV_ITEMS = [
  { href: '/', labelKey: 'dashboard', icon: LayoutDashboard, exact: true, stockOnly: false },
  { href: '/patients', labelKey: 'patients', icon: Users, exact: false, stockOnly: false },
  { href: '/calendar', labelKey: 'calendar', icon: CalendarDays, exact: false, stockOnly: false },
  { href: '/encounters', labelKey: 'encounters', icon: ClipboardList, exact: false, stockOnly: false },
  { href: '/reference', labelKey: 'reference', icon: BookOpen, exact: false, stockOnly: false },
  { href: '/inventory', labelKey: 'inventory', icon: Boxes, exact: false, stockOnly: true },
  { href: '/billing', labelKey: 'billing', icon: Receipt, exact: false, stockOnly: false },
] as const;

export function AppShell({
  children,
  clinicName,
  userName,
  tracksInventory,
  isSynthetic = false,
  onSignOut,
}: {
  children: React.ReactNode;
  clinicName: string;
  userName: string;
  tracksInventory: boolean;
  /** True for a sandbox clinic holding fictional patients. */
  isSynthetic?: boolean;
  onSignOut: () => Promise<void>;
}) {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const nav = (
    <nav className="flex flex-col gap-0.5" aria-label={t('mainMenu')}>
      {NAV_ITEMS.filter((item) => tracksInventory || !item.stockOnly).map((item) => {
        const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileOpen(false)}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              isActive ? 'bg-jade-700 text-white' : 'text-ink-700 hover:bg-ink-100',
            )}
          >
            <item.icon className="h-4 w-4 shrink-0" aria-hidden />
            <span className="truncate">{t(item.labelKey)}</span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-dvh">
      {/* The first thing a keyboard reaches on every page. It is visually
          hidden until focused, which is the whole point: a sighted mouse user
          never sees it, and someone tabbing does not have to walk the entire
          navigation to reach the content. */}
      <a
        href="#main-content"
        className="sr-only rounded-lg bg-jade-700 px-4 py-2 text-sm font-medium text-white focus:not-sr-only focus:absolute focus:top-2 focus:start-2 focus:z-50"
      >
        {t('skipToContent')}
      </a>
      {/* Desktop sidebar. `border-e` is a logical border, so it sits on the correct
          side in both Hebrew and English without a second rule. */}
      <aside
        className="hidden w-60 shrink-0 flex-col border-e border-ink-200 bg-white lg:flex"
        aria-label={t('sidebar')}
      >
        <div className="flex items-center gap-2.5 border-b border-ink-100 px-4 py-3.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-jade-700 text-white">
            <Leaf className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-ink-900">{clinicName}</span>
            <span className="block truncate text-xs text-ink-500">{userName}</span>
          </span>
        </div>
        <div className="flex-1 overflow-y-auto p-3">{nav}</div>
        <div className="space-y-2 border-t border-ink-100 p-3">
          <Button asChild variant="ghost" size="sm" className="w-full justify-start">
            <Link href="/settings">
              <Settings className="h-4 w-4" />
              {t('settings')}
            </Link>
          </Button>
          <Button asChild variant="ghost" size="sm" className="w-full justify-start">
            <Link href="/accessibility">
              <Accessibility className="h-4 w-4" />
              {t('accessibility')}
            </Link>
          </Button>
          <LanguageSwitcher className="w-full justify-center" />
          <form action={onSignOut}>
            <Button type="submit" variant="ghost" size="sm" className="w-full justify-start">
              <LogOut className="h-4 w-4" />
              {t('signOut')}
            </Button>
          </form>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* A sandbox database says so, on every screen, above everything else.
            The whole value of the `is_synthetic` flag is that you cannot spend
            ten minutes in the wrong environment without noticing — so this is
            deliberately loud, and deliberately not dismissible. */}
        {isSynthetic ? (
          <p
            role="status"
            className="flex items-center justify-center gap-2 bg-amber-200 px-4 py-1.5 text-center text-xs font-semibold text-amber-950"
          >
            <FlaskConical className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {t('syntheticBanner')}
          </p>
        ) : null}

        {/* Top bar, on every screen and every size: the quick-create "+" and the
            global search live here so they are never more than one click away. */}
        <header className="flex items-center justify-between gap-2 border-b border-ink-200 bg-white px-4 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setMobileOpen((open) => !open)}
              aria-expanded={mobileOpen}
              aria-controls="mobile-menu"
              aria-label={t('mainMenu')}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <span className="truncate text-sm font-semibold text-ink-900 lg:hidden">{clinicName}</span>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <GlobalSearch />
            <QuickCreateMenu />
            <LanguageSwitcher className="hidden sm:inline-flex lg:hidden" />
          </div>
        </header>

        {mobileOpen ? (
          <div id="mobile-menu" className="border-b border-ink-200 bg-white p-3 lg:hidden">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs text-ink-500">{userName}</span>
              <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)} aria-label={t('mainMenu')}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            {nav}
            <form action={onSignOut} className="mt-2">
              <Button type="submit" variant="ghost" size="sm" className="w-full justify-start">
                <LogOut className="h-4 w-4" />
                {t('signOut')}
              </Button>
            </form>
          </div>
        ) : null}

        {/* `tabIndex={-1}` so the skip link can move focus here, not merely
            scroll to it — otherwise the next Tab would resume from the top. */}
        <main id="main-content" tabIndex={-1} className="min-w-0 flex-1 p-4 sm:p-6 focus:outline-none">
          {children}
        </main>
      </div>
    </div>
  );
}

/** Shared page heading so every module gets the same rhythm. */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold text-ink-900">{title}</h1>
        {description ? <p className="mt-0.5 text-sm text-ink-500">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
