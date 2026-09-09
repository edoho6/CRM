'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Maximize2, ZoomIn, ZoomOut } from 'lucide-react';
import { cn } from '@clinic/ui/cn';

/**
 * A picture in a frame you can move about in.
 *
 * The photograph is laid out by hand — its scaled size and a translation —
 * rather than with `object-fit`, because zooming "towards the pointer" is a
 * statement about one image pixel staying under one screen pixel, and that
 * needs the numbers. `cover` starts filled to the frame, for the panel on the
 * treatment page; `contain` starts fully visible, for the lightbox.
 *
 * The view is three numbers: which image point sits at the frame's centre (in
 * percent of the picture, so it survives a resized frame) and the zoom above
 * the starting fit. Wheel zooms around the pointer, the two buttons zoom
 * around the centre, dragging pans, a still click activates, a double click
 * resets. Keyboard: `+` `-` zoom, arrows pan, `0` resets, Enter or Space
 * activates.
 *
 * Coordinates here are physical, not logical — `left` and `top` on the image,
 * pointer positions from `getBoundingClientRect` — because a photograph has no
 * reading direction and translating it must not flip with the page.
 */

export interface ZoomView {
  /** The image point at the frame's centre, in percent of its width. */
  cx: number;
  /** In percent of its height. */
  cy: number;
  /** Multiplier over the starting fit. 1 is "as fitted". */
  zoom: number;
}

export const DEFAULT_ZOOM_VIEW: ZoomView = { cx: 50, cy: 50, zoom: 1 };
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 8;
/** Each button press, and roughly one notch of a wheel. */
const ZOOM_STEP = 1.25;
/** A pointer that travels less than this between down and up is a click. */
const CLICK_TOLERANCE_PX = 4;
/**
 * The browser draws its resize grip in a bottom corner of a `resize-y` frame,
 * which corner depending on the writing direction. A press within this many
 * pixels of the bottom edge and a side edge is a resize, not a drag.
 */
const RESIZE_GRIP_PX = 24;

