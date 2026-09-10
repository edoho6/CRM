'use client';

import * as React from 'react';
import { dragOffset, shouldDismiss } from './swipe-math';

/**
 * Drag a bottom sheet down to close it.
 *
 * Returned handlers go on the grab handle and the header — never on the
 * body, whose scrolling must stay the browser's. The sheet follows the finger
 * through `translate` on the content element; on release it either springs
 * back or the caller is told to close, and the exit animation carries on
 * from wherever the finger left it. Only below `sm`: above it the dialog is a
 * centred card and a drag means nothing.
 */
export function useSwipeDismiss(
  contentRef: React.RefObject<HTMLElement | null>,
  onDismiss: () => void,
) {
  const start = React.useRef<{ y: number; t: number } | null>(null);

  const onPointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (typeof window === 'undefined' || window.innerWidth >= 640) return;
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      start.current = { y: event.clientY, t: event.timeStamp };
      event.currentTarget.setPointerCapture(event.pointerId);
      const content = contentRef.current;
      if (content) content.style.transition = 'none';
    },
    [contentRef],
  );

  const onPointerMove = React.useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (!start.current) return;
      const content = contentRef.current;
      if (!content) return;
      content.style.translate = `0 ${dragOffset(event.clientY - start.current.y)}px`;
    },
    [contentRef],
  );

  const onPointerUp = React.useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (!start.current) return;
      const dy = event.clientY - start.current.y;
      const dt = event.timeStamp - start.current.t;
      start.current = null;
      const content = contentRef.current;
      if (!content) return;
      content.style.transition = '';
      if (shouldDismiss({ dy, dt, height: content.offsetHeight })) {
        onDismiss();
      } else {
        content.style.translate = '';
      }
    },
    [contentRef, onDismiss],
  );

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel: onPointerUp,
    // The browser must not turn the drag into a scroll of the page behind.
    style: { touchAction: 'none' } as React.CSSProperties,
  };
}
