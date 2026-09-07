'use client';

import { useRef, useState, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Check, Languages } from 'lucide-react';
import { LOCALE_LABELS, locales, type Locale } from '@clinic/i18n';
import { usePathname, useRouter } from '@clinic/i18n/navigation';
import { cn } from '@clinic/ui';

/**
 * Switches language while staying on the current page.
 *
 * Collapsed to the globe alone, because two permanently visible language names
 * are two words of furniture for a choice made about twice a year. The list
 * opens on hover, and — since hover is not available to a keyboard or a touch
 * screen — on focus and on click as well, which is what keeps it usable rather
 * than merely tidy.
 *
 * `usePathname` from the locale-aware navigation returns the path *without* the
 * locale prefix, so replacing it with a new locale keeps the user exactly where
 * they were rather than bouncing them to the dashboard.
 */
export function LanguageSwitcher({ className }: { className?: string }) {
  const locale = useLocale() as Locale;
  const t = useTranslations('common');
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<number | null>(null);

  function cancelClose() {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }

  // A short grace period, so crossing the gap between the button and the menu
  // does not close it under the pointer.
  function scheduleClose() {
    cancelClose();
    closeTimer.current = window.setTimeout(() => setOpen(false), 160);
  }

  function switchTo(next: Locale) {
    setOpen(false);
    if (next === locale) return;
    startTransition(() => {
      // `usePathname` here returns the path without its locale prefix and with
      // dynamic segments already resolved, so re-requesting it under a different
      // locale keeps the user on the same record instead of the dashboard.
      router.replace(pathname, { locale: next });
    });
  }

  return (
    <div
      className={cn('relative inline-flex', className)}
      onMouseEnter={() => {
        cancelClose();
        setOpen(true);
      }}
      onMouseLeave={scheduleClose}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') setOpen(false);
      }}
    >
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('language')}
        title={t('language')}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          'inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-ink-200 bg-white px-2 text-ink-600 transition-colors hover:bg-ink-50 hover:text-ink-900',
          isPending && 'opacity-60',
        )}
      >
        <Languages className="h-4 w-4" aria-hidden />
      </button>

      {open ? (
        <ul
          role="menu"
          aria-label={t('language')}
          className="absolute bottom-full z-30 mb-1 min-w-32 rounded-lg border border-ink-200 bg-white py-1 shadow-lg"
        >
          {locales.map((option) => (
            <li key={option}>
              <button
                type="button"
                role="menuitemradio"
                aria-checked={option === locale}
                onClick={() => switchTo(option)}
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-1.5 text-start text-sm transition-colors',
                  option === locale
                    ? 'font-semibold text-jade-800'
                    : 'text-ink-700 hover:bg-ink-50',
                )}
              >
                <Check
                  className={cn(
                    'h-3.5 w-3.5 shrink-0',
                    option === locale ? 'opacity-100' : 'opacity-0',
                  )}
                  aria-hidden
                />
                {LOCALE_LABELS[option]}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
