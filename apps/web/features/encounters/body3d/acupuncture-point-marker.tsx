'use client';

import { useState } from 'react';
import type { Vector3 } from 'three';
import { useCursor } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import type { PointInstance } from './instances';

/** Marker radius in metres: about the size of a fingertip on a 1.75 m body. */
const RADIUS = 0.014;

/**
 * One point on the skin.
 *
 * The active marker draws on top of everything, body included: when a chip
 * in the list is focused and its point is on the far side, the practitioner
 * still sees where it is instead of a blank torso.
 */
export function AcupuncturePointMarker({
  instance,
  position,
  active,
  color,
  activeColor,
  onHover,
  onSelect,
}: {
  instance: PointInstance;
  position: Vector3;
  active: boolean;
  color: string;
  activeColor: string;
  onHover: (key: string | null) => void;
  onSelect: (instance: PointInstance) => void;
}) {
  const [hovered, setHovered] = useState(false);
  useCursor(hovered);

  const over = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    setHovered(true);
    onHover(instance.key);
  };
  const out = () => {
    setHovered(false);
    onHover(null);
  };
  const click = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    onSelect(instance);
  };

  return (
    <mesh
      position={position}
      scale={active ? 1.4 : 1}
      renderOrder={active ? 1 : 0}
      onPointerOver={over}
      onPointerOut={out}
      onClick={click}
    >
      <sphereGeometry args={[RADIUS, 20, 16]} />
      <meshStandardMaterial
        color={active ? activeColor : color}
        emissive={color}
        emissiveIntensity={active ? 0.55 : 0.2}
        roughness={0.45}
        metalness={0}
        depthTest={!active}
      />
    </mesh>
  );
}
