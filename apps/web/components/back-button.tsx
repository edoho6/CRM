'use client';

import { useTranslations } from 'next-intl';
import { ChevronRight } from 'lucide-react';
import { cn } from '@clinic/ui';
import { Link, usePathname } from '@clinic/i18n/navigation';
import { parentPath } from '@/lib/parent-path';
import { TAB_ROOTS } from './bottom-tab-bar';

/**
 * Up one level, without reaching for the browser's own back.
 *
 * It used to be `history.back()`, and that is the wrong question. A formula
 * opened from a treatment went back into the treatment; a patient reached from
 * the calendar went back to the calendar. Where a record sits is written in
 * its address, and this follows that: a formula goes to the formula list, the
 * formula list goes to the dashboard. Two presses from anywhere deep, always
 * the same two, whatever route you took to get there — see `lib/parent-path.ts`
 * for the one exception, a path that is only a redirect.
 *
 * A link rather than a button, now that there is a destination to name: it
 * shows in the status bar, opens in a new tab on a middle click, and needs no
 * script to work.
 *
 * Invisible — not absent — on the dashboard, which is the one page with
 * nothing above it. It keeps its space while hidden: returning `null` left the
 * top bar's leading half empty there and then jumped when the link appeared on
 * the next page, and every control beside it shifted with it. `invisible`
 * holds the box and takes the link out of the tab order and the accessibility
 * tree, so nothing moves and nothing is announced.
 *
 * The arrow is mirrored for Hebrew. "Back" is towards the start of the line,
 * which is left in English and right in Hebrew — an arrow that points the same
 * way in both is pointing the wrong way in one of them.
 */
export function BackButton({ className }: { className?: string }) {
  const t = useTranslations('common');
  const pathname = usePathname();
  const parent = parentPath(pathname);
  // A tab's own screen has a tab bar under it; "back" there is the bar.
  const onTabRoot = (TAB_ROOTS as readonly string[]).includes(pathname);

  return (
    <Link
      href={parent ?? '/'}
      aria-hidden={!parent}
      tabIndex={parent ? undefined : -1}
      className={cn(
        'no-print inline-flex min-h-10 shrink-0 items-center gap-1 rounded-md px-2 py-1 text-sm font-medium',
        'text-ink-600 transition-colors hover:bg-ink-100 hover:text-ink-900 active:bg-ink-200',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
        !parent && 'invisible',
        onTabRoot && 'max-lg:hidden',
        className,
      )}
    >
      <ChevronRight aria-hidden className="h-4 w-4 shrink-0 ltr:rotate-180" />
      <span className="max-sm:sr-only">{t('back')}</span>
    </Link>
  );
}
