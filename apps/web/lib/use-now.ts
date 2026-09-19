'use client';

import { useEffect, useState } from 'react';

/**
 * The time, as state that ticks — for a client component that says "3 hours
 * left" and should not keep saying it for the rest of the afternoon.
 *
 * Reading the clock inside the render instead makes the render impure: the
 * same props draw a different screen, and nothing redraws it when the answer
 * changes. Only for components drawn in the browser alone; one the server also
 * draws takes the page's `renderedAt` (see "השעון של הדף" in CLAUDE.md), or
 * the two disagree at hydration.
 */
export function useNow(everyMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), everyMs);
    return () => window.clearInterval(timer);
  }, [everyMs]);
  return now;
}
