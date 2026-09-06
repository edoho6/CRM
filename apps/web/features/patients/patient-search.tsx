'use client';

import { useEffect, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Search } from 'lucide-react';
import { Checkbox, Input, Spinner } from '@clinic/ui';
import { usePathname, useRouter } from '@clinic/i18n/navigation';

/**
 * Search box for the patient list.
 *
 * Debounced and pushed into the URL rather than held in component state, so a
 * search can be bookmarked, shared, and survives a back navigation.
 */
export function PatientSearch({
  initialQuery,
  showInactive,
}: {
  initialQuery: string;
  showInactive: boolean;
}) {
  const t = useTranslations('patients');
  const router = useRouter();
  const pathname = usePathname();
  const [value, setValue] = useState(initialQuery);
  const [inactive, setInactive] = useState(showInactive);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const timer = setTimeout(() => {
      if (value === initialQuery && inactive === showInactive) return;
      const query: Record<string, string> = {};
      if (value.trim()) query.q = value.trim();
      if (inactive) query.inactive = '1';
      startTransition(() => {
        router.replace({ pathname, query });
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [value, inactive, initialQuery, showInactive, pathname, router]);

  return (
    <div className="flex flex-wrap items-center gap-3">
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
      <label className="flex items-center gap-2 text-sm text-ink-600">
        <Checkbox checked={inactive} onChange={(event) => setInactive(event.target.checked)} />
        {t('showInactive')}
      </label>
      {isPending ? <Spinner className="text-ink-400" /> : null}
    </div>
  );
}
