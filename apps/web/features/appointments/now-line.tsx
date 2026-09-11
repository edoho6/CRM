'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * The line that says "it is now".
 *
 * Drawn across today's column at the current minute and moved once a minute.
 * Red on purpose: today's column is tinted jade, and a jade line on a jade
 * column would be the one thing in the diary that is not there to be found.
 * Hidden outside the hours the grid draws.
 *
 * On its first appearance it scrolls the grid's panel (`[data-time-grid]`)
 * so the line sits a third of the way down: the diary opens on now, with
 * more of what is about to happen than of what has. The panel and not the
 * window, so the page itself does not jump.
 */
export function NowLine({
  dayStartHour,
  slotMinutes,
  slotHeightRem,
  slotCount,
}: {
  dayStartHour: number;
  slotMinutes: number;
  /** One slot's height in rem, so the line sits right at any text size. */
  slotHeightRem: number;
  slotCount: number;
}) {
  const [minutes, setMinutes] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const scrolled = useRef(false);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setMinutes(now.getHours() * 60 + now.getMinutes());
    };
    tick();
    const timer = setInterval(tick, 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (minutes === null || scrolled.current) return;
    const line = ref.current;
    const panel = line?.closest<HTMLElement>('[data-time-grid]');
    if (!line || !panel) return;
    scrolled.current = true;
    const delta = line.getBoundingClientRect().top - panel.getBoundingClientRect().top;
    panel.scrollTop = Math.max(0, panel.scrollTop + delta - panel.clientHeight / 3);
  }, [minutes]);

  if (minutes === null) return null;
  const offset = minutes - dayStartHour * 60;
  if (offset < 0 || offset > slotCount * slotMinutes) return null;
  const top = `${(offset / slotMinutes) * slotHeightRem}rem`;

  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute inset-x-0 z-10 flex items-center"
      style={{ top }}
    >
      <span className="-ms-1 h-2 w-2 shrink-0 rounded-full bg-red-600" />
      <span className="h-px flex-1 bg-red-600" />
    </div>
  );
}
