/**
 * The arithmetic of a hand-drawn stroke, apart from the canvas so it can be
 * tested: how wide a line is under a given pressure, and whether an eraser
 * touched a stroke.
 */

export interface SketchPoint {
  x: number;
  y: number;
  /** 0–1 from a stylus; a mouse reports 0.5, a finger 0 or 1 depending on the platform. */
  p: number;
}

export type SketchTool = 'pen' | 'highlighter' | 'eraser';

export interface SketchStroke {
  id: string;
  tool: 'pen' | 'highlighter';
  color: string;
  /** The nominal width in CSS pixels. */
  size: number;
  points: SketchPoint[];
}

/** Nominal widths, in CSS pixels, of the three settings. */
export const SKETCH_SIZES = { thin: 2, medium: 4, thick: 7 } as const;
export type SketchSize = keyof typeof SKETCH_SIZES;
/** A highlighter is a broad, translucent pen. */
export const HIGHLIGHTER_FACTOR = 4;

/**
 * The width a segment is drawn at. A stylus that reports pressure thins
 * the line when it barely touches and thickens it when pressed; a mouse or
 * a finger, which report no pressure worth the name, draw at the nominal
 * width. The range is bounded so a heavy hand does not blot.
 */
export function strokeWidth(size: number, pressure: number, pointerType: string): number {
  if (pointerType !== 'pen' || !(pressure > 0)) return size;
  const factor = Math.min(1.7, Math.max(0.45, 0.45 + pressure * 1.25));
  return size * factor;
}

export function distanceToSegment(point: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0 ? 0 : Math.min(1, Math.max(0, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared));
  const px = a.x + t * dx;
  const py = a.y + t * dy;
  return Math.hypot(point.x - px, point.y - py);
}

/** Whether an eraser of the given radius, at the point, touches the stroke anywhere along it. */
export function strokeHit(stroke: SketchStroke, point: { x: number; y: number }, radius: number): boolean {
  const reach = radius + (stroke.tool === 'highlighter' ? stroke.size * HIGHLIGHTER_FACTOR : stroke.size) / 2;
  const points = stroke.points;
  if (points.length === 0) return false;
  if (points.length === 1) return Math.hypot(point.x - points[0]!.x, point.y - points[0]!.y) <= reach;
  for (let i = 1; i < points.length; i += 1) {
    if (distanceToSegment(point, points[i - 1]!, points[i]!) <= reach) return true;
  }
  return false;
}
