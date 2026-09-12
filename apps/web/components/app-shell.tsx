'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Accessibility,
  BookOpen,
  Boxes,
  CalendarDays,
  ChartColumn,
  ChevronsRight,
  ClipboardList,
  FileText,
  FlaskConical,
  GripVertical,
  LayoutDashboard,
  ListTodo,
  MessageSquare,
  Building2,
  Leaf,
  LogOut,
  Receipt,
  Settings,
  Sparkles,
  Tags,
  UserCog,
  Users,
} from 'lucide-react';
import { Link, usePathname } from '@clinic/i18n/navigation';
import { ArrangeToggle, Button, Sheet, SheetContent, cn } from '@clinic/ui';
import { LanguageSwitcher } from './language-switcher';
import { ThemeToggle } from './theme-toggle';
import { UserMenu } from './user-menu';
import { TaskBell } from './task-bell';
import { LinkPending } from './link-pending';
import { GlobalSearch } from '@/features/quick-bar/global-search';
import { QuickCreateMenu } from '@/features/quick-bar/quick-create-menu';
import { BackButton } from './back-button';
import { BottomTabBar } from './bottom-tab-bar';
import { CollapsingTitle } from './collapsing-title';
import { PREF_KEYS } from '@/lib/prefs';
import { OpenFilesBar } from '@/features/workspace/open-files-bar';
import { clearOpenFiles } from '@/features/workspace/open-files';

/**
 * The reference library and the stock room are separate destinations, because
 * they answer different questions: "what is this herb" versus "have I got any".
 * A clinic that holds no stock never sees the second one.
 */
const SIDEBAR_STORAGE_KEY = PREF_KEYS.sidebarCollapsed;
/** The order of the menu, as this browser's user last arranged it. */
const NAV_ORDER_STORAGE_KEY = PREF_KEYS.navOrder;

type NavHref = (typeof NAV_ITEMS)[number]['href'];

/** Stored order first, then anything newer that the stored order has never met. */
function mergeNavOrder(stored: string[], known: readonly NavHref[]): NavHref[] {
  const kept = stored.filter((href): href is NavHref => (known as readonly string[]).includes(href));
  return [...kept, ...known.filter((href) => !kept.includes(href))];
}

/**
 * One menu row while the order is being changed: the same shape as the link,
 * but not a link — a click in this mode must not navigate away from the thing
 * being arranged. The grip says it moves; the keyboard sensor lets it.
 */
function SortableNavItem({
  href,
  label,
  icon: Icon,
}: {
  href: NavHref;
  label: string;
  icon: (typeof NAV_ITEMS)[number]['icon'];
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: href,
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      className={cn(
        'widget-drag-handle flex items-center gap-2.5 rounded-lg border border-dashed border-ink-200 bg-white px-3 py-2 text-sm font-medium text-ink-700',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
        isDragging && 'z-10 opacity-90 shadow-md',
      )}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <GripVertical className="h-4 w-4 shrink-0 text-ink-400" aria-hidden />
    </div>
  );
}

const NAV_ITEMS = [
  { href: '/', labelKey: 'dashboard', icon: LayoutDashboard, exact: true, stockOnly: false },
  { href: '/patients', labelKey: 'patients', icon: Users, exact: false, stockOnly: false },
  { href: '/calendar', labelKey: 'calendar', icon: CalendarDays, exact: false, stockOnly: false },
  { href: '/tasks', labelKey: 'tasks', icon: ListTodo, exact: false, stockOnly: false },
  { href: '/messages', labelKey: 'messages', icon: MessageSquare, exact: false, stockOnly: false },
  {
    href: '/encounters',
    labelKey: 'encounters',
    icon: ClipboardList,
    exact: false,
    stockOnly: false,
  },
  { href: '/forms', labelKey: 'forms', icon: FileText, exact: false, stockOnly: false },
  { href: '/reference', labelKey: 'reference', icon: BookOpen, exact: false, stockOnly: false },
  { href: '/inventory', labelKey: 'inventory', icon: Boxes, exact: false, stockOnly: true },
  { href: '/prices', labelKey: 'prices', icon: Tags, exact: false, stockOnly: false },
  { href: '/billing', labelKey: 'billing', icon: Receipt, exact: false, stockOnly: false },
  { href: '/reports', labelKey: 'reports', icon: ChartColumn, exact: false, stockOnly: false },
  { href: '/assistant', labelKey: 'assistant', icon: Sparkles, exact: false, stockOnly: false },
] as const;

