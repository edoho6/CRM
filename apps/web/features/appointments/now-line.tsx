'use client';

import { useEffect, useState } from 'react';

/**
 * The line that says "it is now".
 *
 * Drawn across today's column at the current minute and moved once a minute.
 * Red on purpose: today's column is tinted jade, and a jade line on a jade
 * column would be the one thing in the diary that is not there to be found.
 * Hidden outside the hours the grid draws.
 */
export function NowLine({
  dayStartHour,
  slotMinutes,
  slotHeight,
  slotCount,
}: {
  dayStartHour: number;
  slotMinutes: number;
  slotHeight: number;
  slotCount: number;
}) {
  const [minutes, setMinutes] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setMinutes(now.getHours() * 60 + now.getMinutes());
    };
    tick();
    const timer = setInterval(tick, 60_000);
    return () => clearInterval(timer);
  }, []);

  if (minutes === null) return null;
  const offset = minutes - dayStartHour * 60;
  if (offset < 0 || offset > slotCount * slotMinutes) return null;
  const top = (offset / slotMinutes) * slotHeight;

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 z-10 flex items-center"
      style={{ top }}
    >
      <span className="-ms-1 h-2 w-2 shrink-0 rounded-full bg-red-600" />
      <span className="h-px flex-1 bg-red-600" />
    </div>
  );
}
