'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Search, X } from 'lucide-react';
import { Spinner, cn } from '@clinic/ui';
import { usePathname, useRouter } from '@clinic/i18n/navigation';

/**
 * Search for a catalogue list, wearing the same clothes as the global search in
 * the top bar: the magnifier is the resting state and the field grows out of it.
 *
 * Two differences follow from where it sits. It filters the page rather than
 * opening a results panel — the results are already the page. And once a term
 * is active the field stays open, because a search box that collapses over a
 * filtered list leaves no visible reason why rows are missing.
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
  const closeTimer = useRef<number | null>(null);

  const [value, setValue] = useState(initialQuery);
  const [open, setOpen] = useState(Boolean(initialQuery));
  const [isPending, startTransition] = useTransition();

  const currentParams = searchParams.toString();
  const expanded = open || Boolean(value);

  function cancelClose() {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }

  function reveal() {
    cancelClose();
    setOpen(true);
  }

  function scheduleClose() {
    cancelClose();
    closeTimer.current = window.setTimeout(() => setOpen(false), 220);
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      if (value.trim() === initialQuery) return;
      const next = new URLSearchParams(currentParams);
      if (value.trim()) next.set('q', value.trim());
      else next.delete('q');
      startTransition(() => {
        router.replace({ pathname, query: Object.fromEntries(next) });
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [value, initialQuery, currentParams, pathname, router]);

  return (
    <div
      className={cn('relative inline-flex', className)}
      onMouseEnter={reveal}
      onMouseLeave={scheduleClose}
    >
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          aria-label={t('search')}
          title={t('search')}
          aria-expanded={expanded}
          onClick={() => (expanded ? inputRef.current?.focus() : reveal())}
          onFocus={reveal}
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-ink-200 bg-white text-ink-600',
            'transition-all duration-150 ease-out',
            'hover:-translate-y-px hover:border-jade-300 hover:bg-jade-50 hover:text-jade-800 hover:shadow-md',
            expanded && 'border-jade-300 bg-jade-50 text-jade-800',
          )}
        >
          <Search className="h-5 w-5" aria-hidden />
        </button>

        {/* Width animates rather than mounting, so the field keeps its focus and
            its caret position while the box grows. */}
        <div
          className={cn(
            'relative overflow-hidden transition-all duration-200 ease-out',
            expanded ? 'w-64 opacity-100 sm:w-80' : 'w-0 opacity-0',
          )}
        >
          <input
            ref={inputRef}
            type="search"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onFocus={reveal}
            placeholder={placeholder}
            aria-label={placeholder}
            tabIndex={expanded ? 0 : -1}
            className={cn(
              'h-11 w-full rounded-xl border border-ink-200 bg-white px-3 pe-8 text-sm text-start text-ink-900',
              'shadow-xs transition-colors placeholder:text-ink-500',
              'focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-focus focus-visible:border-focus',
            )}
          />
          {value ? (
            <button
              type="button"
              onClick={() => {
                setValue('');
                inputRef.current?.focus();
              }}
              aria-label={t('clear')}
              className="absolute inset-y-0 end-2 my-auto flex h-6 w-6 items-center justify-center rounded-md text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-800"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          ) : null}
        </div>

        {isPending ? <Spinner className="text-ink-500" /> : null}
      </div>
    </div>
  );
}
