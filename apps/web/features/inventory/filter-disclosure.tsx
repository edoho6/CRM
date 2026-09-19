'use client';

import { useState, useSyncExternalStore } from 'react';
import { useTranslations } from 'next-intl';
import { SlidersHorizontal } from 'lucide-react';
import { Button, Dialog, DialogContent, DialogFooter } from '@clinic/ui';

/**
 * The closed lid over a catalogue's filters.
 *
 * On a desk, a plain `<details>`: it opens in place, above the list, and
 * starts open whenever something is already filtered — an active filter must
 * never be able to hide behind a closed lid, or the reader is left wondering
 * why rows are missing.
 *
 * **The lid belongs to the reader, not to the filter count.** It used to be
 * `open={activeCount > 0}` straight from the props, which meant clearing the
 * last filter shut the whole panel: you pressed "clear", the chips vanished
 * along with the clear link itself, and the only evidence anything had
 * happened was rows appearing below. That reads as a button that does not
 * work, and it made removing a filter cost a reopen every time. So the count
 * may *open* the lid — a filter arriving from a link elsewhere must not hide —
 * and never closes it. Only the summary does that.
 *
 * On a phone the same filters would push the list a screen down, so there
 * the lid is a button that opens them as a drawer, with the count of what is
 * active on the button. The filters themselves are links, so choosing one
 * navigates and the drawer can simply be closed when done.
 *
 * The desk layout is what the server renders (there is no window on the
 * server); a phone switches to the button on its first client render.
 */
const PHONE = '(max-width: 767px)';

function subscribe(onChange: () => void) {
  const query = window.matchMedia(PHONE);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

function usePhone() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(PHONE).matches,
    () => false,
  );
}

export function FilterDisclosure({
  title,
  activeCount,
  children,
}: {
  title: string;
  activeCount: number;
  children: React.ReactNode;
}) {
  const tc = useTranslations('common');
  const phone = usePhone();
  const [open, setOpen] = useState(false);

  // Same value on the server and on the first client render, so the lid does
  // not flicker; after that it is this state and the summary that move it.
  const [expanded, setExpanded] = useState(activeCount > 0);
  // Opens, never closes. Arriving from a chip on a herb's page brings a
  // filter with it and the panel has to show it; clearing one leaves the
  // panel exactly where the reader put it. Adjusted while rendering, when the
  // count changes, rather than in an effect that drew the closed lid first.
  const [seenCount, setSeenCount] = useState(activeCount);
  if (activeCount !== seenCount) {
    setSeenCount(activeCount);
    if (activeCount > 0) setExpanded(true);
  }

  const badge =
    activeCount > 0 ? (
      <span className="rounded-full bg-jade-100 px-2 py-0.5 text-xs font-semibold text-jade-800">
        {activeCount}
      </span>
    ) : null;

  if (phone) {
    return (
      <>
        <Button
          type="button"
          variant="secondary"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={open}
          className="w-full justify-start"
        >
          <SlidersHorizontal className="h-4 w-4 text-ink-500" aria-hidden />
          {title}
          {badge ? <span className="ms-auto">{badge}</span> : null}
        </Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent title={title} closeLabel={tc('close')}>
            <div className="space-y-4">{children}</div>
            <DialogFooter>
              <Button type="button" onClick={() => setOpen(false)}>
                {tc('close')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <details
      open={expanded}
      // Without this React and the element disagree the moment the summary is
      // clicked, and the next render snaps the lid back to where React thinks
      // it was.
      onToggle={(event) => setExpanded(event.currentTarget.open)}
      className="rounded-card border border-ink-200 bg-white [&[open]_.facet-chevron]:rotate-180"
    >
      <summary className="flex min-h-10 list-none items-center gap-2 px-3 py-2 text-sm font-medium text-ink-700 transition-colors hover:bg-ink-50">
        <SlidersHorizontal className="h-4 w-4 text-ink-500" aria-hidden />
        {title}
        {badge}
        <span className="facet-chevron ms-auto text-xs text-ink-500 transition-transform">▾</span>
      </summary>
      <div className="space-y-4 border-t border-ink-100 px-3 py-3">{children}</div>
    </details>
  );
}
