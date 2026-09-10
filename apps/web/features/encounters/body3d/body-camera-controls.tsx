'use client';

import { useEffect, useRef, type ComponentRef } from 'react';
import { PerspectiveCamera, Vector3 } from 'three';
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
/** The body's extent to keep in view: 1.75 m tall, and about a metre across the open arms. */
const BODY_HEIGHT = 1.9;
const BODY_WIDTH = 1.05;
export const HOME_POSITION: [number, number, number] = [0, 1.05, 3];

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
 * How far back the camera has to stand for the whole body to fit the
 * viewport — both its height and, in a narrow panel, its width. A fixed
 * distance filled the height and cut the hands off at the edges the moment
 * the column was narrower than the body was wide.
 */
function fitDistance(camera: PerspectiveCamera): number {
  const vertical = (camera.fov * Math.PI) / 180;
  const horizontal = 2 * Math.atan(Math.tan(vertical / 2) * camera.aspect);
  const forHeight = BODY_HEIGHT / 2 / Math.tan(vertical / 2);
  const forWidth = BODY_WIDTH / 2 / Math.tan(horizontal / 2);
  return Math.max(forHeight, forWidth) * 1.04;
}

/**
 * Orbit, zoom and touch, with no panning: the body should never drift out of
 * the frame, and a reset button that also has to undo a pan is a reset
 * button people need more often.
 */
export function BodyCameraControls({ request }: { request: ViewRequest | null }) {
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  const invalidate = useThree((state) => state.invalidate);
  // Once the practitioner has orbited or zoomed, a resize no longer moves
  // the camera under them; a preset or reset takes over again.
  const touched = useRef(false);

  const place = (direction: Vector3 | null) => {
    if (!(camera instanceof PerspectiveCamera)) return;
    const distance = fitDistance(camera);
    if (direction) {
      camera.position.copy(TARGET).addScaledVector(direction.clone().normalize(), distance);
    } else {
      camera.position.set(0, 1.05, distance);
    }
    const current = controls.current;
    if (current) {
      current.target.copy(TARGET);
      current.update();
    } else {
      camera.lookAt(TARGET);
    }
    invalidate();
  };

  // Fit on mount and whenever the panel changes shape.
  useEffect(() => {
    if (touched.current) return;
    place(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.width, size.height, camera]);

  useEffect(() => {
    if (!request) return;
    touched.current = false;
    place(request.view === 'reset' ? null : STAND[request.view]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request]);

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      target={TARGET}
      enablePan={false}
      enableDamping={false}
      minDistance={0.5}
      maxDistance={8}
      onStart={() => {
        touched.current = true;
      }}
      // Just short of straight up and straight down, where orbit controls
      // lose their bearings.
      minPolarAngle={0.05}
      maxPolarAngle={Math.PI - 0.05}
    />
  );
}
