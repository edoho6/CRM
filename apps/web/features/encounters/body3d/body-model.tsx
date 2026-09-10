'use client';

import { useEffect, useMemo, useRef } from 'react';
import { Box3, Group, Mesh, MeshStandardMaterial, SkinnedMesh } from 'three';
import { useGLTF } from '@react-three/drei';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import { computeNormalisation, type Vec3 } from './frame';

/**
 * Served from `apps/web/public/models/`. Same origin, so it needs nothing
 * from the content-security policy that the rest of the app does not already
 * have. Whatever replaces it must also be a plain `.glb` — no Draco, no
 * Meshopt, no embedded textures — for the same reason: those decode through
 * workers and blob URLs, which the policy blocks. See the README beside it.
 */
export const BODY_MODEL_URL = '/models/body.glb';

/** Forget a failed load so the next mount tries the network again. */
export function clearBodyModel() {
  useGLTF.clear(BODY_MODEL_URL);
}

export interface PickEvent {
  /** In the normalised frame — the frame `points.ts` is written in. */
  position: Vec3;
  /** The face the click landed on, outward, as a ready-made `approach`. */
  normal: Vec3;
}

/**
 * The body itself, normalised into the stored frame.
 *
 * The model is fitted from its bounding box — scaled to 1.75 m and moved so
 * the floor between the feet is the origin — rather than trusting whatever
 * units and origin it was exported with. A skinned mesh is measured through
 * its skeleton, in the pose it will actually be drawn in.
 *
 * The material is replaced with one flat, matte colour from the theme. The
 * markers are the thing being read; the body is context.
 */
export function BodyModel({
  color,
  onReady,
  onPick,
}: {
  color: string;
  /** Fires once the meshes are placed and can be probed by the marker layer. */
  onReady: (meshes: Mesh[]) => void;
  /** Development-only point editor hook; undefined in normal use. */
  onPick?: (event: PickEvent) => void;
}) {
  // No Draco and no Meshopt: both are decoded off the main thread through
  // resources the content-security policy does not allow.
  const { scene } = useGLTF(BODY_MODEL_URL, false, false);
  const group = useRef<Group>(null);
  const invalidate = useThree((state) => state.invalidate);

  const material = useMemo(() => new MeshStandardMaterial({ roughness: 0.9, metalness: 0 }), []);
  useEffect(() => () => material.dispose(), [material]);

  useEffect(() => {
    material.color.set(color);
    invalidate();
  }, [color, material, invalidate]);

  useEffect(() => {
    const root = group.current;
    if (!root) return;

    scene.updateMatrixWorld(true);
    const meshes: Mesh[] = [];
    const bounds = new Box3();
    scene.traverse((object) => {
      if (!(object as Mesh).isMesh) return;
      const mesh = object as Mesh;
      mesh.material = material;
      // A skinned mesh's geometry box is its bind pose; culling against it
      // can blank the body mid-orbit. It is one object; always draw it.
      mesh.frustumCulled = false;
      meshes.push(mesh);

      if ((mesh as SkinnedMesh).isSkinnedMesh) {
        const skinned = mesh as SkinnedMesh;
        skinned.computeBoundingBox();
        bounds.union(skinned.boundingBox!.clone().applyMatrix4(skinned.matrixWorld));
      } else {
        mesh.geometry.computeBoundingBox();
        bounds.union(mesh.geometry.boundingBox!.clone().applyMatrix4(mesh.matrixWorld));
      }
    });

    const fit = computeNormalisation(bounds);
    root.scale.setScalar(fit.scale);
    root.position.set(fit.offset.x, fit.offset.y, fit.offset.z);
    // Done here rather than left to the next frame, so the marker layer can
    // probe the meshes the moment it hears they are ready.
    root.updateMatrixWorld(true);

    onReady(meshes);
    invalidate();
  }, [scene, material, onReady, invalidate]);

  const handleClick = onPick
    ? (event: ThreeEvent<MouseEvent>) => {
        event.stopPropagation();
        const normal = event.face
          ? event.face.normal.clone().transformDirection(event.object.matrixWorld)
          : event.point.clone().setY(0).normalize();
        onPick({
          position: { x: event.point.x, y: event.point.y, z: event.point.z },
          normal: { x: normal.x, y: normal.y, z: normal.z },
        });
      }
    : undefined;

  return (
    <group ref={group} onClick={handleClick}>
      <primitive object={scene} />
    </group>
  );
}
