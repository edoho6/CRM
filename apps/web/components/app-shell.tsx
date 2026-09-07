'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Accessibility,
  BookOpen,
  Boxes,
  CalendarDays,
  ChevronsRight,
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
import { ThemeToggle } from './theme-toggle';
import { GlobalSearch } from '@/features/quick-bar/global-search';
import { QuickCreateMenu } from '@/features/quick-bar/quick-create-menu';

/**
 * The reference library and the stock room are separate destinations, because
 * they answer different questions: "what is this herb" versus "have I got any".
 * A clinic that holds no stock never sees the second one.
 */
const SIDEBAR_STORAGE_KEY = 'herbalist-sidebar-collapsed';

const NAV_ITEMS = [
  { href: '/', labelKey: 'dashboard', icon: LayoutDashboard, exact: true, stockOnly: false },
  { href: '/patients', labelKey: 'patients', icon: Users, exact: false, stockOnly: false },
  { href: '/calendar', labelKey: 'calendar', icon: CalendarDays, exact: false, stockOnly: false },
  {
    href: '/encounters',
    labelKey: 'encounters',
    icon: ClipboardList,
    exact: false,
    stockOnly: false,
  },
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

  // Whether the sidebar is collapsed belongs to this browser, not to the
  // account: the same practitioner wants it open on a laptop and folded away on
  // a small screen where the herb table needs every pixel. Starts expanded and
  // corrects itself after mount, so the server and the first client render agree.
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(SIDEBAR_STORAGE_KEY) === '1') setCollapsed(true);
    } catch {
      // Site data blocked. The sidebar simply opens expanded every time.
    }
  }, []);

  useEffect(() => {
    try {
      if (collapsed) localStorage.setItem(SIDEBAR_STORAGE_KEY, '1');
      else localStorage.removeItem(SIDEBAR_STORAGE_KEY);
    } catch {
      // As above — not remembering is the whole of the failure.
    }
  }, [collapsed]);

  // `iconOnly` is the collapsed desktop rail. The mobile menu always shows
  // labels, because it is not the thing being collapsed.
  function navList(iconOnly: boolean) {
    return (
      <nav id="sidebar-nav" className="flex flex-col gap-0.5" aria-label={t('mainMenu')}>
        {NAV_ITEMS.filter((item) => tracksInventory || !item.stockOnly).map((item) => {
          const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          const label = t(item.labelKey);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              aria-current={isActive ? 'page' : undefined}
              title={iconOnly ? label : undefined}
              className={cn(
                'flex items-center rounded-lg py-2 text-sm font-medium transition-colors',
                iconOnly ? 'justify-center px-0' : 'gap-2.5 px-3',
                isActive ? 'bg-accent text-accent-fg' : 'text-ink-700 hover:bg-ink-100',
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" aria-hidden />
              {/* The label stays in the accessibility tree when collapsed —
                  a rail of unlabelled icons is unusable with a screen reader. */}
              <span className={iconOnly ? 'sr-only' : 'truncate'}>{label}</span>
            </Link>
          );
        })}
      </nav>
    );
  }

  const nav = navList(false);

  return (
    <div className="flex min-h-dvh">
      {/* The first thing a keyboard reaches on every page. It is visually
          hidden until focused, which is the whole point: a sighted mouse user
          never sees it, and someone tabbing does not have to walk the entire
          navigation to reach the content. */}
      <a
        href="#main-content"
        className="sr-only rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-fg focus:not-sr-only focus:absolute focus:top-2 focus:start-2 focus:z-50"
      >
        {t('skipToContent')}
      </a>
      {/* Desktop sidebar. `border-e` is a logical border, so it sits on the correct
          side in both Hebrew and English without a second rule.

          Collapsed, it keeps the icons rather than disappearing: a rail you can
          still navigate from is worth more than the extra 3rem, and the whole
          point of collapsing is to give a wide table more room, not to hide the
          way back out of it. */}
      {/* Stuck to the viewport, its own height, its own scroll.
          Before this the sidebar was as tall as the page, so on a long herb
          table the settings, theme and sign-out at its foot were a thousand
          pixels down — reachable only by scrolling past the content they were
          meant to sit beside. Now the panel is exactly the height of the window
          and the navigation scrolls inside it, so the foot is always at the
          foot. */}
      <aside
        className={cn(
          // `sticky` is a positioned value, so it already establishes the
          // containing block the collapse handle is placed against.
          'sticky top-0 hidden h-dvh shrink-0 flex-col border-e border-ink-200 bg-white transition-[width] duration-200 lg:flex',
          collapsed ? 'w-14' : 'w-60',
        )}
        aria-label={t('sidebar')}
      >
        <div
          className={cn(
            'flex items-center gap-2.5 border-b border-ink-100 py-3.5',
            collapsed ? 'justify-center px-2' : 'px-4',
          )}
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-fg">
            <Leaf className="h-4 w-4" />
          </span>
          {!collapsed ? (
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-ink-900">
                {clinicName}
              </span>
              <span className="block truncate text-xs text-ink-500">{userName}</span>
            </span>
          ) : null}
        </div>

        {/* `min-h-0` is what makes the scroll actually happen: without it a flex
            child refuses to shrink below its content, so the list pushes the
            footer off the bottom instead of scrolling. */}
        <div className={cn('min-h-0 flex-1 overflow-y-auto', collapsed ? 'p-2' : 'p-3')}>
          {navList(collapsed)}
        </div>

        {/* Ordered by how far each one is from ordinary work: settings and the
            two display switches first, then the accessibility statement, then
            signing out at the very bottom — the one action you never want to hit
            while reaching for something else. */}
        <div
          className={cn('shrink-0 space-y-2 border-t border-ink-100', collapsed ? 'p-2' : 'p-3')}
        >
          <Button
            asChild
            variant="ghost"
            size="sm"
            className={cn('w-full', collapsed ? 'justify-center px-0' : 'justify-start')}
          >
            <Link href="/settings" title={collapsed ? t('settings') : undefined}>
              <Settings className="h-4 w-4" />
              {!collapsed ? t('settings') : <span className="sr-only">{t('settings')}</span>}
            </Link>
          </Button>

          {!collapsed ? (
            <>
              <ThemeToggle className="w-full" />
              <LanguageSwitcher className="w-full justify-center" />
            </>
          ) : null}

          <Button
            asChild
            variant="ghost"
            size="sm"
            className={cn('w-full', collapsed ? 'justify-center px-0' : 'justify-start')}
          >
            <Link href="/accessibility" title={collapsed ? t('accessibility') : undefined}>
              <Accessibility className="h-4 w-4" />
              {!collapsed ? (
                t('accessibility')
              ) : (
                <span className="sr-only">{t('accessibility')}</span>
              )}
            </Link>
          </Button>

          <form action={onSignOut}>
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              className={cn('w-full', collapsed ? 'justify-center px-0' : 'justify-start')}
              title={collapsed ? t('signOut') : undefined}
            >
              <LogOut className="h-4 w-4" />
              {!collapsed ? t('signOut') : <span className="sr-only">{t('signOut')}</span>}
            </Button>
          </form>
        </div>

        {/* A handle on the panel's own edge, halfway down: an arrow and nothing
            else. It was a labelled row in the footer, which put a word for a
            control that already looks like exactly what it does next to the
            things you actually navigate to.

            Physically left in both languages — in Hebrew that is the panel's
            inner edge, in English its outer one — so it always sits between the
            sidebar and the content it makes room for. The name is still on it
            for a screen reader and on hover for everyone else. */}
        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          aria-expanded={!collapsed}
          aria-controls="sidebar-nav"
          aria-label={collapsed ? t('expandSidebar') : t('collapseSidebar')}
          title={collapsed ? t('expandSidebar') : t('collapseSidebar')}
          className="absolute top-1/2 left-0 z-10 flex h-12 w-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-ink-200 bg-white text-ink-600 shadow-xs transition-colors hover:bg-ink-100 hover:text-ink-900"
        >
          <ChevronsRight
            className={cn(
              'h-3.5 w-3.5 shrink-0 transition-transform rtl:-scale-x-100',
              !collapsed && 'rotate-180',
            )}
            aria-hidden
          />
        </button>
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
            <span className="truncate text-sm font-semibold text-ink-900 lg:hidden">
              {clinicName}
            </span>
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
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileOpen(false)}
                aria-label={t('mainMenu')}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            {nav}
            <div className="mt-2 flex items-center gap-2">
              <ThemeToggle />
              <LanguageSwitcher />
            </div>
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
        <main
          id="main-content"
          tabIndex={-1}
          className="min-w-0 flex-1 p-4 sm:p-6 focus:outline-none"
        >
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
