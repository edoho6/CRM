'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { CalendarRange } from 'lucide-react';
import { Button, SegmentedControl, cn } from '@clinic/ui';
import { usePathname, useRouter } from '@clinic/i18n/navigation';
import { useSearchParams } from 'next/navigation';
import { RANGE_PRESETS, type RangePreset } from '@/lib/date-range';
import { DateInput } from './date-input';

/**
 * Today / last week / last month / everything, with a date pair behind the last
 * segment.
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

  const selected: RangePreset = showCustom || hasCustom ? 'custom' : current;

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <SegmentedControl
        label={t('dateRange')}
        value={selected}
        onChange={(preset) => {
          if (preset === 'custom') {
            setShowCustom(true);
            return;
          }
          setShowCustom(false);
          apply({ range: preset === 'all' ? null : preset, from: null, to: null });
        }}
        options={RANGE_PRESETS.map((preset) => ({
          value: preset,
          label: t(preset),
          icon:
            preset === 'custom' ? <CalendarRange className="h-3.5 w-3.5" aria-hidden /> : undefined,
        }))}
      />

      {showCustom ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <DateInput
            aria-label={t('from')}
            value={from}
            max={to || undefined}
            onChange={(event) => apply({ from: event.target.value || null, range: null })}
          />
          <span className="text-xs text-ink-600">–</span>
          <DateInput
            aria-label={t('to')}
            value={to}
            min={from || undefined}
            onChange={(event) => apply({ to: event.target.value || null, range: null })}
          />
          {hasCustom ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowCustom(false);
                apply({ from: null, to: null, range: null });
              }}
            >
              {t('clear')}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
