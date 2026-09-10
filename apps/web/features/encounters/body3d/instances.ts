import { placementSide, toPointPlacement } from '@clinic/domain';
import type { MappedPoint } from '@/features/reference/body-map';
import type { Vec3 } from './frame';
import { findBodyPoint, positionFor, type BodySide } from './points';

/**
 * One marker on the 3D body.
 *
 * The key is the point code plus its side — `ST36_R`, `ST36_L`, `REN4` — so
 * the same point prescribed twice on one side is one marker, not two on top
 * of each other. (The flat chart draws both; the difference is deliberate and
 * harmless, since the list beside the chart is the record.)
 */
export interface PointInstance {
  key: string;
  code: string;
  label: string;
  pointId: string;
  side: BodySide;
  position: Vec3;
  approach?: Vec3;
  validated: boolean;
}

export interface PointInstancesResult {
  instances: PointInstance[];
  /** Selected points that have no coordinate yet, each code once. */
  missingCodes: string[];
}

function sidesFor(point: MappedPoint, sideType: 'bilateral' | 'midline'): BodySide[] {
  if (sideType === 'midline') return ['midline'];
  // Same rule as the flat chart: the note records which side was needled. A
  // paired point recorded at the midline or the ear stated no side, so both
  // are shown — the older reading, and still the honest one.
  const side = placementSide(toPointPlacement(point.region));
  if (side === 'left') return ['left'];
  if (side === 'right') return ['right'];
  return point.bilateral ? ['right', 'left'] : ['right'];
}

function keyFor(code: string, side: BodySide): string {
  if (side === 'midline') return code;
  return `${code}_${side === 'right' ? 'R' : 'L'}`;
}

/**
 * The selected points, as markers.
 *
 * Pure: the input is exactly what the flat chart receives, so the two views
 * can never disagree about what was chosen. Only the coordinate source
 * differs.
 */
export function buildPointInstances(points: MappedPoint[]): PointInstancesResult {
  const instances = new Map<string, PointInstance>();
  const missing = new Set<string>();

  for (const point of points) {
    const entry = findBodyPoint(point.code);
    if (!entry) {
      missing.add(point.code);
      continue;
    }
    for (const side of sidesFor(point, entry.sideType)) {
      const key = keyFor(point.code, side);
      if (instances.has(key)) continue;
      const placed = positionFor(point.code, side);
      if (!placed) continue;
      instances.set(key, {
        key,
        code: point.code,
        label: point.label,
        pointId: point.pointId,
        side,
        position: placed.position,
        approach: placed.approach,
        validated: placed.validated,
      });
    }
  }

  return { instances: [...instances.values()], missingCodes: [...missing] };
}
