'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { CalendarRange } from 'lucide-react';
import { cn } from '@clinic/ui';
import { usePathname, useRouter } from '@clinic/i18n/navigation';
import { useSearchParams } from 'next/navigation';
import { RANGE_PRESETS, type RangePreset } from '@/lib/date-range';

/**
 * Today / last week / last month / everything, with a date pair behind the last
 * button.
 *
 * The four presets cover what is actually asked for day to day, and the custom
 * pair is folded away because it is the rare case and two empty date fields on
 * every screen are two pieces of furniture.
 *
 * The state is the URL. That makes a filtered list linkable and reloadable, and
 * — more usefully — lets the server do the filtering in its query rather than
 * sending a year of records to the browser to be hidden.
 *
 * Only `range`, `from` and `to` are rewritten; anything else in the query string
 * survives, so this composes with a search box or a sort without either having
 * to know about the other.
 */
export function DateRangeFilter({ className }: { className?: string }) {
  const t = useTranslations('filters');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const current = (searchParams.get('range') ?? 'all') as RangePreset;
  const from = searchParams.get('from') ?? '';
  const to = searchParams.get('to') ?? '';
  const hasCustom = Boolean(from || to);

  const [showCustom, setShowCustom] = useState(hasCustom);

  function apply(next: { range?: RangePreset | null; from?: string | null; to?: string | null }) {
    const params = new URLSearchParams(searchParams.toString());

    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }

    // Paging is meaningless once the filter changes underneath it.
    params.delete('page');

    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }

  const presets = RANGE_PRESETS.filter((preset) => preset !== 'custom');

  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      <div role="group" aria-label={t('dateRange')} className="flex flex-wrap gap-1">
        {presets.map((preset) => {
          const active = !hasCustom && current === preset;
          return (
            <button
              key={preset}
              type="button"
              aria-pressed={active}
              onClick={() => {
                setShowCustom(false);
                apply({ range: preset === 'all' ? null : preset, from: null, to: null });
              }}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                active
                  ? 'bg-accent text-accent-fg'
                  : 'border border-ink-200 bg-white text-ink-700 hover:bg-ink-50',
              )}
            >
              {t(preset)}
            </button>
          );
        })}

        <button
          type="button"
          aria-pressed={showCustom || hasCustom}
          aria-expanded={showCustom}
          onClick={() => setShowCustom((value) => !value)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors',
            hasCustom
              ? 'bg-accent text-accent-fg'
              : 'border border-ink-200 bg-white text-ink-700 hover:bg-ink-50',
          )}
        >
          <CalendarRange className="h-3.5 w-3.5" aria-hidden />
          {t('custom')}
        </button>
      </div>

      {showCustom ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {/* dir="ltr" on the inputs: a date reads left to right even in Hebrew,
              and the native picker lays its fields out that way regardless. */}
          <input
            type="date"
            dir="ltr"
            aria-label={t('from')}
            value={from}
            max={to || undefined}
            onChange={(event) => apply({ from: event.target.value || null, range: null })}
            className="h-8 rounded-lg border border-ink-200 bg-white px-2 text-xs text-ink-900 tabular-nums shadow-xs outline-none focus:border-jade-600"
          />
          <span className="text-xs text-ink-600">–</span>
          <input
            type="date"
            dir="ltr"
            aria-label={t('to')}
            value={to}
            min={from || undefined}
            onChange={(event) => apply({ to: event.target.value || null, range: null })}
            className="h-8 rounded-lg border border-ink-200 bg-white px-2 text-xs text-ink-900 tabular-nums shadow-xs outline-none focus:border-jade-600"
          />
          {hasCustom ? (
            <button
              type="button"
              onClick={() => apply({ from: null, to: null, range: null })}
              className="rounded-md px-2 py-1 text-xs text-ink-600 underline-offset-2 hover:text-ink-900 hover:underline"
            >
              {t('clear')}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
