'use client';

import * as React from 'react';
import { cn } from './cn';
import { focusField, focusRing } from './focus';

/**
 * A signature, drawn or typed.
 *
 * Two routes to the same result, and the second one is not a fallback. Drawing
 * with a finger or a mouse is impossible for some people and awkward for many —
 * anyone using a keyboard alone, anyone with a tremor, anyone on a machine with
 * a trackpad and no touch. A form that can only be completed by drawing is a
 * form some patients cannot complete, which in a clinic means they cannot
 * consent. Typing your own name is offered beside it as an equal option, and
 * which one was used is recorded rather than hidden.
 *
 * Pointer Events rather than separate mouse and touch handlers: one code path
 * covers mouse, finger and stylus, and `setPointerCapture` keeps a stroke
 * attached to the canvas when the hand wanders off the edge mid-signature.
 *
 * The canvas is sized in device pixels and scaled down in CSS, so a signature
 * drawn on a phone is not a blurry enlargement of a low-resolution bitmap.
 */

export type SignatureMethod = 'drawn' | 'typed';

export interface SignatureValue {
  method: SignatureMethod;
  /** A PNG data URL when drawn, the typed name when not. */
  content: string;
}

const WIDTH = 560;
const HEIGHT = 180;

export function SignaturePad({
  value,
  onChange,
  disabled = false,
  labels,
  className,
}: {
  value: SignatureValue | null;
  onChange: (value: SignatureValue | null) => void;
  disabled?: boolean;
  /** Every string, so the package stays free of a translation dependency. */
  labels: {
    /** Names the whole control, e.g. "Signature". */
    legend: string;
    draw: string;
    type: string;
    drawHint: string;
    typeHint: string;
    typedLabel: string;
    clear: string;
  };
  className?: string;
}) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const drawing = React.useRef(false);
  const hasInk = React.useRef(false);

  const [mode, setMode] = React.useState<SignatureMethod>(
    value?.method === 'typed' ? 'typed' : 'drawn',
  );
  const [typed, setTyped] = React.useState(value?.method === 'typed' ? value.content : '');
  // Its own id per instance: two pads on one page (a consent form and a
  // questionnaire) used to share one, and the label pointed at the wrong one.
  const typedId = React.useId();

  /** Device pixels per CSS pixel, so the stroke is sharp on a phone. */
  const ratio = React.useRef(1);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    ratio.current = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = WIDTH * ratio.current;
    canvas.height = HEIGHT * ratio.current;

    const context = canvas.getContext('2d');
    if (!context) return;
    context.scale(ratio.current, ratio.current);
    context.lineWidth = 2;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    // Explicit rather than inherited: the canvas is transparent, and a stroke
    // that took its colour from the theme would vanish when the PNG is later
    // shown on white paper.
    context.strokeStyle = '#111111';
  }, []);

  function positionOf(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    // The canvas is drawn at WIDTH×HEIGHT but laid out at whatever width the
    // column gives it, so a pointer position has to be mapped back.
    return {
      x: ((event.clientX - rect.left) / rect.width) * WIDTH,
      y: ((event.clientY - rect.top) / rect.height) * HEIGHT,
    };
  }

  function start(event: React.PointerEvent<HTMLCanvasElement>) {
    if (disabled) return;
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;

    drawing.current = true;
    canvas.setPointerCapture(event.pointerId);
    const { x, y } = positionOf(event);
    context.beginPath();
    context.moveTo(x, y);
    // A tap with no movement should still leave a mark, so the dot is drawn now
    // rather than waiting for a stroke that may never come.
    context.lineTo(x, y);
    context.stroke();
    hasInk.current = true;
  }

  function move(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const context = canvasRef.current?.getContext('2d');
    if (!context) return;
    const { x, y } = positionOf(event);
    context.lineTo(x, y);
    context.stroke();
  }

  function end() {
    if (!drawing.current) return;
    drawing.current = false;
    const canvas = canvasRef.current;
    if (!canvas || !hasInk.current) return;
    onChange({ method: 'drawn', content: canvas.toDataURL('image/png') });
  }

  function clear() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (canvas && context) {
      context.clearRect(0, 0, WIDTH, HEIGHT);
      hasInk.current = false;
    }
    setTyped('');
    onChange(null);
  }

  function chooseMode(next: SignatureMethod) {
    // Switching route discards what was there. Carrying a drawing over into the
    // typed box would leave the person unable to tell what they are about to
    // sign with.
    if (next === mode) return;
    clear();
    setMode(next);
  }

  return (
    <fieldset className={cn('min-w-0', className)} disabled={disabled}>
      <legend className="mb-1.5 text-sm font-medium text-ink-800">{labels.legend}</legend>

      {/* Two equal choices, not a control and an escape hatch. */}
      <div
        className="mb-2 inline-flex rounded-lg border border-ink-200 bg-white p-0.5"
        role="radiogroup"
        aria-label={labels.legend}
      >
        {(['drawn', 'typed'] as const).map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={mode === option}
            onClick={() => chooseMode(option)}
            className={cn(
              'min-h-9 rounded-md px-4 py-1 text-sm font-medium transition-colors pointer-coarse:min-h-10',
              focusRing,
              mode === option ? 'bg-accent text-accent-fg' : 'text-ink-600 hover:bg-ink-50',
            )}
          >
            {option === 'drawn' ? labels.draw : labels.type}
          </button>
        ))}
      </div>

      {mode === 'drawn' ? (
        <div className="space-y-1.5">
          <canvas
            ref={canvasRef}
            onPointerDown={start}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={end}
            style={{ aspectRatio: `${WIDTH} / ${HEIGHT}`, touchAction: 'none' }}
            /* Literally white, in both themes — this is the one surface in the
               app that must not follow `--color-white`.

               The stroke is fixed at #111111 for the reason given where it is
               set: the PNG is evidence and will be shown on paper, so its ink
               cannot be a theme colour. But `bg-white` *is* a theme colour, and
               in dark mode it resolves to #1e2225 — putting near-black ink on
               near-black ground at about 1.2:1. Signing in dark mode drew a
               line nobody could see.

               Treating the pad as a sheet of paper rather than as a panel fixes
               both halves at once: the ink stays valid for print, and what you
               draw is visible while you draw it. `border-ink-300` still reads
               against white in dark mode (about 8:1), so the frame is fine. */
            className="w-full max-w-lg rounded-lg border border-ink-300 bg-[#ffffff]"
            // Described rather than labelled: a canvas has no value to announce,
            // and the honest thing to say is what it is and where the other
            // route is.
            role="img"
            aria-label={labels.drawHint}
          />
          <p className="text-xs text-ink-600">{labels.drawHint}</p>
        </div>
      ) : (
        <div className="max-w-lg space-y-1.5">
          <label htmlFor={typedId} className="sr-only">
            {labels.typedLabel}
          </label>
          <input
            id={typedId}
            type="text"
            autoComplete="name"
            value={typed}
            onChange={(event) => {
              const next = event.target.value;
              setTyped(next);
              onChange(next.trim().length >= 2 ? { method: 'typed', content: next.trim() } : null);
            }}
            className={cn(
              'w-full rounded-lg border border-ink-300 bg-white px-3 py-2 font-[cursive] text-lg text-ink-900',
              focusField,
            )}
          />
          <p className="text-xs text-ink-600">{labels.typeHint}</p>
        </div>
      )}

      {/* A button that looks like one: the link-styled word was a 14px target
          under a signature drawn with a finger. */}
      <button
        type="button"
        onClick={clear}
        className={cn(
          'mt-2 inline-flex min-h-9 items-center rounded-md border border-ink-200 bg-white px-3 text-sm font-medium text-ink-700 transition-colors hover:bg-ink-50 active:bg-ink-100 pointer-coarse:min-h-10',
          focusRing,
        )}
      >
        {labels.clear}
      </button>
    </fieldset>
  );
}
