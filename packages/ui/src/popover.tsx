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
/** How long a closing panel is kept for its exit; matches `--duration-fast` with a little slack. */
const EXIT_MS = 160;

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

  // The panel stays mounted for one short beat after closing so it can fade
  // and settle out the way it came in; a panel that vanishes mid-blur is the
  // one abrupt moment in an otherwise animated kit.
  // Opening and closing are taken in the render that changes `open`; only the
  // exit's timer is an effect.
  const [mounted, setMounted] = React.useState(false);
  const [leaving, setLeaving] = React.useState(false);
  const [seenOpen, setSeenOpen] = React.useState(open);
  if (open !== seenOpen) {
    setSeenOpen(open);
    if (open) {
      setMounted(true);
      setLeaving(false);
    } else if (mounted) {
      setLeaving(true);
    }
  }
  React.useEffect(() => {
    if (!leaving) return;
    const timer = window.setTimeout(() => {
      setMounted(false);
      setLeaving(false);
      setPosition(null);
    }, EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [leaving]);

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
    mounted && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-label={panelLabel}
            data-floating
            style={{
              position: 'fixed',
              // A modal dialog turns pointer events off for everything outside
              // itself, and this panel lives in <body>: without this, a click
              // on it inside a dialog lands on nothing.
              pointerEvents: 'auto',
              top: position?.top ?? -9999,
              left: position?.left ?? -9999,
              width,
              maxHeight: position?.maxHeight,
              // Hidden until measured, so it never appears in the corner first.
              visibility: position ? 'visible' : 'hidden',
            }}
            data-leaving={leaving || undefined}
            // Fades and settles on arrival. `starting:` is the entrance for an
            // element that is conditionally rendered — there is no "closed"
            // state to animate from, and a panel should simply be gone when
            // dismissed. It works with the measure-then-show trick above
            // because the position is set in a layout effect, before the first
            // paint; the transition begins on that same first frame.
            className={cn(
              'z-popover overflow-y-auto overscroll-contain rounded-lg border border-ink-200 bg-white p-3 shadow-lg transition-[opacity,translate] duration-(--duration-fast) ease-standard starting:translate-y-1 starting:opacity-0',
              leaving && 'pointer-events-none translate-y-1 opacity-0',
            )}
            data-scroll-panel
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
  {
    matchWidth = true,
    maxHeight = 288,
    /** The list itself, so placement uses what it actually measures. */
    contentRef,
    /**
     * Anything that changes the list's height — the number of matches, say.
     * Re-measures when it changes, so narrowing a search re-seats the list
     * against the field instead of leaving it at its old size and position.
     */
    revision,
  }: {
    matchWidth?: boolean;
    maxHeight?: number;
    contentRef?: React.RefObject<HTMLElement | null>;
    revision?: unknown;
  } = {},
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

    /*
     * A results list belongs directly under the field it belongs to. Typing
     * narrows ten matches to two, and a list that jumps above the cursor at that
     * moment is worse than one that is slightly cramped — the eye is on the
     * field, and the answer should appear where the eye already is.
     *
     * So this measures what the list is actually going to be, not the maximum it
     * could be. Two results need ~80px and will nearly always fit below; only a
     * long list on a field near the bottom of the window flips, and only when
     * there is genuinely more room the other way.
     */
    const measured = contentRef?.current?.scrollHeight ?? 0;
    const desired = Math.min(maxHeight, measured > 0 ? measured : maxHeight);

    const fitsBelow = spaceBelow >= desired;
    const below = fitsBelow || spaceBelow >= spaceAbove;

    const available = Math.max(120, (below ? spaceBelow : spaceAbove) - 4);
    const height = Math.min(desired, available);
    const width = matchWidth ? rect.width : undefined;

    const left = Math.min(
      Math.max(VIEWPORT_MARGIN, rect.left),
      Math.max(VIEWPORT_MARGIN, viewportWidth - (width ?? rect.width) - VIEWPORT_MARGIN),
    );

    setStyle({
      position: 'fixed',
      // 2px, not 4: the list should read as attached to the field rather than
      // floating near it.
      top: below ? rect.bottom + 2 : rect.top - 2 - height,
      left,
      width,
      maxHeight: height,
    });
  }, [anchorRef, contentRef, matchWidth, maxHeight]);

  // Closed, there is no position — dropped in the render that closes it.
  if (!open && style !== null) setStyle(null);

  React.useLayoutEffect(() => {
    if (!open) return;
    place();
  }, [open, place, revision]);

  React.useEffect(() => {
    if (!open) return;

    // A second pass once the list has rendered and has a real height. Without
    // it the first measurement is always the maximum, which is what made a
    // two-result list open upwards.
    const raf = window.requestAnimationFrame(place);

    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open, place, revision]);

  return style;
}

/**
 * Renders a floating list into the body, so nothing can clip it.
 *
 * `style` is nullable because the position is measured after mount: rendering
 * nothing until it has been is what keeps the list from appearing in the corner
 * of the screen for one frame.
 */
export const FloatingList = React.forwardRef<
  HTMLUListElement,
  Omit<React.HTMLAttributes<HTMLUListElement>, 'style'> & { style: React.CSSProperties | null }
>(function FloatingList({ children, style, ...props }, ref) {
  // The last measured position is kept for one beat after the list closes,
  // so it can fade out in place instead of disappearing.
  const [shown, setShown] = React.useState<React.CSSProperties | null>(style);
  const [leaving, setLeaving] = React.useState(false);
  const [seenStyle, setSeenStyle] = React.useState(style);
  if (style !== seenStyle) {
    setSeenStyle(style);
    if (style) {
      setShown(style);
      setLeaving(false);
    } else {
      setLeaving(true);
    }
  }
  React.useEffect(() => {
    if (!leaving) return;
    const timer = window.setTimeout(() => {
      setShown(null);
      setLeaving(false);
    }, EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [leaving]);

  if (typeof document === 'undefined' || !shown) return null;
  return createPortal(
    <ul
      {...props}
      ref={ref}
      data-floating
      data-scroll-panel
      data-leaving={leaving || undefined}
      // See the Popover panel: inside a modal dialog the body has no pointer
      // events, and a list nobody can click is a list that only works by keyboard.
      style={{ ...shown, pointerEvents: leaving ? 'none' : 'auto' }}
      className={cn(
        'z-popover overflow-y-auto overscroll-contain rounded-lg border border-ink-200 bg-white py-1 shadow-lg',
        'transition-[opacity,translate] duration-(--duration-fast) ease-standard starting:translate-y-1 starting:opacity-0',
        leaving && 'translate-y-1 opacity-0',
        props.className,
      )}
    >
      {children}
    </ul>,
    document.body,
  );
});
