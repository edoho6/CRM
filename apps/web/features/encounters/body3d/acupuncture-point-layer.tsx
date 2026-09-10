'use client';

import { useEffect, useMemo } from 'react';
import { Raycaster, type Mesh } from 'three';
import { useThree } from '@react-three/fiber';
import type { PointInstance } from './instances';
import { snapToSurface } from './snap';
import { AcupuncturePointMarker } from './acupuncture-point-marker';
import { PointTooltip } from './point-tooltip';

/**
 * Every selected point, snapped onto the body, plus the tooltip of the one
 * that is hovered or focused.
 *
 * Snapping is recomputed only when the selection or the model changes; an
 * orbit of the camera does not move a marker.
 */
export function AcupuncturePointLayer({
  instances,
  meshes,
  activeKey,
  onActiveChange,
  onSelect,
  color,
  activeColor,
}: {
  instances: PointInstance[];
  meshes: Mesh[];
  activeKey: string | null;
  onActiveChange: (key: string | null) => void;
  onSelect: (instance: PointInstance) => void;
  color: string;
  activeColor: string;
}) {
  const invalidate = useThree((state) => state.invalidate);

  const placed = useMemo(() => {
    const raycaster = new Raycaster();
    return instances.map((instance) => ({
      instance,
      ...snapToSurface(instance.position, instance.approach, meshes, raycaster),
    }));
  }, [instances, meshes]);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;
    for (const entry of placed) {
      if (!entry.snapped) {
        console.warn(
          `[body3d] ${entry.instance.key} found no skin near its coordinate; drawn at the raw position. Check it in the point editor.`,
        );
      }
    }
  }, [placed]);

  // On-demand rendering: a new selection or a new active marker is a reason
  // to draw a frame, and nothing else will ask for one.
  useEffect(() => {
    invalidate();
  }, [placed, activeKey, invalidate]);

  const active = activeKey ? placed.find((entry) => entry.instance.key === activeKey) : undefined;

  return (
    <>
      {placed.map((entry) => (
        <AcupuncturePointMarker
          key={entry.instance.key}
          instance={entry.instance}
          position={entry.position}
          active={entry.instance.key === activeKey}
          color={color}
          activeColor={activeColor}
          onHover={onActiveChange}
          onSelect={onSelect}
        />
      ))}
      {active ? (
        <PointTooltip position={active.position} code={active.instance.code} label={active.instance.label} />
      ) : null}
    </>
  );
}
