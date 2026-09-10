import { describe, expect, it } from 'vitest';
import { applyNormalisation, computeNormalisation, NORMALISED_HEIGHT_M } from './frame';

describe('computeNormalisation', () => {
  it('scales the model to the standard height and puts the feet at the origin', () => {
    // A 180 cm model standing off-centre, exported in centimetres.
    const box = { min: { x: 10, y: 0, z: -20 }, max: { x: 50, y: 180, z: 20 } };
    const n = computeNormalisation(box);
    const top = applyNormalisation({ x: 30, y: 180, z: 0 }, n);
    const feet = applyNormalisation({ x: 30, y: 0, z: 0 }, n);
    expect(top.y).toBeCloseTo(NORMALISED_HEIGHT_M);
    expect(feet).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('keeps proportions: the same factor on every axis', () => {
    const n = computeNormalisation({ min: { x: -1, y: 0, z: -1 }, max: { x: 1, y: 3.5, z: 1 } });
    expect(n.scale).toBeCloseTo(0.5);
    expect(applyNormalisation({ x: 1, y: 0, z: 0 }, n).x).toBeCloseTo(0.5);
  });

  it('does not divide by zero on a flat box', () => {
    const n = computeNormalisation({ min: { x: 0, y: 1, z: 0 }, max: { x: 0, y: 1, z: 0 } });
    expect(n.scale).toBe(1);
    expect(n.offset.y).toBe(-1);
  });
});
