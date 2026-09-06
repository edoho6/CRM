'use client';

import { useTransition } from 'react';
import { useLocale } from 'next-intl';
import { Languages } from 'lucide-react';
import { LOCALE_LABELS, locales, type Locale } from '@clinic/i18n';
import { usePathname, useRouter } from '@clinic/i18n/navigation';
import { cn } from '@clinic/ui';

/**
 * Switches language while staying on the current page.
 *
 * `usePathname` from the locale-aware navigation returns the path *without* the
 * locale prefix, so replacing it with a new locale keeps the user exactly where
 * they were rather than bouncing them to the dashboard.
 */
export function LanguageSwitcher({ className }: { className?: string }) {
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function switchTo(next: Locale) {
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
      className={cn(
        'inline-flex items-center gap-0.5 rounded-lg border border-ink-200 bg-white p-0.5',
        isPending && 'opacity-60',
        className,
      )}
      role="group"
      aria-label={LOCALE_LABELS[locale]}
    >
      <Languages className="mx-1 h-3.5 w-3.5 text-ink-400" aria-hidden />
      {locales.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => switchTo(option)}
          aria-current={option === locale}
          className={cn(
            'rounded-md px-2 py-1 text-xs font-medium transition-colors',
            option === locale ? 'bg-jade-600 text-white' : 'text-ink-600 hover:bg-ink-100',
          )}
        >
          {LOCALE_LABELS[option]}
        </button>
      ))}
    </div>
  );
}
