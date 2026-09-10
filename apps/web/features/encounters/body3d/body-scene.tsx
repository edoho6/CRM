'use client';

import { Suspense, useCallback, useState } from 'react';
import type { Mesh } from 'three';
import { Canvas } from '@react-three/fiber';
import type { PointInstance } from './instances';
import type { SceneColors } from './use-theme-colors';
import type { Vec3 } from './frame';
import { BodyModel, type PickEvent } from './body-model';
import { BodyCameraControls, HOME_POSITION, type ViewRequest } from './body-camera-controls';
import { AcupuncturePointLayer } from './acupuncture-point-layer';

export interface EditorBridge {
  onPick: (event: PickEvent) => void;
  /** The coordinate being tried out, drawn as a distinct marker. */
  preview: Vec3 | null;
}

export interface BodySceneProps {
  instances: PointInstance[];
  activeKey: string | null;
  onActiveChange: (key: string | null) => void;
  onSelect: (instance: PointInstance) => void;
  viewRequest: ViewRequest | null;
  colors: SceneColors;
  /** The model is placed and the markers can be drawn. */
  onReady: () => void;
  editor?: EditorBridge | null;
}

/**
 * The WebGL scene. This is the only module the panel loads lazily: three.js
 * and the renderer arrive with it, and only when the 3D view is actually
 * shown.
 *
 * Frames are drawn on demand — after an orbit, a hover, a theme change — and
 * not continuously, because a treatment page is open for an hour and a
 * canvas spinning at 60 fps the whole time drains a laptop for nothing.
 */
export default function BodyScene({
  instances,
  activeKey,
  onActiveChange,
  onSelect,
  viewRequest,
  colors,
  onReady,
  editor,
}: BodySceneProps) {
  const [meshes, setMeshes] = useState<Mesh[] | null>(null);

  const handleReady = useCallback(
    (placed: Mesh[]) => {
      setMeshes(placed);
      onReady();
    },
    [onReady],
  );

  return (
    <Canvas
      frameloop="demand"
      dpr={[1, 2]}
      camera={{ position: HOME_POSITION, fov: 35, near: 0.05, far: 20 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
      style={{ touchAction: 'none' }}
    >
      <hemisphereLight args={['#ffffff', '#8a9099', 0.9]} />
      <directionalLight position={[2, 4, 3]} intensity={1.1} />
      <directionalLight position={[-3, 2, -2]} intensity={0.45} />

      <Suspense fallback={null}>
        <BodyModel color={colors.body} onReady={handleReady} onPick={editor?.onPick} />
      </Suspense>

      {meshes ? (
        <AcupuncturePointLayer
          instances={instances}
          meshes={meshes}
          activeKey={activeKey}
          onActiveChange={onActiveChange}
          onSelect={onSelect}
          color={colors.marker}
          activeColor={colors.markerActive}
        />
      ) : null}

      {editor?.preview ? (
        <mesh position={[editor.preview.x, editor.preview.y, editor.preview.z]} renderOrder={2}>
          <sphereGeometry args={[0.016, 20, 16]} />
          <meshStandardMaterial color={colors.editor} emissive={colors.editor} emissiveIntensity={0.5} depthTest={false} />
        </mesh>
      ) : null}

      <BodyCameraControls request={viewRequest} />
    </Canvas>
  );
}
