'use client';

import { useTranslations } from 'next-intl';
import { ChevronUp, LogOut, UserCog } from 'lucide-react';
import { Popover, cn } from '@clinic/ui';
import { Link } from '@clinic/i18n/navigation';
import { LanguageSwitcher } from './language-switcher';
import { ThemeToggle } from './theme-toggle';
import { clearOpenFiles } from '@/features/workspace/open-files';

/**
 * Who you are, and the handful of things that belong to you rather than to the
 * clinic: the personal area, how the interface looks, and the way out.
 *
 * These used to be four rows in the sidebar footer. Two of them — the theme and
 * the language — are switches most people touch twice a year, and each was
 * taking a full row of a 240px panel permanently. Folded into a menu behind your
 * own name they cost nothing until wanted, which is the right price for a
 * setting you have already set.
 *
 * The accessibility statement deliberately stays *outside* this menu, as a
 * visible link. A statement that takes two clicks to reach does not meet the
 * requirement it exists to answer.
 *
 * Anchored with `Popover`, which portals to `body` and positions `fixed`. That
 * is not optional here: the sidebar is `sticky` with an `overflow-y-auto`
 * middle, so an absolutely positioned panel would be clipped by its own parent.
 * Sitting at the bottom of the window, the panel also has to open upwards, which
 * `useAnchoredPosition` already handles by measuring.
 */

/** One or two letters, for the collapsed rail where there is no room for a name. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 1).toUpperCase();
  return (parts[0]!.slice(0, 1) + parts[parts.length - 1]!.slice(0, 1)).toUpperCase();
}

export function UserMenu({
  userName,
  collapsed,
  onSignOut,
}: {
  userName: string;
  collapsed: boolean;
  onSignOut: () => Promise<void>;
}) {
  const t = useTranslations('nav');

  const avatar = (
    <span
      aria-hidden
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink-100 text-xs font-semibold text-ink-700"
    >
      {initials(userName)}
    </span>
  );

  return (
    <Popover
      className="w-full"
      align="start"
      width={224}
      triggerLabel={t('userMenu', { name: userName })}
      triggerTitle={collapsed ? userName : undefined}
      triggerClassName={cn(
        'flex w-full items-center gap-2 rounded-lg py-1.5 text-sm transition-colors hover:bg-ink-100',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
        collapsed ? 'justify-center px-0' : 'px-2',
      )}
      panelLabel={t('userMenu', { name: userName })}
      triggerContent={
        collapsed ? (
          avatar
        ) : (
          <>
            {avatar}
            <span className="min-w-0 flex-1 truncate text-start text-ink-800" dir="auto">
              {userName}
            </span>
            <ChevronUp className="h-3.5 w-3.5 shrink-0 text-ink-500" aria-hidden />
          </>
        )
      }
    >
      {({ close }) => (
        <div className="space-y-2">
          <Link
            href="/account"
            onClick={close}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-ink-800 transition-colors hover:bg-ink-100"
          >
            <UserCog className="h-4 w-4 text-ink-600" aria-hidden />
            {t('account')}
          </Link>

          <div className="space-y-2 border-t border-ink-100 pt-2">
            <ThemeToggle className="w-full" />
            <LanguageSwitcher className="w-full justify-center" />
          </div>

          {/* Signing out clears the open-files strip. A shared clinic computer
              must not still be listing who the last person had open — which is
              why this handler travels with the form wherever the form goes. */}
          <form action={onSignOut} onSubmit={() => clearOpenFiles()} className="border-t border-ink-100 pt-2">
            <button
              type="submit"
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-start text-sm text-ink-800 transition-colors hover:bg-ink-100"
            >
              <LogOut className="h-4 w-4 text-ink-600" aria-hidden />
              {t('signOut')}
            </button>
          </form>
        </div>
      )}
    </Popover>
  );
}
