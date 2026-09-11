'use client';

import { useState, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Check, Languages } from 'lucide-react';
import { LOCALE_LABELS, locales, type Locale } from '@clinic/i18n';
import { usePathname, useRouter } from '@clinic/i18n/navigation';
import { cn } from '@clinic/ui';

/**
 * Switches language while staying on the current page — the staff app's
 * control, with its words: the globe alone, a list that opens on click and
 * only on click, and the path kept so the person stays where they were.
 *
 * Its own copy rather than an import across apps, because the two are two
 * builds and the staff app's components folder is not on this one's path.
 */
export function LanguageSwitcher({ className }: { className?: string }) {
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
      router.replace(pathname, { locale: next });
    });
  }

  return (
    <div
      className={cn('relative inline-flex', className)}
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
          'inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-ink-200 bg-white px-3 text-sm text-ink-700 transition-colors hover:bg-ink-50 hover:text-ink-900 active:bg-ink-100',
          isPending && 'opacity-60',
        )}
      >
        <Languages className="h-4 w-4" aria-hidden />
        {LOCALE_LABELS[locale]}
      </button>

      {open ? (
        <ul
          role="menu"
          aria-label={t('language')}
          className="absolute bottom-full z-popover mb-1 min-w-32 rounded-lg border border-ink-200 bg-white py-1 shadow-lg transition-opacity duration-(--duration-fast) ease-standard starting:opacity-0"
        >
          {locales.map((option) => (
            <li key={option}>
              <button
                type="button"
                role="menuitemradio"
                aria-checked={option === locale}
                onClick={() => switchTo(option)}
                className={cn(
                  'flex min-h-10 w-full items-center gap-2 px-3 py-1.5 text-start text-sm transition-colors',
                  option === locale ? 'font-semibold text-jade-800' : 'text-ink-700 hover:bg-ink-50',
                )}
              >
                <Check
                  className={cn('h-3.5 w-3.5 shrink-0', option === locale ? 'opacity-100' : 'opacity-0')}
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
