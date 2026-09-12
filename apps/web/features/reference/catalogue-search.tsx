'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Search, X } from 'lucide-react';
import { Input, Spinner, cn } from '@clinic/ui';
import { usePathname, useRouter } from '@clinic/i18n/navigation';
import { useSearchParams } from 'next/navigation';

/**
 * Search for a catalogue list — herbs, formulas, points, prices.
 *
 * The same field as the patient list's: a magnifier at the start, the words
 * inside, a clear button once there is something to clear. It used to be a
 * magnifier that grew into a field on hover, like the global search in the
 * top bar, and that was a second way of searching a list on the same product:
 * a person who learned the patient list looked for a box and found a button.
 * It filters the page rather than opening a results panel — the results are
 * already the page.
 *
 * Only `q` is rewritten; every other parameter is carried through, so typing
 * never silently clears the filters underneath.
 */
export function CatalogueSearch({
  initialQuery,
  placeholder,
  className,
}: {
  initialQuery: string;
  placeholder: string;
  className?: string;
}) {
  const t = useTranslations('common');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);

  const [value, setValue] = useState(initialQuery);
  const [isPending, startTransition] = useTransition();

  const currentParams = searchParams.toString();

  useEffect(() => {
    const timer = setTimeout(() => {
      if (value.trim() === initialQuery) return;
      const next = new URLSearchParams(currentParams);
      if (value.trim()) next.set('q', value.trim());
      else next.delete('q');
      // A new search starts from the first page; a stale page is an empty page.
      next.delete('page');
      startTransition(() => {
        router.replace({ pathname, query: Object.fromEntries(next) });
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [value, initialQuery, currentParams, pathname, router]);

  return (
    // Full width on a phone, a fixed width from `sm`: a fixed width smaller
    // than the phone is still wider than it at 200% text, and a flex row
    // cannot shrink a definite width below itself.
    <div className={cn('relative w-full min-w-0 sm:w-64 lg:w-80', className)}>
      <Search
        className="pointer-events-none absolute inset-y-0 start-3 my-auto h-4 w-4 text-ink-500"
        aria-hidden
      />
      <Input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        // The browser's own clear button would sit beside ours.
        className="ps-9 pe-9 [&::-webkit-search-cancel-button]:appearance-none"
      />
      <span className="absolute inset-y-0 end-1 my-auto flex h-8 items-center">
        {isPending ? (
          <Spinner className="text-ink-500" />
        ) : value ? (
          <button
            type="button"
            onClick={() => {
              setValue('');
              inputRef.current?.focus();
            }}
            aria-label={t('clear')}
            title={t('clear')}
            className="flex h-8 w-8 items-center justify-center rounded-md text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-800"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        ) : null}
      </span>
    </div>
  );
}
