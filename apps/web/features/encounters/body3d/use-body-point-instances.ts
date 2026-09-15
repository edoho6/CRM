'use client';

import { useEffect, useMemo } from 'react';
import type { MappedPoint } from '@/features/reference/body-map';
import { buildPointInstances, type PointInstancesResult } from './instances';
import type { BodyPointMap } from './points';

/** Warned once per code per page load, so a long treatment does not spam the console. */
const warnedCodes = new Set<string>();

/**
 * The markers for the selected points, recomputed only when the selection
 * or the coordinates change. In development a point with no coordinate is
 * named once in the console, because silently drawing nothing is how a
 * missing entry would otherwise go unnoticed for months.
 */
export function useBodyPointInstances(points: MappedPoint[], positions: BodyPointMap): PointInstancesResult {
  const result = useMemo(() => buildPointInstances(points, positions), [points, positions]);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;
    for (const code of result.missingCodes) {
      if (warnedCodes.has(code)) continue;
      warnedCodes.add(code);
      console.warn(
        `[body3d] ${code} was selected but has no row in body_points — it is listed, not drawn. Place it with the placement tool.`,
      );
    }
  }, [result.missingCodes]);

  return result;
}
