import type { Vec3 } from './frame';

/**
 * Where each acupuncture point sits on the 3D body.
 *
 * The coordinates live in the `body_points` table (migration
 * 20260915200000), one row per catalogue code for the whole service, and
 * arrive on the treatment page as rows that this module folds into a map.
 * Nothing is ever invented from the flat chart: a code with no row is
 * listed under the model, not drawn.
 *
 * Frame: see `frame.ts` — metres, +Y up, +Z front, origin between the feet,
 * 1.75 m tall, +X is the patient's LEFT.
 *
 * Bilateral points are stored ONCE, on the patient's RIGHT (x < 0). The left
 * instance is the mirror (x → -x), so correcting one number moves both sides.
 *
 * `approach` is the direction the surface faces at that point, as seen from
 * outside. The marker is snapped onto the mesh along it. It matters most on
 * the limbs: a point on the inside of the leg faces the other leg, and a
 * point on the hand of a T-posed model faces up or down, not out from the
 * body's axis. Without one, "away from the spine" is the default.
 *
 * `validated: false` means the number was placed by eye on the current
 * model and has not been checked against an anatomical reference. Rows are
 * written only by a platform admin, through the placement tool on the
 * treatment page (`point-placer.tsx`), which is also where the flag is set.
 */
export interface BodyPointPosition {
  /** The catalogue code, e.g. `ST36`. Matches `acupuncture_points.code`. */
  code: string;
  /** Bilateral points get a right and a left instance; midline points get one. */
  sideType: 'bilateral' | 'midline';
  /** Normalised metres. Right side for bilateral points; x is 0 for the midline. */
  position: Vec3;
  /** Outward-facing surface direction. Need not be unit length. */
  approach?: Vec3;
  validated: boolean;
  /** Why the number is what it is, for the person who checks it. */
  note?: string;
}

/** A row of `body_points` as PostgREST returns it. Numerics may arrive as strings. */
export interface BodyPointRow {
  code: string;
  side_type: 'bilateral' | 'midline';
  x: number | string;
  y: number | string;
  z: number | string;
  approach_x: number | string | null;
  approach_y: number | string | null;
  approach_z: number | string | null;
  validated: boolean;
  note: string | null;
}

export type BodyPointMap = ReadonlyMap<string, BodyPointPosition>;

const EMPTY: BodyPointMap = new Map();

function num(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/** One row, folded; null when a coordinate is missing or not a number. */
export function toBodyPointPosition(row: BodyPointRow): BodyPointPosition | null {
  const x = num(row.x);
  const y = num(row.y);
  const z = num(row.z);
  if (x === null || y === null || z === null) return null;
  const ax = num(row.approach_x);
  const ay = num(row.approach_y);
  const az = num(row.approach_z);
  const approach = ax !== null && ay !== null && az !== null ? { x: ax, y: ay, z: az } : undefined;
  return {
    code: row.code.toUpperCase(),
    sideType: row.side_type === 'midline' ? 'midline' : 'bilateral',
    position: { x: row.side_type === 'midline' ? 0 : x, y, z },
    approach,
    validated: row.validated === true,
    note: row.note ?? undefined,
  };
}

/** The rows from the database, keyed by code. A malformed row is skipped, not guessed at. */
export function toBodyPointMap(rows: readonly BodyPointRow[] | null | undefined): BodyPointMap {
  if (!rows || rows.length === 0) return EMPTY;
  const map = new Map<string, BodyPointPosition>();
  for (const row of rows) {
    const entry = toBodyPointPosition(row);
    if (entry) map.set(entry.code, entry);
  }
  return map;
}

export function findBodyPoint(positions: BodyPointMap, code: string): BodyPointPosition | undefined {
  return positions.get(code.toUpperCase());
}

export type BodySide = 'right' | 'left' | 'midline';

export interface PlacedPosition {
  position: Vec3;
  approach?: Vec3;
  validated: boolean;
}

/**
 * The position of a point on a given side.
 *
 * The left is the stored right mirrored across the midline. Asking for a
 * side on a midline point, or the midline on a bilateral one, is answered
 * with the stored coordinate as-is: the note may record "right" for a
 * midline point, and drawing it at the midline is still the honest answer.
 */
export function positionFor(entry: BodyPointPosition, side: BodySide): PlacedPosition {
  const mirror = entry.sideType === 'bilateral' && side === 'left';
  return {
    position: mirror ? { ...entry.position, x: -entry.position.x } : entry.position,
    approach: entry.approach
      ? mirror
        ? { ...entry.approach, x: -entry.approach.x }
        : entry.approach
      : undefined,
    validated: entry.validated,
  };
}
