/**
 * The coordinate frame every body point is stored in.
 *
 * +Y is up, +Z is the front of the body, the origin is on the floor between
 * the feet, units are metres, and the body is 1.75 m tall. In a right-handed
 * frame with the body facing +Z, +X is therefore the patient's anatomical
 * LEFT — facing the camera, the patient's left appears on the right of the
 * screen, exactly as it does when a patient stands in front of you.
 *
 * Whatever model is loaded is scaled and shifted into this frame at runtime
 * from its bounding box, so the stored coordinates outlive a change of model
 * as long as the proportions are close. They are still only as good as the
 * model they were measured on — see `points.ts`.
 */

export const NORMALISED_HEIGHT_M = 1.75;

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface BoxLike {
  min: Vec3;
  max: Vec3;
}

export interface Normalisation {
  /** Multiply model coordinates by this. */
  scale: number;
  /** Then add this. Applied after the scale, so it is in normalised metres. */
  offset: Vec3;
}

/**
 * Scale to the standard height and put the floor between the feet at the origin.
 *
 * A degenerate box (a model that failed to load, or a single point) leaves the
 * scale at 1 rather than dividing by zero.
 */
export function computeNormalisation(box: BoxLike): Normalisation {
  const height = box.max.y - box.min.y;
  const scale = height > 0 && Number.isFinite(height) ? NORMALISED_HEIGHT_M / height : 1;
  const centreX = (box.min.x + box.max.x) / 2;
  const centreZ = (box.min.z + box.max.z) / 2;
  return {
    scale,
    offset: {
      x: -centreX * scale,
      y: -box.min.y * scale,
      z: -centreZ * scale,
    },
  };
}

export function applyNormalisation(point: Vec3, normalisation: Normalisation): Vec3 {
  return {
    x: point.x * normalisation.scale + normalisation.offset.x,
    y: point.y * normalisation.scale + normalisation.offset.y,
    z: point.z * normalisation.scale + normalisation.offset.z,
  };
}
