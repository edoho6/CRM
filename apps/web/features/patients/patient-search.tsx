'use client';

import { useEffect, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { Search } from 'lucide-react';
import { Checkbox, Input, Spinner } from '@clinic/ui';
import { usePathname, useRouter } from '@clinic/i18n/navigation';

/**
 * Search box for the patient list.
 *
 * Debounced and pushed into the URL rather than held in component state, so a
 * search can be bookmarked, shared, and survives a back navigation.
 *
 * It rewrites only its own two parameters. It used to rebuild the whole query
 * from scratch, which meant that a status tile or a tag chip — both of which
 * set `inactive=1` on their way — was undone 300 ms later when this effect
 * noticed the prop had changed and "corrected" the URL back to nothing.
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
  const searchParams = useSearchParams();
  const [value, setValue] = useState(initialQuery);
  const [inactive, setInactive] = useState(showInactive);
  const [isPending, startTransition] = useTransition();

  // The URL is the truth: when another control changes it, this one follows.
  useEffect(() => {
    setInactive(showInactive);
  }, [showInactive]);
  useEffect(() => {
    setValue(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const term = value.trim();
      if (term === initialQuery && inactive === showInactive) return;
      const next = new URLSearchParams(searchParams.toString());
      if (term) next.set('q', term);
      else next.delete('q');
      if (inactive) next.set('inactive', '1');
      else next.delete('inactive');
      // A new search starts from the first page.
      next.delete('page');
      const query = next.toString();
      startTransition(() => {
        router.replace(query ? `${pathname}?${query}` : pathname);
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [value, inactive, initialQuery, showInactive, pathname, router, searchParams]);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative min-w-64 flex-1">
        <Search
          className="pointer-events-none absolute inset-y-0 start-3 my-auto h-4 w-4 text-ink-500"
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
      {isPending ? <Spinner className="text-ink-500" /> : null}
    </div>
  );
}
