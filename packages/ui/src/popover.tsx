'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { cn } from './cn';

/**
 * A panel anchored to a button, that cannot be clipped by whatever it sits in.
 *
 * The obvious implementation — `position: absolute` inside the trigger's parent
 * — breaks the moment the trigger is inside anything with `overflow` set, which
 * in this app means every table: `TableWrapper` scrolls horizontally so a wide
 * table works on a phone, and that same rule crops any panel opened from a cell.
 * The panel was not too small or badly placed; it was being cut off by an
 * ancestor several levels up, which is why it looked like a margin problem.
 *
 * So the panel is rendered into `document.body` and positioned with `fixed`
 * coordinates measured from the trigger. Nothing between the two can clip it,
 * and it is measured against the viewport rather than against its container:
 *
 *   · it flips above the trigger when there is more room there
 *   · it slides along the inline axis to stay on screen, so a control at the
 *     edge of the window opens inward instead of half off it
 *   · it caps its own height and scrolls internally rather than overflowing
 *
 * Placement is re-measured on scroll and resize while open, because a fixed
 * panel does not travel with the page the way an absolute one does.
 */

const VIEWPORT_MARGIN = 8;

export interface PopoverRenderProps {
  close: () => void;
}

export function Popover({
  triggerContent,
  triggerLabel,
  triggerClassName,
  triggerTitle,
  panelLabel,
  width = 288,
  align = 'start',
  disabled = false,
  className,
  children,
}: {
  triggerContent: React.ReactNode;
  /** Accessible name for the trigger. */
  triggerLabel: string;
  triggerClassName?: string;
  triggerTitle?: string;
  /** Accessible name for the panel itself. */
  panelLabel: string;
  width?: number;
  /** Which edge of the trigger the panel lines up with, in reading order. */
  align?: 'start' | 'end';
  disabled?: boolean;
  /** Applied to the wrapper, for layout in the surrounding flow. */
  className?: string;
  children: React.ReactNode | ((props: PopoverRenderProps) => React.ReactNode);
}) {
  const [open, setOpen] = React.useState(false);
  const [position, setPosition] = React.useState<{
    top: number;
    left: number;
    maxHeight: number;
  } | null>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);

  const close = React.useCallback(() => setOpen(false), []);

  const place = React.useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = document.documentElement.clientHeight;

    const spaceBelow = viewportHeight - rect.bottom - VIEWPORT_MARGIN;
    const spaceAbove = rect.top - VIEWPORT_MARGIN;
    // Below unless there is meaningfully more room above — flipping for a few
    // pixels' gain would just make the panel jump around while scrolling.
    const below = spaceBelow >= Math.min(240, spaceAbove) || spaceBelow >= spaceAbove;

    const panelHeight = panelRef.current?.offsetHeight ?? 0;
    const maxHeight = Math.max(160, (below ? spaceBelow : spaceAbove) - 4);

    const isRtl = getComputedStyle(document.documentElement).direction === 'rtl';
    // `align` is expressed in reading order, so which physical edge it means
    // depends on the direction of the page.
    const alignToLeftEdge = align === 'start' ? !isRtl : isRtl;

    const desiredLeft = alignToLeftEdge ? rect.left : rect.right - width;
    const left = Math.min(
      Math.max(VIEWPORT_MARGIN, desiredLeft),
      Math.max(VIEWPORT_MARGIN, viewportWidth - width - VIEWPORT_MARGIN),
    );

    const top = below
      ? rect.bottom + 4
      : Math.max(VIEWPORT_MARGIN, rect.top - 4 - Math.min(panelHeight || maxHeight, maxHeight));

    setPosition({ top, left, maxHeight });
  }, [align, width]);

  // Measure before paint: placing after would show the panel at the wrong spot
  // for a frame, which reads as a flicker.
  React.useLayoutEffect(() => {
    if (!open) return;
    place();
  }, [open, place]);

  React.useEffect(() => {
    if (!open) return;

    // A second pass once the panel has a height, so a flipped panel sits
    // against the trigger rather than at its estimated position.
    const raf = window.requestAnimationFrame(place);

    // `true` for capture: a scroll inside the table that holds the trigger does
    // not bubble, and that is exactly the scroll that moves it.
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      setOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, place]);

  const panel =
    open && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-label={panelLabel}
            style={{
              position: 'fixed',
              top: position?.top ?? -9999,
              left: position?.left ?? -9999,
              width,
              maxHeight: position?.maxHeight,
              // Hidden until measured, so it never appears in the corner first.
              visibility: position ? 'visible' : 'hidden',
            }}
            className="z-50 overflow-y-auto overscroll-contain rounded-lg border border-ink-200 bg-white p-3 shadow-lg"
          >
            {typeof children === 'function' ? children({ close }) : children}
          </div>,
          document.body,
        )
      : null;

  return (
    <span className={cn('inline-flex', className)}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={triggerLabel}
        title={triggerTitle}
        onClick={() => setOpen((value) => !value)}
        className={triggerClassName}
      >
        {triggerContent}
      </button>
      {panel}
    </span>
  );
}

