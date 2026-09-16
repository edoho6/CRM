import { toPointPlacement } from '@clinic/domain';
import type { RecordedPoint } from '@clinic/db/types';
import type { PrescriptionLine } from './current-prescription-context';

/**
 * What changed between two treatments.
 *
 * The comparison itself, away from the panel that draws it. It decides which
 * point and which herb is the *same* one across two visits, and that decision
 * is clinical: match too loosely and a dropped point looks kept; match too
 * strictly and every visit looks like a fresh start. It was two `useMemo`
 * bodies inside a 740-line component, where the rule in CLAUDE.md says it
 * should not be — and where it could not be tested.
 *
 * Nothing here knows about colour, translation or React. The panel adds those.
 */

export type Placement = 'right' | 'left' | 'center' | 'ear';

export type Status = 'kept' | 'dropped' | 'added' | 'changed';

export interface PointCell {
  key: string;
  code: string;
  placement: Placement;
  status: Status;
  /** The pair's colour, when the same point is on both sides. */
  pair?: number;
}

export interface HerbCell {
  key: string;
  name: string;
  quantity: number | null;
  herbId?: string | null;
  status: Status;
  /** The earlier dose, for a changed line. */
  was?: number | null;
  /** The pair's colour, when the same herb is on both sides. */
  pair?: number;
}

/** A point in the record being written: a code and the region chosen for it. */
export interface CurrentPoint {
  point: string;
  region: string;
}

/** The two sides of a comparison, in the order they are drawn. */
export interface Sides<T> {
  before: T[];
  now: T[];
}

/** Older notes carry a `side` and no region; the same rule the form applies. */
export function placementOf(point: RecordedPoint): Placement {
  if (point.region) return toPointPlacement(point.region);
  if (point.side === 'left') return 'left';
  if (point.side === 'midline') return 'center';
  return 'right';
}

/**
 * What makes two points the same point.
 *
 * The code **and** the side: LI4 on the right and LI4 on the left are two
 * needles, and a practitioner who moved from one to the other did something,
 * which a comparison that ignored the side would report as "no change".
 * Case and stray spaces are not part of the identity — the same code typed
 * in two visits is the same point.
 */
export function pointKey(code: string, placement: string): string {
  return `${code.trim().toLowerCase()}|${placement}`;
}

/** Doses closer than this are the same dose: numeric columns are not exact. */
const DOSE_EPSILON = 0.001;

/**
 * Points, before and now.
 *
 * Everything on the earlier side starts as dropped and everything on the
 * current side as added; whatever appears on both is marked kept and given a
 * pair number, which is how the two columns are tied together on screen. A
 * point recorded twice in one visit — the same code and side — is one point,
 * not two.
 */
export function comparePoints(
  previous: RecordedPoint[],
  current: CurrentPoint[],
): Sides<PointCell> {
  const before = new Map<string, PointCell>();
  for (const point of previous) {
    const placement = placementOf(point);
    const key = pointKey(point.point, placement);
    if (!before.has(key)) before.set(key, { key, code: point.point, placement, status: 'dropped' });
  }

  const now = new Map<string, PointCell>();
  for (const point of current) {
    const placement = toPointPlacement(point.region);
    const key = pointKey(point.point, placement);
    if (!now.has(key)) now.set(key, { key, code: point.point, placement, status: 'added' });
  }

  let pair = 0;
  for (const [key, cell] of before) {
    const match = now.get(key);
    if (!match) continue;
    cell.status = 'kept';
    cell.pair = pair;
    match.status = 'kept';
    match.pair = pair;
    pair += 1;
  }

  return { before: [...before.values()], now: [...now.values()] };
}

/**
 * Herbs, before and now.
 *
 * Same shape as the points, with one more state: a herb on both sides whose
 * dose moved is **changed**, and it carries the earlier figure so the line can
 * say "from nine to six". The earlier side of such a line stays "kept" — it is
 * the same herb, and the change belongs to the column that changed it.
 *
 * Lines are matched on the key the prescription already assigns (a catalogue
 * id, or the typed name folded), so a herb chosen from the catalogue and the
 * same herb typed by hand are deliberately not the same line.
 */
export function compareHerbs(
  previous: PrescriptionLine[],
  current: PrescriptionLine[],
): Sides<HerbCell> {
  const before = new Map<string, HerbCell>();
  for (const line of previous) {
    if (!before.has(line.key)) before.set(line.key, { ...line, status: 'dropped' });
  }

  const now = new Map<string, HerbCell>();
  for (const line of current) {
    if (!now.has(line.key)) now.set(line.key, { ...line, status: 'added' });
  }

  let pair = 0;
  for (const [key, cell] of before) {
    const match = now.get(key);
    if (!match) continue;
    cell.status = 'kept';
    cell.pair = pair;
    match.pair = pair;
    pair += 1;
    const moved =
      cell.quantity !== null &&
      match.quantity !== null &&
      Math.abs(cell.quantity - match.quantity) > DOSE_EPSILON;
    if (moved) {
      match.status = 'changed';
      match.was = cell.quantity;
    } else {
      match.status = 'kept';
    }
  }

  return { before: [...before.values()], now: [...now.values()] };
}
