'use client';

import type { Vector3 } from 'three';
import { Html } from '@react-three/drei';

/**
 * The label beside the active marker: "ST36 — Zu San Li".
 *
 * Rendered as HTML over the canvas rather than as a texture, so it uses the
 * page's font, colours and dark mode for free. `dir="auto"` lets a Hebrew
 * label read right-to-left inside a canvas wrapper that is pinned to LTR.
 * It takes no pointer events, or it would steal the hover that shows it.
 */
export function PointTooltip({
  position,
  code,
  label,
}: {
  position: Vector3;
  code: string;
  label: string;
}) {
  return (
    <Html position={position} center zIndexRange={[20, 10]} style={{ pointerEvents: 'none' }}>
      <div
        dir="auto"
        className="pointer-events-none -translate-y-7 rounded-md border border-ink-200 bg-white px-2 py-1 text-xs font-medium whitespace-nowrap text-ink-900 shadow-sm"
      >
        <span dir="ltr">{code}</span>
        {label && label !== code ? <span> — {label}</span> : null}
      </div>
    </Html>
  );
}
