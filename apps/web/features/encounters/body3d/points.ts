import type { Vec3 } from './frame';

/**
 * Where each acupuncture point sits on the 3D body.
 *
 * This is the only place a coordinate lives. The catalogue in the database
 * knows a point's name, channel and flat-chart position; the 3D position is a
 * separate concern kept here, deliberately, so that a clinician can correct
 * one number without a migration and so that nothing is ever invented on the
 * fly from the flat chart.
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
 * body's axis. Leave it out for trunk points, where "away from the spine" is
 * right by default.
 *
 * `validated: false` means the number was placed by eye on the current
 * model and has not been checked against an anatomical
 * reference. Nothing here is validated yet. Do not add coordinates for more
 * points by guessing — place them with the point editor
 * (`?pointEditor=1` on a treatment page in development) and have them
 * reviewed before flipping the flag.
 */
export interface BodyPointPosition {
  /** The catalogue code, e.g. `ST36`. Must match `acupuncture_points.code`. */
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

const DEV_MODEL_NOTE =
  'Placed by eye on the Blender Human Base Meshes realistic male (v1.4.1), not against an anatomical reference.';

/**
 * A small demonstration set — one point per major region — enough to prove
 * the plumbing, and nothing more. All seven are unvalidated.
 */
export const BODY_POINT_POSITIONS: readonly BodyPointPosition[] = [
  {
    code: 'DU20',
    sideType: 'midline',
    position: { x: 0, y: 1.75, z: 0 },
    approach: { x: 0, y: 1, z: 0 },
    validated: false,
    note: `${DEV_MODEL_NOTE} Vertex of the head.`,
  },
  {
    code: 'REN4',
    sideType: 'midline',
    position: { x: 0, y: 0.97, z: 0.1 },
    approach: { x: 0, y: 0, z: 1 },
    validated: false,
    note: `${DEV_MODEL_NOTE} Lower abdomen, below the navel.`,
  },
  {
    code: 'LI4',
    sideType: 'bilateral',
    position: { x: -0.45, y: 0.82, z: 0.08 },
    approach: { x: -1, y: 0, z: 0 },
    validated: false,
    note: `${DEV_MODEL_NOTE} Back of the hand near the thumb web; the palm faces the thigh in this pose.`,
  },
  {
    code: 'PC6',
    sideType: 'bilateral',
    position: { x: -0.37, y: 0.92, z: 0.03 },
    approach: { x: 0.6, y: 0, z: 0.8 },
    validated: false,
    note: `${DEV_MODEL_NOTE} Palm side of the forearm above the wrist; faces forward and inward in this pose.`,
  },
  {
    code: 'ST36',
    sideType: 'bilateral',
    position: { x: -0.18, y: 0.42, z: -0.03 },
    approach: { x: -0.6, y: 0, z: 0.8 },
    validated: false,
    note: `${DEV_MODEL_NOTE} Outer front of the lower leg below the knee.`,
  },
  {
    code: 'SP6',
    sideType: 'bilateral',
    position: { x: -0.145, y: 0.17, z: -0.09 },
    approach: { x: 1, y: 0, z: 0.2 },
    validated: false,
    note: `${DEV_MODEL_NOTE} Inner lower leg above the ankle; faces the other leg.`,
  },
  {
    code: 'LR3',
    sideType: 'bilateral',
    position: { x: -0.19, y: 0.075, z: 0 },
    approach: { x: 0, y: 1, z: 0.2 },
    validated: false,
    note: `${DEV_MODEL_NOTE} Top of the foot.`,
  },
];

const BY_CODE = new Map(BODY_POINT_POSITIONS.map((entry) => [entry.code, entry]));

export function findBodyPoint(code: string): BodyPointPosition | undefined {
  return BY_CODE.get(code);
}

export type BodySide = 'right' | 'left' | 'midline';

export interface PlacedPosition {
  position: Vec3;
  approach?: Vec3;
  validated: boolean;
}

/**
 * The position of a point on a given side, or null when none is recorded.
 *
 * The left is the stored right mirrored across the midline. Asking for a
 * side on a midline point, or the midline on a bilateral one, is answered
 * with the stored coordinate as-is: the note may record "right" for a
 * midline point, and drawing it at the midline is still the honest answer.
 */
export function positionFor(code: string, side: BodySide): PlacedPosition | null {
  const entry = BY_CODE.get(code);
  if (!entry) return null;
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
