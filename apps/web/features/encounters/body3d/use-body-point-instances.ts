'use client';

import { useEffect, useMemo } from 'react';
import type { MappedPoint } from '@/features/reference/body-map';
import { buildPointInstances, type PointInstancesResult } from './instances';

/** Warned once per code per page load, so a long treatment does not spam the console. */
const warnedCodes = new Set<string>();

/**
 * The markers for the selected points, recomputed only when the selection
 * changes. In development a point with no coordinate is named once in the
 * console, because silently drawing nothing is how a missing entry would
 * otherwise go unnoticed for months.
 */
export function useBodyPointInstances(points: MappedPoint[]): PointInstancesResult {
  const result = useMemo(() => buildPointInstances(points), [points]);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;
    for (const code of result.missingCodes) {
      if (warnedCodes.has(code)) continue;
      warnedCodes.add(code);
      console.warn(
        `[body3d] ${code} was selected but has no 3D coordinate in body3d/points.ts — it is listed, not drawn.`,
      );
    }
  }, [result.missingCodes]);

  return result;
}
