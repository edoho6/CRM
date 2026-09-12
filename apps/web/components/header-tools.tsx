'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * Header controls owned by a client component further down the page.
 *
 * Every page puts its actions in the same corner of `PageHeader`: the title
 * at the start, the primary action last at the end. Some of those actions
 * belong to state the page itself cannot hold — the treatment page's arrange
 * switch, the tasks board's "new task" dialog — so the page renders an empty
 * `HeaderToolsSlot` in the header and the owner sends its controls into it
 * through a portal. The page keeps the shared header; the owner keeps its
 * state; and nothing about the header's shape depends on who renders it.
 *
 * Nothing renders until the slot has been looked for (after mount): tools
 * that first appear in the body and then jump into the header are a flash
 * on every visit, and the header is where the eye expects them. Only when
 * the page has no slot at all do they render in place.
 */
export function HeaderToolsSlot({ id }: { id: string }) {
  return <span id={id} className="inline-flex flex-wrap items-center gap-2" />;
}

export function HeaderTools({
  slotId,
  children,
  fallbackClassName,
}: {
  slotId: string;
  children: ReactNode;
  /** Layout of the in-place fallback, before the slot is found. */
  fallbackClassName?: string;
}) {
  // `undefined` = not looked yet; `null` = looked and the page has no slot.
  const [slot, setSlot] = useState<HTMLElement | null | undefined>(undefined);
  useEffect(() => {
    setSlot(document.getElementById(slotId));
  }, [slotId]);
  if (slot === undefined) return null;
  return slot ? createPortal(children, slot) : <div className={fallbackClassName}>{children}</div>;
}
