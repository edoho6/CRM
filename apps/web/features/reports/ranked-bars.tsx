/**
 * A ranking, as horizontal bars.
 *
 * Horizontal rather than vertical because the labels are words — herb names,
 * point codes, treatment statuses — and words on a vertical axis are either
 * rotated or truncated. Read along the bar, the label sits beside it at full
 * length in either script.
 *
 * Not a pie. Six statuses in a pie is six wedges nobody can order by eye, and
 * the question here is always "which is biggest", which a sorted bar answers by
 * being sorted.
 *
 * A server component: it takes numbers and draws them, with no state of its own.
 * Plain divs rather than SVG — a horizontal bar is a box with a width, and CSS
 * does that natively with text that wraps and reflows in RTL for free.
 */

export interface RankedRow {
  label: string;
  value: number;
  /** Shown at the end of the bar. Falls back to the value. */
  display?: string;
}

export function RankedBars({ rows }: { rows: RankedRow[] }) {
  const max = Math.max(1, ...rows.map((row) => row.value));

  return (
    <ul className="space-y-1.5">
      {rows.map((row) => (
        <li key={row.label} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-2">
          <span className="truncate text-xs text-ink-700" dir="auto" title={row.label}>
            {row.label}
          </span>
          {/* The track makes the proportion readable: without it a short bar and
              a missing bar look the same.

              An outline rather than a filled grey. Filled, the bar had to clear
              3:1 against the track *and* the track against the card, and in dark
              mode the first of those measured 2.68:1 — a bar you could not see
              on its own track. Outlined, the bar sits on the card surface, which
              it was measured against in the first place. */}
          <span className="h-3 w-full overflow-hidden rounded-sm border border-ink-200">
            <span
              className="block h-full"
              style={{
                // Always at least a sliver, so a real but small value is visible
                // rather than reading as nothing.
                width: `${Math.max((row.value / max) * 100, row.value > 0 ? 1.5 : 0)}%`,
                backgroundColor: 'var(--color-series-1)',
              }}
            />
          </span>
          <span className="text-xs tabular-nums text-ink-700" dir="ltr">
            {row.display ?? row.value}
          </span>
        </li>
      ))}
    </ul>
  );
}
