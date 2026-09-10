import { Raycaster, Vector3, type Object3D } from 'three';
import type { Vec3 } from './frame';

/**
 * Snapping a stored coordinate onto the skin of whatever model is loaded.
 *
 * A coordinate measured on one model will sit a little inside or outside the
 * next one, and a marker floating a centimetre above the skin — or buried in
 * it — reads as wrong even when the number is right. So the marker is not
 * drawn at the coordinate: a probe is cast from just outside the body, along
 * the surface direction, and the marker lands where the probe first meets
 * the mesh, a hair above it.
 */

/** How far outside the coordinate the probe starts. Wider than any limb. */
const REACH = 0.18;
/** How far above the skin the marker sits so it is not half-buried. */
const LIFT = 0.004;

export interface SnapResult {
  position: Vector3;
  normal: Vector3;
  /** False when no surface was found and the raw coordinate is being used. */
  snapped: boolean;
}

/**
 * The direction the surface faces at this point, as seen from outside.
 *
 * The recorded `approach` wins. Without one, "away from the body's vertical
 * axis" is right for the trunk, the head and the legs — and wrong for the
 * arms of a T-posed model, which is why arm points record an approach.
 */
export function surfaceNormalFor(position: Vec3, approach?: Vec3): Vector3 {
  if (approach) {
    const given = new Vector3(approach.x, approach.y, approach.z);
    if (given.lengthSq() > 1e-8) return given.normalize();
  }
  const radial = new Vector3(position.x, 0, position.z);
  if (radial.lengthSq() < 1e-6) return new Vector3(0, 0, 1);
  return radial.normalize();
}

export function snapToSurface(
  position: Vec3,
  approach: Vec3 | undefined,
  meshes: Object3D[],
  raycaster: Raycaster = new Raycaster(),
): SnapResult {
  const target = new Vector3(position.x, position.y, position.z);
  const normal = surfaceNormalFor(position, approach);

  raycaster.near = 0;
  raycaster.far = REACH * 2;

  // Probe inwards from outside, then outwards from inside. Between them the
  // two probes cover a coordinate that is slightly outside the skin and one
  // that is slightly under it; of every surface either finds, the one
  // nearest the coordinate is the surface the number was describing.
  const probes: [Vector3, Vector3][] = [
    [target.clone().addScaledVector(normal, REACH), normal.clone().negate()],
    [target.clone().addScaledVector(normal, -REACH), normal.clone()],
  ];

  let best: { point: Vector3; faceNormal: Vector3 | null; distance: number } | null = null;
  for (const [origin, direction] of probes) {
    raycaster.set(origin, direction);
    for (const hit of raycaster.intersectObjects(meshes, false)) {
      const distance = hit.point.distanceTo(target);
      if (best && distance >= best.distance) continue;
      const faceNormal = hit.face
        ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld)
        : null;
      best = { point: hit.point.clone(), faceNormal, distance };
    }
  }

  if (!best) return { position: target, normal, snapped: false };

  // Lift along the face if it agrees with the approach; a back-facing hit
  // (the far wall of a thin limb) is lifted along the approach instead.
  const lift = best.faceNormal && best.faceNormal.dot(normal) > 0 ? best.faceNormal : normal;
  return { position: best.point.addScaledVector(lift, LIFT), normal: lift, snapped: true };
}
