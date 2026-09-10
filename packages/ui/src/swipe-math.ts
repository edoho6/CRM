/**
 * When a drag on a bottom sheet means "close it".
 *
 * Pure, so it can be tested without a browser: the hook feeds it the drag
 * distance, how long it took, and the sheet's height. Two ways to dismiss —
 * a long pull (a quarter of the sheet) or a quick flick (half a pixel per
 * millisecond, over a distance no accidental touch covers). Anything short of
 * either springs back.
 */
export interface SwipeSample {
  /** Vertical distance from the pointer's start, positive = downwards, in px. */
  dy: number;
  /** Time since the pointer went down, in ms. */
  dt: number;
  /** The sheet's height, in px. */
  height: number;
}

export const DISMISS_FRACTION = 0.25;
export const DISMISS_VELOCITY = 0.5;
export const FLICK_MIN_DISTANCE = 24;

export function shouldDismiss({ dy, dt, height }: SwipeSample): boolean {
  if (dy <= 0) return false;
  if (height > 0 && dy >= height * DISMISS_FRACTION) return true;
  const velocity = dt > 0 ? dy / dt : 0;
  return velocity >= DISMISS_VELOCITY && dy >= FLICK_MIN_DISTANCE;
}

/**
 * How far the sheet follows the finger. Downwards, all the way; upwards, a
 * quarter — the sheet is already fully open, and resistance is how a native
 * sheet says so.
 */
export function dragOffset(dy: number): number {
  return dy > 0 ? dy : dy / 4;
}