/**
 * The same escape hatch for a listbox that hangs off an input rather than a
 * button — a combobox, where the trigger is the field itself.
 *
 * Returns the style to spread onto the list. Null while closed or unmeasured.
 */
export function useAnchoredPosition(
  anchorRef: React.RefObject<HTMLElement | null>,
  open: boolean,
  { matchWidth = true, maxHeight = 288 }: { matchWidth?: boolean; maxHeight?: number } = {},
): React.CSSProperties | null {
  const [style, setStyle] = React.useState<React.CSSProperties | null>(null);

  const place = React.useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;

    const rect = anchor.getBoundingClientRect();
    const viewportHeight = document.documentElement.clientHeight;
    const viewportWidth = document.documentElement.clientWidth;

    const spaceBelow = viewportHeight - rect.bottom - VIEWPORT_MARGIN;
    const spaceAbove = rect.top - VIEWPORT_MARGIN;
    const below = spaceBelow >= Math.min(200, spaceAbove) || spaceBelow >= spaceAbove;

    const available = Math.max(140, (below ? spaceBelow : spaceAbove) - 4);
    const height = Math.min(maxHeight, available);
    const width = matchWidth ? rect.width : undefined;

    const left = Math.min(
      Math.max(VIEWPORT_MARGIN, rect.left),
      Math.max(VIEWPORT_MARGIN, viewportWidth - (width ?? rect.width) - VIEWPORT_MARGIN),
    );

    setStyle({
      position: 'fixed',
      top: below ? rect.bottom + 4 : rect.top - 4 - height,
      left,
      width,
      maxHeight: height,
    });
  }, [anchorRef, matchWidth, maxHeight]);

  React.useLayoutEffect(() => {
    if (!open) {
      setStyle(null);
      return;
    }
    place();
  }, [open, place]);

  React.useEffect(() => {
    if (!open) return;
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open, place]);

  return style;
}

/**
 * Renders a floating list into the body, so nothing can clip it.
 *
 * `style` is nullable because the position is measured after mount: rendering
 * nothing until it has been is what keeps the list from appearing in the corner
 * of the screen for one frame.
 */
export function FloatingList({
  children,
  style,
  ...props
}: Omit<React.HTMLAttributes<HTMLUListElement>, 'style'> & {
  style: React.CSSProperties | null;
}) {
  if (typeof document === 'undefined' || !style) return null;
  return createPortal(
    <ul
      {...props}
      style={style}
      className={cn(
        'z-50 overflow-y-auto overscroll-contain rounded-lg border border-ink-200 bg-white py-1 shadow-lg',
        props.className,
      )}
    >
      {children}
    </ul>,
    document.body,
  );
}
