'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronRight } from 'lucide-react';
import { cn } from '@clinic/ui';
import { usePathname, useRouter } from '@clinic/i18n/navigation';
import { TAB_ROOTS } from './bottom-tab-bar';

/**
 * Back, without reaching for the browser's own.
 *
 * Invisible — not absent — on the first page of a visit, because there is
 * nowhere to go back to and a button that does nothing is worse than no button.
 * `history.length` is the only signal available for that, and it is imperfect —
 * it counts entries from before this tab reached the app — so it is read once
 * after mount rather than trusted mid-render.
 *
 * It keeps its space while hidden. Returning `null` meant the top bar's leading
 * half was empty on the first page and then jumped when the button appeared on
 * the second, and every control beside it shifted with it. `invisible` holds
 * the box and takes the control out of the tab order and the accessibility
 * tree, so nothing moves and nothing is announced.
 *
 * The arrow is mirrored for Hebrew. "Back" is towards the start of the line,
 * which is left in English and right in Hebrew — an arrow that points the same
 * way in both is pointing the wrong way in one of them.
 */
export function BackButton({ className }: { className?: string }) {
  const t = useTranslations('common');
  const router = useRouter();
  const pathname = usePathname();
  // A tab's own screen has a tab bar under it; "back" there is the bar.
  const onTabRoot = (TAB_ROOTS as readonly string[]).includes(pathname);

  // Rendered only after mount: the server has no history, and drawing the
  // button and then removing it is a flash of a control that was never real.
  const [canGoBack, setCanGoBack] = useState(false);

  useEffect(() => {
    setCanGoBack(window.history.length > 1);
  }, []);

  return (
    <button
      type="button"
      onClick={() => router.back()}
      aria-hidden={!canGoBack}
      tabIndex={canGoBack ? undefined : -1}
      className={cn(
        'no-print inline-flex min-h-10 shrink-0 items-center gap-1 rounded-md px-2 py-1 text-sm font-medium',
        'text-ink-600 transition-colors hover:bg-ink-100 hover:text-ink-900 active:bg-ink-200',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
        !canGoBack && 'invisible',
        onTabRoot && 'max-lg:hidden',
        className,
      )}
    >
      <ChevronRight aria-hidden className="h-4 w-4 shrink-0 ltr:rotate-180" />
      <span className="max-sm:sr-only">{t('back')}</span>
    </button>
  );
}
