'use client';

import * as React from 'react';
import { AlignJustify, Eraser, Grid3x3, Highlighter, Pen, PenTool, Redo2, Square, Trash2, Undo2 } from 'lucide-react';
import { cn } from './cn';
import { focusRing } from './focus';
import { Popover } from './popover';
import { SegmentedControl } from './segmented-control';
import { HIGHLIGHTER_FACTOR, SKETCH_SIZES, strokeHit, strokeWidth, type SketchPoint, type SketchSize, type SketchStroke, type SketchTool } from './sketch-geometry';

/**
 * A page to write on with a pen.
 *
 * Pointer Events, one path for stylus, finger and mouse; `setPointerCapture`
 * keeps a stroke on the page when the hand crosses its edge; the coalesced
 * events of a fast stylus (an Apple Pencil reports 240 times a second) are
 * all drawn, not just the last one per frame, so a curve is a curve. A
 * stylus's pressure sets the width; a mouse and a finger draw at the
 * nominal width. Once a pen has been seen, fingers stop drawing — that is
 * palm rejection — and the switch in the toolbar says so and can be turned
 * off on a device with no pen.
 *
 * Strokes are kept as points, not pixels: the eraser removes a whole
 * stroke it touches, undo and redo walk a history of the list, and the
 * export redraws everything at twice the size onto a white page with its
 * ruling. The canvas is sized in device pixels and scaled in CSS, so a
 * line on a tablet is crisp.
 *
 * Every string comes in through `labels`: the package holds no translations.
 */

export type SketchPaper = 'blank' | 'lines' | 'grid';

export interface SketchPadLabels {
  canvas: string;
  pen: string;
  highlighter: string;
  eraser: string;
  tool: string;
  color: string;
  width: string;
  thin: string;
  medium: string;
  thick: string;
  paper: string;
  blank: string;
  lines: string;
  grid: string;
  undo: string;
  redo: string;
  clear: string;
  penOnly: string;
  penOnlyHint: string;
  colors: string[];
}

export interface SketchPadHandle {
  /** The page as a PNG, twice the size it is shown at; null when nothing was drawn. */
  exportPng: () => Promise<Blob | null>;
  isEmpty: () => boolean;
}

/** Ink, blue, red, green, orange, violet — named in `labels.colors`, in this order. */
export const SKETCH_COLORS = ['#111827', '#1d4ed8', '#dc2626', '#15803d', '#ea580c', '#7c3aed'] as const;
const RULING = 32;
const ERASER_RADIUS = 12;
const EXPORT_SCALE = 2;
const MAX_EXPORT_WIDTH = 2400;

function drawPaper(context: CanvasRenderingContext2D, width: number, height: number, paper: SketchPaper) {
  if (paper === 'blank') return;
  context.save();
  context.strokeStyle = '#e5e7eb';
  context.lineWidth = 1;
  context.beginPath();
  for (let y = RULING; y < height; y += RULING) {
    context.moveTo(0, y + 0.5);
    context.lineTo(width, y + 0.5);
  }
  if (paper === 'grid') {
    for (let x = RULING; x < width; x += RULING) {
      context.moveTo(x + 0.5, 0);
      context.lineTo(x + 0.5, height);
    }
  }
  context.stroke();
  context.restore();
}

function styleFor(context: CanvasRenderingContext2D, stroke: SketchStroke) {
  context.strokeStyle = stroke.color;
  context.fillStyle = stroke.color;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.globalAlpha = stroke.tool === 'highlighter' ? 0.32 : 1;
  context.globalCompositeOperation = stroke.tool === 'highlighter' ? 'multiply' : 'source-over';
}

/**
 * Draws the stroke from `from` (a point index) on; the whole of it when
 * `from` is 1.
 *
 * A pen stroke is drawn segment by segment, each at the width its pressure
 * gives it. A highlighter is translucent, and translucent segments darken
 * where their round ends overlap — a string of beads instead of a band — so
 * it is always one path at one width, drawn in a single stroke.
 */
