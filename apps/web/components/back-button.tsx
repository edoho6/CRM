'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronRight } from 'lucide-react';
import { cn } from '@clinic/ui';
import { useRouter } from '@clinic/i18n/navigation';

/**
 * Back, without reaching for the browser's own.
 *
 * Hidden on the first page of a visit, because there is nowhere to go back to
 * and a button that does nothing is worse than no button. `history.length` is
 * the only signal available for that, and it is imperfect — it counts entries
 * from before this tab reached the app — so it is read once after mount rather
 * than trusted mid-render, and the fallback is simply to show the control.
 *
 * The arrow is mirrored for Hebrew. "Back" is towards the start of the line,
 * which is left in English and right in Hebrew — an arrow that points the same
 * way in both is pointing the wrong way in one of them.
 */
export function BackButton({ className }: { className?: string }) {
  const t = useTranslations('common');
  const router = useRouter();

  // Rendered only after mount: the server has no history, and drawing the
  // button and then removing it is a flash of a control that was never real.
  const [canGoBack, setCanGoBack] = useState(false);

  useEffect(() => {
    setCanGoBack(window.history.length > 1);
  }, []);

  if (!canGoBack) return null;

  return (
    <button
      type="button"
      onClick={() => router.back()}
      className={cn(
        'no-print inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium',
        'text-ink-600 transition-colors hover:bg-ink-100 hover:text-ink-900',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        className,
      )}
    >
      <ChevronRight aria-hidden className="h-4 w-4 shrink-0 ltr:rotate-180" />
      {t('back')}
    </button>
  );
}
