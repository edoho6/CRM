'use client';

import * as React from 'react';
import { Rows2, Rows3, Rows4 } from 'lucide-react';
import { cn } from './cn';
import { useUiLabels } from './ui-labels';

/**
 * How big the rows of a list are — chosen by the person reading, kept by the
 * browser, the same for every table in the app.
 *
 * Three steps: tight rows for scanning two hundred patients, the default,
 * and roomy rows for a screen read at arm's length or with larger type. The
 * choice is an attribute on `<html>`; the stylesheet does the rest (see
 * `[data-table-size]` in base.css). One preference, not
 * one per table: a person who wants bigger rows wants them everywhere, and a
 * setting to rediscover on each screen would be a setting never used.
 */
export type TableSize = 'compact' | 'regular' | 'large';

const SIZES: readonly TableSize[] = ['compact', 'regular', 'large'];
const STORAGE_KEY = 'herbalist-table-size';
/** Fired on the window when the size changes, so every table on the page follows at once. */
const CHANGE_EVENT = 'herbalist:table-size';
const ICONS = { compact: Rows4, regular: Rows3, large: Rows2 } as const;

function storedSize(): TableSize {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return SIZES.includes(value as TableSize) ? (value as TableSize) : 'regular';
  } catch {
    return 'regular';
  }
}

export function TableSizeControl({ className }: { className?: string }) {
  const labels = useUiLabels().tableSize;
  const [size, setSize] = React.useState<TableSize>('regular');

  React.useEffect(() => {
    const apply = () => {
      const next = storedSize();
      setSize(next);
      // One attribute on <html> reaches every table; the app's pre-paint
      // script writes the same attribute before React runs, so the first
      // paint already has the remembered rows.
      document.documentElement.dataset.tableSize = next;
    };
    apply();
    window.addEventListener(CHANGE_EVENT, apply);
    window.addEventListener('storage', apply);
    return () => {
      window.removeEventListener(CHANGE_EVENT, apply);
      window.removeEventListener('storage', apply);
    };
  }, []);

  if (!labels) return null;

  function choose(next: TableSize) {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Site data blocked: the size holds for this page only.
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }

  return (
    <div
      role="group"
      aria-label={labels.title}
      className={cn(
        'hidden items-center justify-end gap-0.5 border-b border-ink-100 px-1.5 py-1 md:flex',
        className,
      )}
    >
      {SIZES.map((candidate) => {
        const Icon = ICONS[candidate];
        const selected = size === candidate;
        return (
          <button
            key={candidate}
            type="button"
            aria-pressed={selected}
            aria-label={labels[candidate]}
            title={labels[candidate]}
            onClick={() => choose(candidate)}
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-md transition-colors pointer-coarse:h-11 pointer-coarse:w-11',
              selected
                ? 'bg-ink-100 text-ink-900'
                : 'text-ink-500 hover:bg-ink-100 hover:text-ink-800',
            )}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden />
          </button>
        );
      })}
    </div>
  );
}