function drawStroke(context: CanvasRenderingContext2D, stroke: SketchStroke, pointerType: string, from = 1) {
  const points = stroke.points;
  if (points.length === 0) return;
  const size = stroke.tool === 'highlighter' ? stroke.size * HIGHLIGHTER_FACTOR : stroke.size;
  context.save();
  styleFor(context, stroke);
  if (stroke.tool === 'highlighter') {
    context.lineWidth = size;
    context.beginPath();
    context.moveTo(points[0]!.x, points[0]!.y);
    if (points.length === 1) context.lineTo(points[0]!.x + 0.01, points[0]!.y);
    for (let i = 1; i < points.length; i += 1) context.lineTo(points[i]!.x, points[i]!.y);
    context.stroke();
    context.restore();
    return;
  }
  if (points.length === 1) {
    const only = points[0]!;
    context.beginPath();
    context.arc(only.x, only.y, strokeWidth(size, only.p, pointerType) / 2, 0, Math.PI * 2);
    context.fill();
  }
  for (let i = Math.max(1, from); i < points.length; i += 1) {
    const previous = points[i - 1]!;
    const current = points[i]!;
    context.lineWidth = strokeWidth(size, (previous.p + current.p) / 2, pointerType);
    context.beginPath();
    context.moveTo(previous.x, previous.y);
    context.lineTo(current.x, current.y);
    context.stroke();
  }
  context.restore();
}

export const SketchPad = React.forwardRef<
  SketchPadHandle,
  {
    /** A picture to draw over — an earlier page being edited. */
    background?: string | null;
    labels: SketchPadLabels;
    /** Told whenever there is something on the page, or nothing any more. */
    onDirtyChange?: (dirty: boolean) => void;
    className?: string;
  }
