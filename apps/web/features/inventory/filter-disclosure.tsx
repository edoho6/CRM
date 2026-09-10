import { SlidersHorizontal } from 'lucide-react';

/**
 * The closed lid over a catalogue's filters.
 *
 * A plain `<details>`, so it opens without JavaScript and works from a server
 * component and a client one alike. It starts open whenever something is
 * already filtered: an active filter must never be able to hide behind a
 * closed lid, or the reader is left wondering why rows are missing.
 */
export function FilterDisclosure({
  title,
  activeCount,
  children,
}: {
  title: string;
  activeCount: number;
  children: React.ReactNode;
}) {
  return (
    <details
      open={activeCount > 0}
      className="rounded-card border border-ink-200 bg-white [&[open]_.facet-chevron]:rotate-180"
    >
      <summary className="flex list-none items-center gap-2 px-3 py-2 text-sm font-medium text-ink-700 transition-colors hover:bg-ink-50">
        <SlidersHorizontal className="h-4 w-4 text-ink-500" />
        {title}
        {activeCount > 0 ? (
          <span className="rounded-full bg-jade-100 px-2 py-0.5 text-xs font-semibold text-jade-800">
            {activeCount}
          </span>
        ) : null}
        <span className="facet-chevron ms-auto text-xs text-ink-500 transition-transform">▾</span>
      </summary>
      <div className="space-y-4 border-t border-ink-100 px-3 py-3">{children}</div>
    </details>
  );
}
