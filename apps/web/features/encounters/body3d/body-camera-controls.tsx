'use client';

import { useEffect, useRef, type ComponentRef } from 'react';
import { Vector3 } from 'three';
import { OrbitControls } from '@react-three/drei';
import { useThree } from '@react-three/fiber';

export type CameraView = 'front' | 'back' | 'left' | 'right' | 'reset';

/**
 * A request to move the camera. The sequence number makes pressing "front"
 * twice in a row work — the same view again is still a new request.
 */
export interface ViewRequest {
  view: CameraView;
  seq: number;
}

/** Where the camera looks: roughly the navel, which keeps the whole body in frame. */
const TARGET = new Vector3(0, 0.9, 0);
const DISTANCE = 3;
export const HOME_POSITION: [number, number, number] = [0, 1.05, DISTANCE];

/**
 * Where the camera stands for each view. "Left" is the patient's left, which
 * in the stored frame is +X — the camera stands on that side and looks at it.
 */
const STAND: Record<Exclude<CameraView, 'reset'>, Vector3> = {
  front: new Vector3(0, 0.05, 1),
  back: new Vector3(0, 0.05, -1),
  left: new Vector3(1, 0.05, 0),
  right: new Vector3(-1, 0.05, 0),
};

/**
 * Orbit, zoom and touch, with no panning: the body should never drift out of
 * the frame, and a reset button that also has to undo a pan is a reset
 * button people need more often.
 */
export function BodyCameraControls({ request }: { request: ViewRequest | null }) {
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const camera = useThree((state) => state.camera);
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    if (!request) return;
    if (request.view === 'reset') {
      camera.position.set(...HOME_POSITION);
    } else {
      camera.position.copy(TARGET).addScaledVector(STAND[request.view].clone().normalize(), DISTANCE);
    }
    const current = controls.current;
    if (current) {
      current.target.copy(TARGET);
      current.update();
    } else {
      camera.lookAt(TARGET);
    }
    invalidate();
  }, [request, camera, invalidate]);

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      target={TARGET}
      enablePan={false}
      enableDamping={false}
      minDistance={0.5}
      maxDistance={6}
      // Just short of straight up and straight down, where orbit controls
      // lose their bearings.
      minPolarAngle={0.05}
      maxPolarAngle={Math.PI - 0.05}
    />
  );
}