>(function SketchPad({ background = null, labels, onDirtyChange, className }, ref) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const frameRef = React.useRef<HTMLDivElement | null>(null);
  const strokes = React.useRef<SketchStroke[]>([]);
  const past = React.useRef<SketchStroke[][]>([]);
  const future = React.useRef<SketchStroke[][]>([]);
  const active = React.useRef<{ stroke: SketchStroke; pointerId: number; pointerType: string } | null>(null);
  const erasing = React.useRef<{ pointerId: number; snapshotTaken: boolean } | null>(null);
  const penSeen = React.useRef(false);
  const backgroundImage = React.useRef<HTMLImageElement | null>(null);
  const ratio = React.useRef(1);

  const [tool, setTool] = React.useState<SketchTool>('pen');
  const [color, setColor] = React.useState<string>(SKETCH_COLORS[0]);
  const [size, setSize] = React.useState<SketchSize>('medium');
  const [paper, setPaper] = React.useState<SketchPaper>('blank');
  // null = automatic: fingers draw until a pen has been seen.
  const [penOnly, setPenOnly] = React.useState<boolean | null>(null);
  const [penDetected, setPenDetected] = React.useState(false);
  const [version, setVersion] = React.useState(0);

  const fingersDraw = penOnly === null ? !penDetected : !penOnly;

  const redraw = React.useCallback(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    const width = canvas.width / ratio.current;
    const height = canvas.height / ratio.current;
    context.setTransform(ratio.current, 0, 0, ratio.current, 0, 0);
    context.clearRect(0, 0, width, height);
    const image = backgroundImage.current;
    if (image && image.naturalWidth) {
      const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight, 1);
      context.drawImage(image, 0, 0, image.naturalWidth * scale, image.naturalHeight * scale);
    }
    for (const stroke of strokes.current) drawStroke(context, stroke, 'pen');
  }, []);

  // The canvas follows its frame in device pixels.
  React.useEffect(() => {
    const canvas = canvasRef.current;
    const frame = frameRef.current;
    if (!canvas || !frame) return;
    const fit = () => {
      ratio.current = Math.min(window.devicePixelRatio || 1, 3);
      const rect = frame.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(rect.width * ratio.current));
      canvas.height = Math.max(1, Math.round(rect.height * ratio.current));
      redraw();
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [redraw]);

  React.useEffect(() => {
    if (!background) {
      backgroundImage.current = null;
      redraw();
      return;
    }
    const image = new Image();
    image.onload = () => {
      backgroundImage.current = image;
      redraw();
      // A render, so the canvas can say the picture is in (a test waits for it).
      setVersion((v) => v + 1);
    };
    image.onerror = () => {
      backgroundImage.current = null;
      redraw();
    };
    image.src = background;
    return () => {
      image.onload = null;
      image.onerror = null;
    };
  }, [background, redraw]);

  const commit = React.useCallback(() => {
    setVersion((v) => v + 1);
    onDirtyChange?.(strokes.current.length > 0 || Boolean(backgroundImage.current));
  }, [onDirtyChange]);

  const snapshot = React.useCallback(() => {
    past.current.push(strokes.current.map((stroke) => ({ ...stroke, points: [...stroke.points] })));
    if (past.current.length > 100) past.current.shift();
    future.current = [];
  }, []);

  function positionOf(event: { clientX: number; clientY: number }): { x: number; y: number } {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function mayDraw(event: React.PointerEvent): boolean {
    if (event.pointerType === 'pen' && !penSeen.current) {
      penSeen.current = true;
      setPenDetected(true);
    }
    if (event.pointerType === 'touch') return penOnly === null ? !penSeen.current : !penOnly;
    return true;
  }

  function eraseAt(point: { x: number; y: number }) {
    const remaining = strokes.current.filter((stroke) => !strokeHit(stroke, point, ERASER_RADIUS));
    if (remaining.length === strokes.current.length) return;
    if (erasing.current && !erasing.current.snapshotTaken) {
      snapshot();
      erasing.current.snapshotTaken = true;
    }
    strokes.current = remaining;
    redraw();
  }

  function onPointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    if (!mayDraw(event) || active.current || erasing.current) return;
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    canvas.setPointerCapture(event.pointerId);
    const point = positionOf(event);
    if (tool === 'eraser') {
      erasing.current = { pointerId: event.pointerId, snapshotTaken: false };
      eraseAt(point);
      return;
    }
    snapshot();
    const stroke: SketchStroke = {
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      tool,
      color,
      size: SKETCH_SIZES[size],
      points: [{ ...point, p: event.pressure }],
    };
    strokes.current.push(stroke);
    active.current = { stroke, pointerId: event.pointerId, pointerType: event.pointerType };
    drawStroke(context, stroke, event.pointerType);
  }

  function onPointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    if (erasing.current?.pointerId === event.pointerId) {
      eraseAt(positionOf(event));
      return;
    }
    const current = active.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const context = canvasRef.current?.getContext('2d');
    if (!context) return;
    const native = event.nativeEvent as PointerEvent & { getCoalescedEvents?: () => PointerEvent[] };
    const events = native.getCoalescedEvents?.() ?? [native];
    const from = current.stroke.points.length;
    for (const sample of events.length ? events : [native]) {
      const point = positionOf(sample);
      const last = current.stroke.points[current.stroke.points.length - 1]!;
      if (Math.hypot(point.x - last.x, point.y - last.y) < 0.5) continue;
      current.stroke.points.push({ ...point, p: sample.pressure });
    }
    // A highlighter is one path, so its live drawing is a redraw of the page.
    if (current.stroke.tool === 'highlighter') redraw();
    else drawStroke(context, current.stroke, current.pointerType, from);
  }

  function onPointerEnd(event: React.PointerEvent<HTMLCanvasElement>) {
    if (erasing.current?.pointerId === event.pointerId) {
      erasing.current = null;
      commit();
      return;
    }
    if (active.current?.pointerId !== event.pointerId) return;
    active.current = null;
    commit();
  }

  const undo = React.useCallback(() => {
    const previous = past.current.pop();
    if (!previous) return;
    future.current.push(strokes.current);
    strokes.current = previous;
    redraw();
    commit();
  }, [commit, redraw]);

  const redo = React.useCallback(() => {
    const next = future.current.pop();
    if (!next) return;
    past.current.push(strokes.current);
    strokes.current = next;
    redraw();
    commit();
  }, [commit, redraw]);

  const clear = React.useCallback(() => {
    if (strokes.current.length === 0) return;
    snapshot();
    strokes.current = [];
    redraw();
    commit();
  }, [commit, redraw, snapshot]);

  function onKeyDown(event: React.KeyboardEvent) {
    if (!(event.ctrlKey || event.metaKey)) return;
    const key = event.key.toLowerCase();
    if (key === 'z' && event.shiftKey) {
      event.preventDefault();
      redo();
    } else if (key === 'z') {
      event.preventDefault();
      undo();
    } else if (key === 'y') {
      event.preventDefault();
      redo();
    }
  }

  React.useImperativeHandle(
    ref,
    () => ({
      isEmpty: () => strokes.current.length === 0 && !backgroundImage.current,
      exportPng: async () => {
        const canvas = canvasRef.current;
        if (!canvas || (strokes.current.length === 0 && !backgroundImage.current)) return null;
        const width = canvas.width / ratio.current;
        const height = canvas.height / ratio.current;
        const scale = Math.min(EXPORT_SCALE, MAX_EXPORT_WIDTH / width);
        const page = document.createElement('canvas');
        page.width = Math.round(width * scale);
        page.height = Math.round(height * scale);
        const context = page.getContext('2d');
        if (!context) return null;
        context.scale(scale, scale);
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, width, height);
        drawPaper(context, width, height, paper);
        const image = backgroundImage.current;
        if (image && image.naturalWidth) {
          const fit = Math.min(width / image.naturalWidth, height / image.naturalHeight, 1);
          context.drawImage(image, 0, 0, image.naturalWidth * fit, image.naturalHeight * fit);
        }
        for (const stroke of strokes.current) drawStroke(context, stroke, 'pen');
        return new Promise<Blob | null>((resolve) => page.toBlob(resolve, 'image/png'));
      },
    }),
    [paper],
  );

  const canUndo = past.current.length > 0;
  const canRedo = future.current.length > 0;
  void version;

  const paperStyle: React.CSSProperties =
    paper === 'blank'
      ? {}
      : paper === 'lines'
        ? { backgroundImage: `repeating-linear-gradient(to bottom, transparent 0 ${RULING - 1}px, #e5e7eb ${RULING - 1}px ${RULING}px)` }
        : {
            backgroundImage: `repeating-linear-gradient(to bottom, transparent 0 ${RULING - 1}px, #e5e7eb ${RULING - 1}px ${RULING}px), repeating-linear-gradient(to right, transparent 0 ${RULING - 1}px, #e5e7eb ${RULING - 1}px ${RULING}px)`,
          };

  const swatches = (size: 'sm' | 'lg', onPick?: () => void) =>
    SKETCH_COLORS.map((swatch, index) => (
      <button
        key={swatch}
        type="button"
        aria-label={labels.colors[index] ?? swatch}
        aria-pressed={color === swatch}
        onClick={() => {
          setColor(swatch);
          onPick?.();
        }}
        className={cn(
          'flex items-center justify-center rounded-full transition-transform',
          size === 'sm' ? 'h-8 w-8 pointer-coarse:h-10 pointer-coarse:w-10' : 'h-11 w-11',
          focusRing,
          color === swatch && 'scale-110',
        )}
      >
        <span
          aria-hidden
          className={cn('block rounded-full border-2', size === 'sm' ? 'h-5 w-5' : 'h-7 w-7', color === swatch ? 'border-ink-900' : 'border-white shadow')}
          style={{ background: swatch }}
        />
      </button>
    ));
  const paperOptions: { value: SketchPaper; label: string; icon: React.ReactNode }[] = [
    { value: 'blank', label: labels.blank, icon: <Square className="h-4 w-4" aria-hidden /> },
    { value: 'lines', label: labels.lines, icon: <AlignJustify className="h-4 w-4" aria-hidden /> },
    { value: 'grid', label: labels.grid, icon: <Grid3x3 className="h-4 w-4" aria-hidden /> },
  ];
  const popoverTrigger = cn(
    'flex h-8 w-8 items-center justify-center rounded-md text-ink-700 transition-colors hover:bg-ink-100 pointer-coarse:h-10 pointer-coarse:w-10',
    focusRing,
  );

  return (
    <div className={cn('flex h-full min-h-0 flex-col gap-2', className)} onKeyDown={onKeyDown}>
      {/* One row from a tablet up, two on a phone: there the colours sit behind
          one dot, and the paper — chosen once, if ever — behind one button always. */}
      <div
        className="flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-xl border border-ink-200 bg-white px-2 py-1.5 lg:gap-x-3"
        role="toolbar"
        aria-label={labels.tool}
      >
        <SegmentedControl
          label={labels.tool}
          value={tool}
          onChange={setTool}
          iconOnly
          options={[
            { value: 'pen', label: labels.pen, icon: <Pen className="h-4 w-4" aria-hidden /> },
            { value: 'highlighter', label: labels.highlighter, icon: <Highlighter className="h-4 w-4" aria-hidden /> },
            { value: 'eraser', label: labels.eraser, icon: <Eraser className="h-4 w-4" aria-hidden /> },
          ]}
        />
        <div role="group" aria-label={labels.color} className="hidden items-center gap-1 sm:flex">
          {swatches('sm')}
        </div>
        <Popover
          className="sm:hidden"
          width={312}
          panelLabel={labels.color}
          triggerLabel={labels.color}
          triggerTitle={labels.color}
          triggerClassName={popoverTrigger}
          triggerContent={<span aria-hidden className="block h-5 w-5 rounded-full border-2 border-white shadow" style={{ background: color }} />}
        >
          {({ close }) => (
            <div role="group" aria-label={labels.color} className="flex flex-wrap items-center gap-1 p-2">
              {swatches('lg', close)}
            </div>
          )}
        </Popover>
        <SegmentedControl
          label={labels.width}
          value={size}
          onChange={setSize}
          iconOnly
          options={(['thin', 'medium', 'thick'] as const).map((value) => ({
            value,
            label: labels[value],
            // The width itself, as a dot: no word says "medium" as well as a dot does.
            icon: <span aria-hidden className="block rounded-full bg-current" style={{ width: SKETCH_SIZES[value] + 4, height: SKETCH_SIZES[value] + 4 }} />,
          }))}
        />
        <Popover
          width={208}
          panelLabel={labels.paper}
          triggerLabel={labels.paper}
          triggerTitle={labels.paper}
          triggerClassName={popoverTrigger}
          triggerContent={paperOptions.find((option) => option.value === paper)?.icon}
        >
          {({ close }) => (
            <div role="group" aria-label={labels.paper} className="flex flex-col p-1">
              {paperOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={paper === option.value}
                  onClick={() => {
                    setPaper(option.value);
                    close();
                  }}
                  className={cn(
                    'flex h-10 items-center gap-2 rounded-md px-2 text-sm',
                    paper === option.value ? 'bg-accent text-accent-fg' : 'text-ink-800 hover:bg-ink-50',
                    focusRing,
                  )}
                >
                  {option.icon}
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </Popover>
        <div className="flex items-center gap-1">
          <ToolButton label={labels.undo} onClick={undo} disabled={!canUndo} data-sketch-undo>
            <Undo2 className="h-4 w-4 rtl:-scale-x-100" aria-hidden />
          </ToolButton>
          <ToolButton label={labels.redo} onClick={redo} disabled={!canRedo} data-sketch-redo>
            <Redo2 className="h-4 w-4 rtl:-scale-x-100" aria-hidden />
          </ToolButton>
          <ToolButton label={labels.clear} onClick={clear} disabled={strokes.current.length === 0} data-sketch-clear>
            <Trash2 className="h-4 w-4" aria-hidden />
          </ToolButton>
        </div>
        <button
          type="button"
          aria-pressed={!fingersDraw}
          aria-label={labels.penOnly}
          title={labels.penOnlyHint}
          onClick={() => setPenOnly(fingersDraw ? true : false)}
          className={cn(
            'ms-auto inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors pointer-coarse:h-10',
            !fingersDraw ? 'bg-accent text-accent-fg' : 'text-ink-600 hover:bg-ink-50',
            focusRing,
          )}
        >
          <PenTool className="h-4 w-4" aria-hidden />
          <span className="hidden lg:inline">{labels.penOnly}</span>
        </button>
      </div>

      <div ref={frameRef} className="relative min-h-0 flex-1 overflow-hidden rounded-xl border border-ink-200" style={{ background: '#ffffff', ...paperStyle }}>
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={labels.canvas}
          tabIndex={0}
          data-autofocus
          data-sketch-empty={strokes.current.length === 0 ? 'true' : 'false'}
          data-sketch-background={backgroundImage.current ? 'loaded' : 'none'}
          className={cn('block h-full w-full touch-none select-none', tool === 'eraser' ? 'cursor-cell' : 'cursor-crosshair')}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          onContextMenu={(event) => event.preventDefault()}
        />
      </div>
    </div>
  );
});

function ToolButton({
  label,
  onClick,
  disabled,
  children,
  ...rest
}: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode } & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'children'>) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      {...rest}
      className={cn(
        'inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-700 transition-colors hover:bg-ink-100 disabled:opacity-40 disabled:hover:bg-transparent pointer-coarse:h-10 pointer-coarse:w-10',
        focusRing,
      )}
    >
      {children}
    </button>
  );
}