export function AppShell({
  children,
  clinicName,
  userName,
  tracksInventory,
  isSynthetic = false,
  isPlatformAdmin = false,
  homePath = '/',
  onSignOut,
}: {
  children: React.ReactNode;
  clinicName: string;
  userName: string;
  tracksInventory: boolean;
  /** Where the clinic name at the top of the menu leads — the person's own choice. */
  homePath?: string;
  /** True for a sandbox clinic holding fictional patients. */
  isSynthetic?: boolean;
  /** Shows the service-wide overview link. Decided by the database, not here. */
  isPlatformAdmin?: boolean;
  onSignOut: () => Promise<void>;
}) {
  const t = useTranslations('nav');
  const tc = useTranslations('common');
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Whether the sidebar is collapsed belongs to this browser, not to the
  // account: the same practitioner wants it open on a laptop and folded away on
  // a small screen where the herb table needs every pixel.
  //
  // The server renders it open, and the first client render must agree. The
  // stored choice is read from the attribute the pre-paint script wrote on
  // <html> (see lib/theme.ts) — in a layout effect, before paint — and the
  // stylesheet has already drawn the folded panel from that same attribute, so
  // the page never opens wide and then slams shut. Toggling writes the
  // attribute back, which is what lets the stylesheet let go.
  const [collapsed, setCollapsed] = useState(false);

  useLayoutEffect(() => {
    setCollapsed(document.documentElement.dataset.sidebar === 'collapsed');
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((current) => {
      const next = !current;
      if (next) document.documentElement.dataset.sidebar = 'collapsed';
      else delete document.documentElement.dataset.sidebar;
      try {
        if (next) localStorage.setItem(SIDEBAR_STORAGE_KEY, '1');
        else localStorage.removeItem(SIDEBAR_STORAGE_KEY);
      } catch {
        // Site data blocked — not remembering is the whole of the failure.
      }
      return next;
    });
  }, []);

  /*
   * The menu in the order this person keeps it.
   *
   * Arranged only from the expanded desktop sidebar, behind a button, so a
   * row cannot be dragged by someone reaching for it. The order is a property
   * of this browser, like the collapsed state, and the phone drawer simply
   * shows the same order. Items the clinic does not use (the stock room, when
   * inventory is off) are hidden after ordering, so turning the setting on
   * later puts them where they were rather than at the end.
   */
  const [navOrder, setNavOrder] = useState<NavHref[]>(() => NAV_ITEMS.map((item) => item.href));
  const [navEditing, setNavEditing] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(NAV_ORDER_STORAGE_KEY);
      if (!raw) return;
      const stored: unknown = JSON.parse(raw);
      if (Array.isArray(stored)) {
        setNavOrder(
          mergeNavOrder(
            stored.filter((value): value is string => typeof value === 'string'),
            NAV_ITEMS.map((item) => item.href),
          ),
        );
      }
    } catch {
      // Site data blocked. The default order every time is the whole cost.
    }
  }, []);

  const orderedNavItems = useMemo(
    () =>
      navOrder
        .map((href) => NAV_ITEMS.find((item) => item.href === href))
        .filter((item): item is (typeof NAV_ITEMS)[number] => Boolean(item))
        .filter((item) => tracksInventory || !item.stockOnly),
    [navOrder, tracksInventory],
  );

  const navSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleNavDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const from = navOrder.indexOf(active.id as NavHref);
      const to = navOrder.indexOf(over.id as NavHref);
      if (from === -1 || to === -1) return;
      const next = arrayMove(navOrder, from, to);
      setNavOrder(next);
      try {
        localStorage.setItem(NAV_ORDER_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // As above.
      }
    },
    [navOrder],
  );

  // `iconOnly` is the collapsed desktop rail. The mobile menu always shows
  // labels, because it is not the thing being collapsed. Only the desktop
  // sidebar can be rearranged (`editable`): the phone drawer has no button to
  // leave the mode, so it never enters it.
  function navList(iconOnly: boolean, editable = false) {
    if (editable && navEditing && !iconOnly) {
      return (
        <nav id="sidebar-nav" className="flex flex-col gap-1" aria-label={t('mainMenu')}>
          <DndContext
            sensors={navSensors}
            collisionDetection={closestCenter}
            onDragEnd={handleNavDragEnd}
          >
            <SortableContext
              items={orderedNavItems.map((item) => item.href)}
              strategy={verticalListSortingStrategy}
            >
              {orderedNavItems.map((item) => (
                <SortableNavItem
                  key={item.href}
                  href={item.href}
                  label={t(item.labelKey)}
                  icon={item.icon}
                />
              ))}
            </SortableContext>
          </DndContext>
          <p className="mt-2 px-1 text-xs text-ink-600">{t('arrangeHint')}</p>
        </nav>
      );
    }

    return (
      <nav id="sidebar-nav" className="flex flex-col gap-0.5" aria-label={t('mainMenu')}>
        {orderedNavItems.map((item) => {
          const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          const label = t(item.labelKey);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              aria-current={isActive ? 'page' : undefined}
              title={iconOnly ? label : undefined}
              data-sidebar-row
              className={cn(
                'flex min-h-10 items-center rounded-lg py-2 text-sm font-medium transition-colors active:bg-ink-200',
                iconOnly ? 'justify-center px-0' : 'gap-2.5 px-3',
                isActive ? 'bg-accent text-accent-fg active:bg-accent-strong' : 'text-ink-700 hover:bg-ink-100',
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" aria-hidden />
              {/* The label stays in the accessibility tree when collapsed —
                  a rail of unlabelled icons is unusable with a screen reader. */}
              <span data-sidebar-expanded-only className={iconOnly ? 'sr-only' : 'truncate'}>
                {label}
              </span>
              {/* A dot that appears when this link is the one being waited
                  on. Hidden in the icon rail, where there is no room. */}
              {!iconOnly ? <LinkPending className="ms-auto" /> : null}
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
        className="sr-only rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-fg focus:not-sr-only focus:absolute focus:top-2 focus:start-2 focus:z-popover"
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
        data-sidebar-panel
        className={cn(
          // `sticky` is a positioned value, so it already establishes the
          // containing block the collapse handle is placed against.
          'sticky top-0 hidden h-dvh shrink-0 flex-col border-e border-ink-200 bg-white transition-[width] duration-200 lg:flex',
          collapsed ? 'w-14' : 'w-60',
        )}
        aria-label={t('sidebar')}
      >
        <div
          data-sidebar-row
          className={cn(
            'flex items-center gap-2.5 border-b border-ink-100 py-3.5',
            collapsed ? 'justify-center px-2' : 'px-4',
          )}
        >
          {/* The clinic's name is the way home — to whichever screen this
              person chose as home in their personal area. */}
          <Link
            href={homePath}
            className={cn(
              'flex min-w-0 items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
              !collapsed && 'flex-1',
            )}
            title={clinicName}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-fg">
              <Leaf className="h-4 w-4" />
            </span>
            {/* The clinic at the top, the person at the foot. Where you are is a
                property of the window; who you are is a property of you, and
                putting the name in both places said it twice. */}
            {!collapsed ? (
              <span
                data-sidebar-expanded-only
                className="min-w-0 truncate text-sm font-semibold text-ink-900"
              >
                {clinicName}
              </span>
            ) : (
              <span className="sr-only">{clinicName}</span>
            )}
          </Link>
          {!collapsed ? (
            <>
              {/* Beside the menu it arranges. A switch, not a mode buried in
                  settings: press it, drag, press it again. */}
              <span data-sidebar-expanded-only className="ms-auto flex shrink-0">
                <ArrangeToggle
                  editing={navEditing}
                  onToggle={() => setNavEditing((value) => !value)}
                  arrangeLabel={t('arrangeMenu')}
                  doneLabel={t('doneArranging')}
                />
              </span>
            </>
          ) : null}
        </div>

        {/* `min-h-0` is what makes the scroll actually happen: without it a flex
            child refuses to shrink below its content, so the list pushes the
            footer off the bottom instead of scrolling. */}
        <div className={cn('min-h-0 flex-1 overflow-y-auto', collapsed ? 'p-2' : 'p-3')}>
          {navList(collapsed, true)}
        </div>

        {/* Two links and a menu, where there were six controls.

            Settings and the accessibility statement stay as visible links: the
            first is a destination, and the second is a legal obligation that a
            statement folded into a menu would not meet. Everything that belongs
            to the person rather than to the practice — the personal area, the
            theme, the language, signing out — is behind their own name, because
            those are settings you set once and then stop looking at. */}
        <div
          className={cn('shrink-0 space-y-1 border-t border-ink-100', collapsed ? 'p-2' : 'p-3')}
        >
          {/* Only for whoever runs the service. The database decides; this
              merely draws the door where it exists. */}
          {isPlatformAdmin ? (
            <Button
              asChild
              variant="ghost"
              size="sm"
              data-sidebar-row
              className={cn('w-full', collapsed ? 'justify-center px-0' : 'justify-start')}
            >
              <Link href="/platform" title={collapsed ? t('platform') : undefined}>
                <Building2 className="h-4 w-4" />
                {!collapsed ? (
                  <span data-sidebar-expanded-only>{t('platform')}</span>
                ) : (
                  <span className="sr-only">{t('platform')}</span>
                )}
              </Link>
            </Button>
          ) : null}

          <Button
            asChild
            variant="ghost"
            size="sm"
            data-sidebar-row
            className={cn('w-full', collapsed ? 'justify-center px-0' : 'justify-start')}
          >
            <Link href="/settings" title={collapsed ? t('settings') : undefined}>
              <Settings className="h-4 w-4" />
              {!collapsed ? (
                <span data-sidebar-expanded-only>{t('settings')}</span>
              ) : (
                <span className="sr-only">{t('settings')}</span>
              )}
            </Link>
          </Button>

          {/* The personal area beside the clinic's settings. It used to live
              only behind your own name, and nobody found it there. */}
          <Button
            asChild
            variant="ghost"
            size="sm"
            data-sidebar-row
            className={cn('w-full', collapsed ? 'justify-center px-0' : 'justify-start')}
          >
            <Link href="/account" title={collapsed ? t('account') : undefined}>
              <UserCog className="h-4 w-4" />
              {!collapsed ? (
                <span data-sidebar-expanded-only>{t('account')}</span>
              ) : (
                <span className="sr-only">{t('account')}</span>
              )}
            </Link>
          </Button>

          <Button
            asChild
            variant="ghost"
            size="sm"
            data-sidebar-row
            className={cn('w-full', collapsed ? 'justify-center px-0' : 'justify-start')}
          >
            <Link href="/accessibility" title={collapsed ? t('accessibility') : undefined}>
              <Accessibility className="h-4 w-4" />
              {!collapsed ? (
                <span data-sidebar-expanded-only>{t('accessibility')}</span>
              ) : (
                <span className="sr-only">{t('accessibility')}</span>
              )}
            </Link>
          </Button>

          <div className="border-t border-ink-100 pt-1">
            <UserMenu userName={userName} collapsed={collapsed} onSignOut={onSignOut} />
          </div>
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
          onClick={toggleCollapsed}
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
            global search live here so they are never more than one click away.
            On a phone the page's title folds into it once the large title
            has scrolled away; until then it names the clinic. `relative` is
            for the search, which opens across the whole bar there. */}
        <header
          data-top-bar
          className="relative sticky top-0 z-sticky flex h-15 items-center justify-between gap-2 border-b border-ink-200 bg-white/90 px-3 backdrop-blur-md sm:px-4"
        >
          <div className="flex min-w-0 flex-1 items-center gap-1 sm:gap-2">
            {/* Beside the title rather than in the page: every screen has one,
                and a control that moves about is a control you hunt for. */}
            <BackButton />
            <CollapsingTitle
              className="flex-1"
              fallback={<span className="lg:hidden">{clinicName}</span>}
            />
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <GlobalSearch />
            <TaskBell />
            <QuickCreateMenu />
          </div>
        </header>

        {/* Open files, under the top bar and above the page. It renders
            nothing when nothing is open, and sticks just below the header so
            the two travel together.

            `top-15` is the header's `h-15`, and the two must agree. The header
            used to take its height from its content — 44px buttons plus
            padding and a border came to 61px — while this sat at a
            hand-written 52px, so the strip stuck nine pixels *under* the
            header and was clipped on every scroll. A fixed header height is
            the honest fix: one number, used twice. */}
        <div data-open-files-slot className="sticky top-15 z-sticky">
          <OpenFilesBar />
        </div>

        {/* The phone's navigation, as a drawer.

            It was an inline block that pushed the page down when opened — no
            backdrop, no focus trap, no animation — and it left out the three
            destinations that live in the sidebar's foot on a desktop:
            personal area, settings and the accessibility statement. On a phone
            there was no way to reach any of them. The Sheet is a dialog, so it
            traps focus, closes on Escape and on the backdrop, and returns
            focus to the button that opened it. */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent title={t('mainMenu')} closeLabel={tc('close')} className="lg:hidden">
            <p className="mb-2 truncate px-3 text-xs text-ink-500" dir="auto">
              {userName}
            </p>
            {nav}
            <nav
              aria-label={t('account')}
              className="mt-3 flex flex-col gap-0.5 border-t border-ink-100 pt-3"
            >
              {[
                { href: '/account' as const, label: t('account'), icon: UserCog },
                { href: '/settings' as const, label: t('settings'), icon: Settings },
                { href: '/accessibility' as const, label: t('accessibility'), icon: Accessibility },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-ink-700 transition-colors hover:bg-ink-100"
                >
                  <item.icon className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="truncate">{item.label}</span>
                </Link>
              ))}
            </nav>
            <div className="mt-3 flex items-center gap-2 border-t border-ink-100 pt-3">
              <ThemeToggle />
              <LanguageSwitcher />
            </div>
            <form action={onSignOut} onSubmit={() => clearOpenFiles()} className="mt-3">
              <Button type="submit" variant="ghost" size="sm" className="w-full justify-start">
                <LogOut className="h-4 w-4" />
                {t('signOut')}
              </Button>
            </form>
          </SheetContent>
          {/* The phone's tab bar, inside the Sheet so its "more" is the
              drawer's trigger and gets focus back when the drawer closes.
              Fixed to the window's foot, so its place in the tree is only
              its place in the reading order: after the header, before the
              page, like any navigation. */}
          <BottomTabBar />
        </Sheet>

        {/* `tabIndex={-1}` so the skip link can move focus here, not merely
            scroll to it — otherwise the next Tab would resume from the top.
            The bottom padding clears the phone's tab bar and home indicator. */}
        <main
          id="main-content"
          tabIndex={-1}
          className="min-w-0 flex-1 p-4 pb-[calc(var(--bottom-bar,0px)+env(safe-area-inset-bottom)+1rem)] sm:p-6 sm:pb-[calc(var(--bottom-bar,0px)+env(safe-area-inset-bottom)+1.5rem)] focus:outline-none"
        >
          {children}
        </main>
      </div>
    </div>
  );
}

/**
 * The page heading now lives in the shared kit, so the sign-in and print
 * screens use the same one. Re-exported here so the forty-odd pages that
 * import it from the shell keep working.
 */
export { PageHeader } from '@clinic/ui';
