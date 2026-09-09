'use client';

import { useState, useTransition } from 'react';
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
 * opens on click, and only on click.
 *
 * It used to open on hover as well. That is the wrong behaviour for a control
 * that changes the language of the whole application: the menu appeared when the
 * pointer merely crossed it on the way somewhere else, and a menu that opens
 * without being asked is one you close by accident and open by accident. Click
 * is also the one gesture a keyboard, a mouse and a touch screen all have.
 *
 * `usePathname` from the locale-aware navigation returns the path *without* the
 * locale prefix, so replacing it with a new locale keeps the user exactly where
 * they were rather than bouncing them to the dashboard.
 */
export function LanguageSwitcher({
  className,
  placement = 'up',
}: {
  className?: string;
  /**
   * Which way the list opens. Up is right for the sidebar foot and the user
   * menu, where the control sits at the bottom of the screen. The instance in
   * the top bar was opening upward too — straight off the top of the viewport
   * at tablet widths, where it is the only language control on the page.
   */
  placement?: 'up' | 'down';
}) {
  const locale = useLocale() as Locale;
  const t = useTranslations('common');
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

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
      // Still closes when focus leaves the group and on Escape — those are how
      // the menu is dismissed without a pointer, and neither of them opens it.
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
          className={cn(
            'absolute z-popover min-w-32 rounded-lg border border-ink-200 bg-white py-1 shadow-lg',
            // Fades in only — it may open in either direction, so a slide would
            // be right for one placement and wrong for the other.
            'transition-opacity duration-(--duration-fast) ease-standard starting:opacity-0',
            placement === 'up' ? 'bottom-full mb-1' : 'top-full mt-1',
          )}
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
