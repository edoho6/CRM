'use client';

import { useSyncExternalStore } from 'react';
import { useTranslations } from 'next-intl';
import { Columns3, X } from 'lucide-react';
import { Button, cn } from '@clinic/ui';
import { Link } from '@clinic/i18n/navigation';
import {
  clear,
  getServerSnapshot,
  getSnapshot,
  MAX_COMPARE,
  subscribe,
  toggle,
  type CompareItem,
  type CompareKind,
} from './compare-store';

function useCompare(): CompareItem[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * The tick in a catalogue row.
 *
 * A checkbox rather than a button, because that is what it is: an on/off choice
 * that accumulates. It carries its own label for screen readers — "compare
 * Bai Shao" says what ticking it does, where a bare checkbox in a table column
 * says nothing at all.
 */
export function CompareToggle({
  kind,
  id,
  label,
}: {
  kind: CompareKind;
  id: string;
  label: string;
}) {
  const t = useTranslations('reference.compare');
  const items = useCompare();
  const checked = items.some((entry) => entry.kind === kind && entry.id === id);

  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={() => toggle({ kind, id, label })}
      aria-label={t('toggle', { name: label })}
      className="h-4 w-4 cursor-pointer rounded border-ink-300 accent-jade-700"
    />
  );
}

/**
 * The tray that appears once something is ticked.
 *
 * Fixed to the bottom of the window rather than sitting in the page flow: the
 * catalogue is long, the ticks happen while scrolling, and a Compare button that
 * scrolls away is a button that is never pressed.
 *
 * Renders nothing when nothing is ticked, so it costs no space until it is
 * doing something.
 */
export function CompareTray() {
  const t = useTranslations('reference.compare');
  const tc = useTranslations('common');
  const items = useCompare();

  if (items.length === 0) return null;

  const kind = items[0]!.kind;
  const href = `/reference/compare?kind=${kind}&ids=${items.map((item) => item.id).join(',')}`;
  const enough = items.length >= 2;

  return (
    <div
      // A live region: the count changes as rows are ticked while the focus stays
      // in the table, and a tray that appears silently is a tray that is missed.
      role="status"
      aria-live="polite"
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 border-t border-ink-200 bg-white px-4 py-2 shadow-lg',
        'flex flex-wrap items-center gap-2',
      )}
    >
      <span className="text-sm font-medium text-ink-900">
        {t('selected', { count: items.length, max: MAX_COMPARE })}
      </span>

      <ul className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
        {items.map((item) => (
          <li key={`${item.kind}:${item.id}`}>
            <span className="inline-flex items-center gap-1 rounded-md border border-ink-200 bg-ink-50 py-0.5 ps-2 pe-0.5 text-xs">
              <span className="max-w-[10rem] truncate" dir="auto">
                {item.label}
              </span>
              <button
                type="button"
                onClick={() => toggle(item)}
                aria-label={t('remove', { name: item.label })}
                className="rounded p-0.5 text-ink-500 transition-colors hover:bg-ink-200 hover:text-ink-900"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          </li>
        ))}
      </ul>

      <div className="flex shrink-0 items-center gap-1.5">
        <Button type="button" variant="ghost" size="sm" onClick={() => clear()}>
          {tc('clear')}
        </Button>
        {/* Two is the fewest that can be compared. Below that the button is
            present but disabled, which says what is missing; hiding it would
            leave the tick looking like it did nothing. */}
        <Button asChild size="sm" disabled={!enough}>
          {enough ? (
            <Link href={href}>
              <Columns3 className="h-4 w-4" />
              {t('compare')}
            </Link>
          ) : (
            <span>
              <Columns3 className="h-4 w-4" />
              {t('needTwo')}
            </span>
          )}
        </Button>
      </div>
    </div>
  );
}