interface Box {
  width: number;
  height: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function baseScale(fit: 'cover' | 'contain', natural: Box, frame: Box): number {
  const sx = frame.width / natural.width;
  const sy = frame.height / natural.height;
  return fit === 'cover' ? Math.max(sx, sy) : Math.min(sx, sy);
}

/** Keeps the picture over the frame: no gap that the fit would not have shown. */
export function clampZoomView(
  view: ZoomView,
  natural: Box | null,
  frame: Box | null,
  fit: 'cover' | 'contain',
): ZoomView {
  const zoom = clamp(Number.isFinite(view.zoom) ? view.zoom : 1, MIN_ZOOM, MAX_ZOOM);
  if (!natural || !frame || natural.width <= 0 || natural.height <= 0 || frame.width <= 0) {
    return { cx: 50, cy: 50, zoom };
  }
  const scale = baseScale(fit, natural, frame) * zoom;
  const scaledWidth = natural.width * scale;
  const scaledHeight = natural.height * scale;
  // A picture narrower than the frame sits centred; one wider may show any
  // part of itself, but never a margin beyond its edge.
  const halfX = (frame.width / (2 * scaledWidth)) * 100;
  const halfY = (frame.height / (2 * scaledHeight)) * 100;
  const cx = scaledWidth <= frame.width ? 50 : clamp(view.cx, halfX, 100 - halfX);
  const cy = scaledHeight <= frame.height ? 50 : clamp(view.cy, halfY, 100 - halfY);
  return { cx: Number.isFinite(cx) ? cx : 50, cy: Number.isFinite(cy) ? cy : 50, zoom };
}

function layout(view: ZoomView, natural: Box, frame: Box, fit: 'cover' | 'contain') {
  const scale = baseScale(fit, natural, frame) * view.zoom;
  return {
    scale,
    width: natural.width * scale,
    height: natural.height * scale,
    left: frame.width / 2 - (view.cx / 100) * natural.width * scale,
    top: frame.height / 2 - (view.cy / 100) * natural.height * scale,
  };
}

export function ZoomFrame({
  src,
  alt,
  fit,
  view: controlledView,
  onViewChange,
  onActivate,
  onFrameResize,
  resizable = false,
  labels,
  className,
  style,
  imgClassName,
}: {
  src: string;
  alt: string;
  fit: 'cover' | 'contain';
  /** Controlled view; omit to let the frame keep its own. */
  view?: ZoomView;
  onViewChange?: (view: ZoomView) => void;
  /** A still click, Enter or Space. */
  onActivate?: () => void;
  /** The frame's box, whenever it changes — for a parent that remembers its height. */
  onFrameResize?: (box: Box) => void;
  /** The frame carries the browser's own vertical resize grip. */
  resizable?: boolean;
  labels: { zoomIn: string; zoomOut: string; hint: string; activate?: string };
  className?: string;
  style?: React.CSSProperties;
  imgClassName?: string;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [natural, setNatural] = useState<Box | null>(null);
  const [frame, setFrame] = useState<Box | null>(null);
  const [internalView, setInternalView] = useState<ZoomView>(DEFAULT_ZOOM_VIEW);
  const view = controlledView ?? internalView;
  // The same value, readable inside native listeners without a re-render.
  const viewRef = useRef(view);
  viewRef.current = view;
  const naturalRef = useRef(natural);
  naturalRef.current = natural;
  const frameBoxRef = useRef(frame);
  frameBoxRef.current = frame;
  const drag = useRef<{
    startX: number;
    startY: number;
    cx: number;
    cy: number;
    moved: boolean;
  } | null>(null);

  const commit = useCallback(
    (next: ZoomView) => {
      const clamped = clampZoomView(next, naturalRef.current, frameBoxRef.current, fit);
      if (controlledView === undefined) setInternalView(clamped);
      onViewChange?.(clamped);
    },
    [controlledView, fit, onViewChange],
  );

  // The frame's own size, kept current: the layout depends on it, and the
  // parent may be letting the person pull the frame taller.
  useEffect(() => {
    const element = frameRef.current;
    if (!element) return;
    const observer = new ResizeObserver(() => {
      const rect = element.getBoundingClientRect();
      const box = { width: Math.round(rect.width), height: Math.round(rect.height) };
      setFrame((previous) =>
        previous && previous.width === box.width && previous.height === box.height
          ? previous
          : box,
      );
      onFrameResize?.(box);
    });
    observer.observe(element);
    return () => observer.disconnect();
    // The callback is read once per resize; re-observing on every render
    // would restart the observer for nothing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Zooms by `factor` keeping the image point under (px, py) in place. */
  const zoomAt = useCallback(
    (factor: number, px: number, py: number) => {
      const current = viewRef.current;
      const box = frameBoxRef.current;
      const size = naturalRef.current;
      if (!box || !size) return;
      const nextZoom = clamp(current.zoom * factor, MIN_ZOOM, MAX_ZOOM);
      if (nextZoom === current.zoom) return;
      const before = layout(current, size, box, fit);
      const imageX = (px - before.left) / before.scale;
      const imageY = (py - before.top) / before.scale;
      const nextScale = baseScale(fit, size, box) * nextZoom;
      // The new left edge that keeps that image point under the pointer, and
      // from it the centre the view actually stores.
      const nextLeft = px - imageX * nextScale;
      const nextTop = py - imageY * nextScale;
      commit({
        cx: ((box.width / 2 - nextLeft) / (size.width * nextScale)) * 100,
        cy: ((box.height / 2 - nextTop) / (size.height * nextScale)) * 100,
        zoom: nextZoom,
      });
    },
    [commit, fit],
  );

  // The wheel listener is attached by hand because React registers wheel as
  // passive, and a passive listener cannot stop the page from scrolling
  // underneath the picture.
  useEffect(() => {
    const element = frameRef.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      // Pixel deltas from a trackpad are small and frequent; line deltas from
      // a wheel are large and rare. Both come out at roughly a step a notch.
      const magnitude = event.deltaMode === 1 ? event.deltaY * 20 : event.deltaY;
      const factor = Math.exp(-magnitude * 0.002);
      zoomAt(factor, event.clientX - rect.left, event.clientY - rect.top);
    };
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, [zoomAt]);

  const ready = natural !== null && frame !== null;
  const placed = ready ? layout(clampZoomView(view, natural, frame, fit), natural, frame, fit) : null;

  function zoomButton(direction: 1 | -1) {
    const box = frameBoxRef.current;
    if (!box) return;
    zoomAt(direction === 1 ? ZOOM_STEP : 1 / ZOOM_STEP, box.width / 2, box.height / 2);
  }

  function pan(dxPercentOfFrame: number, dyPercentOfFrame: number) {
    const box = frameBoxRef.current;
    const size = naturalRef.current;
    if (!box || !size) return;
    const current = viewRef.current;
    const { scale } = layout(current, size, box, fit);
    commit({
      ...current,
      cx: current.cx + ((box.width * dxPercentOfFrame) / (size.width * scale)) * 100,
      cy: current.cy + ((box.height * dyPercentOfFrame) / (size.height * scale)) * 100,
    });
  }

  return (
    <div
      ref={frameRef}
      role="group"
      tabIndex={0}
      aria-label={alt}
      title={labels.hint}
      style={style}
      className={cn(
        'relative overflow-hidden bg-ink-50',
        'touch-none select-none cursor-grab active:cursor-grabbing',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
        resizable && 'resize-y',
        className,
      )}
      onKeyDown={(event) => {
        switch (event.key) {
          case 'Enter':
          case ' ':
            if (onActivate) {
              event.preventDefault();
              onActivate();
            }
            break;
          case '+':
          case '=':
            event.preventDefault();
            zoomButton(1);
            break;
          case '-':
          case '_':
            event.preventDefault();
            zoomButton(-1);
            break;
          case '0':
            event.preventDefault();
            commit(DEFAULT_ZOOM_VIEW);
            break;
          case 'ArrowLeft':
            event.preventDefault();
            pan(-0.1, 0);
            break;
          case 'ArrowRight':
            event.preventDefault();
            pan(0.1, 0);
            break;
          case 'ArrowUp':
            event.preventDefault();
            pan(0, -0.1);
            break;
          case 'ArrowDown':
            event.preventDefault();
            pan(0, 0.1);
            break;
          default:
        }
      }}
      onDoubleClick={() => commit(DEFAULT_ZOOM_VIEW)}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (resizable) {
          const nearBottom = rect.bottom - event.clientY <= RESIZE_GRIP_PX;
          const nearSide =
            event.clientX - rect.left <= RESIZE_GRIP_PX ||
            rect.right - event.clientX <= RESIZE_GRIP_PX;
          if (nearBottom && nearSide) return;
        }
        drag.current = {
          startX: event.clientX,
          startY: event.clientY,
          cx: viewRef.current.cx,
          cy: viewRef.current.cy,
          moved: false,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        const state = drag.current;
        if (!state) return;
        const dx = event.clientX - state.startX;
        const dy = event.clientY - state.startY;
        if (!state.moved && Math.abs(dx) + Math.abs(dy) <= CLICK_TOLERANCE_PX) return;
        state.moved = true;
        const box = frameBoxRef.current;
        const size = naturalRef.current;
        if (!box || !size) return;
        const { scale } = layout(viewRef.current, size, box, fit);
        // Dragging the picture right shows more of its left: the centre moves
        // the other way, hence the subtraction.
        commit({
          ...viewRef.current,
          cx: state.cx - (dx / (size.width * scale)) * 100,
          cy: state.cy - (dy / (size.height * scale)) * 100,
        });
      }}
      onPointerUp={() => {
        const state = drag.current;
        drag.current = null;
        if (!state) return;
        if (!state.moved) onActivate?.();
      }}
      onPointerCancel={() => {
        drag.current = null;
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        draggable={false}
        onLoad={(event) => {
          const image = event.currentTarget;
          if (image.naturalWidth > 0) {
            setNatural({ width: image.naturalWidth, height: image.naturalHeight });
          }
        }}
        ref={(image) => {
          // A cached picture is complete before `onLoad` can attach.
          if (image && image.complete && image.naturalWidth > 0 && !naturalRef.current) {
            setNatural({ width: image.naturalWidth, height: image.naturalHeight });
          }
        }}
        className={cn('absolute max-w-none', !placed && 'invisible', imgClassName)}
        style={
          placed
            ? {
                width: placed.width,
                height: placed.height,
                left: 0,
                top: 0,
                transform: `translate(${placed.left}px, ${placed.top}px)`,
              }
            : undefined
        }
      />

      {/* The two buttons are the wheel for anyone without one — a laptop
          trackpad in a hurry, a touch screen, a keyboard. They sit inside the
          frame so they zoom the picture they are on. */}
      <div
        className="absolute top-1.5 end-1.5 flex gap-1"
        onPointerDown={(event) => event.stopPropagation()}
        onDoubleClick={(event) => event.stopPropagation()}
      >
        {onActivate && labels.activate ? (
          <button
            type="button"
            aria-label={labels.activate}
            title={labels.activate}
            onClick={(event) => {
              event.stopPropagation();
              onActivate();
            }}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-ink-200 bg-white/90 text-ink-700 shadow-sm hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            <Maximize2 className="h-4 w-4" aria-hidden />
          </button>
        ) : null}
        <button
          type="button"
          aria-label={labels.zoomIn}
          title={labels.zoomIn}
          disabled={view.zoom >= MAX_ZOOM}
          onClick={(event) => {
            event.stopPropagation();
            zoomButton(1);
          }}
          className="flex h-7 w-7 items-center justify-center rounded-md border border-ink-200 bg-white/90 text-ink-700 shadow-sm hover:bg-white disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          <ZoomIn className="h-4 w-4" aria-hidden />
        </button>
        <button
          type="button"
          aria-label={labels.zoomOut}
          title={labels.zoomOut}
          disabled={view.zoom <= MIN_ZOOM}
          onClick={(event) => {
            event.stopPropagation();
            zoomButton(-1);
          }}
          className="flex h-7 w-7 items-center justify-center rounded-md border border-ink-200 bg-white/90 text-ink-700 shadow-sm hover:bg-white disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          <ZoomOut className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
