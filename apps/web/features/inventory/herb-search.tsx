'use client';

import { useEffect, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Search } from 'lucide-react';
import { Input, Spinner } from '@clinic/ui';
import { usePathname, useRouter } from '@clinic/i18n/navigation';

/** Debounced search across all four herb name columns. */
export function HerbSearch({ initialQuery }: { initialQuery: string }) {
  const t = useTranslations('inventory.herbs');
  const router = useRouter();
  const pathname = usePathname();
  const [value, setValue] = useState(initialQuery);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const timer = setTimeout(() => {
      if (value === initialQuery) return;
      const query: Record<string, string> = {};
      if (value.trim()) query.q = value.trim();
      startTransition(() => {
        router.replace({ pathname, query });
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [value, initialQuery, pathname, router]);

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
          placeholder={t('searchPlaceholder')}
          aria-label={t('searchPlaceholder')}
          className="ps-9"
        />
      </div>
      {isPending ? <Spinner className="text-ink-400" /> : null}
    </div>
  );
}
