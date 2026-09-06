'use client';

import { useEffect, useState, useTransition } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Search } from 'lucide-react';
import { Input, Spinner } from '@clinic/ui';
import { usePathname, useRouter } from '@clinic/i18n/navigation';

/**
 * Debounced free-text search for a catalogue list.
 *
 * It rewrites only the `q` parameter and carries every other one through
 * untouched, so typing in the box never silently clears the filters the user
 * just picked.
 */
export function HerbSearch({
  initialQuery,
  placeholder,
}: {
  initialQuery: string;
  placeholder?: string;
}) {
  const t = useTranslations('inventory.herbs');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(initialQuery);
  const [isPending, startTransition] = useTransition();
  const label = placeholder ?? t('searchPlaceholder');

  const currentParams = searchParams.toString();

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
    <div className="flex items-center gap-3">
      <div className="relative min-w-64 flex-1">
        <Search
          className="pointer-events-none absolute inset-y-0 start-3 my-auto h-4 w-4 text-ink-400"
          aria-hidden
        />
        <Input
          type="search"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={label}
          aria-label={label}
          className="ps-9"
        />
      </div>
      {isPending ? <Spinner className="text-ink-400" /> : null}
    </div>
  );
}
