'use client';

import { useState } from 'react';
import { useLocale } from 'next-intl';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Folds one day of the diary list away, and back.
 *
 * The list is drawn on the server, so the day's rows are already on the page;
 * this only marks the day's `<tbody>` as folded and the stylesheet hides its
 * rows (`tbody[data-collapsed]` in base.css) — no refetch, no rows moved
 * between components. Not remembered: the list keeps no state between visits.
 */
export function ListDayToggle({
  bodyId,
  label,
}: {
  /** The id of the day's `<tbody>`. */
  bodyId: string;
  /** "Fold …" / "Unfold …" with the day in it, for a screen reader. */
  label: { fold: string; unfold: string };
}) {
  const [folded, setFolded] = useState(false);
  // Folded, the arrow points along the line of reading: left in Hebrew.
  const Folded = useLocale() === 'he' ? ChevronLeft : ChevronRight;

  function toggle() {
    const body = document.getElementById(bodyId);
    if (!body) return;
    const next = !folded;
    if (next) body.setAttribute('data-collapsed', '');
    else body.removeAttribute('data-collapsed');
    setFolded(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-expanded={!folded}
      aria-controls={bodyId}
      aria-label={folded ? label.unfold : label.fold}
      title={folded ? label.unfold : label.fold}
      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
    >
      {folded ? (
        <Folded className="h-4 w-4" aria-hidden />
      ) : (
        <ChevronDown className="h-4 w-4" aria-hidden />
      )}
    </button>
  );
}
