import { describe, expect, it } from 'vitest';
import { BODY_POINT_POSITIONS, findBodyPoint, positionFor } from './points';

describe('the point coordinate layer', () => {
  it('stores bilateral points on the right and midline points on the midline', () => {
    for (const entry of BODY_POINT_POSITIONS) {
      if (entry.sideType === 'bilateral') {
        expect(entry.position.x, `${entry.code} must be stored on the right (x < 0)`).toBeLessThan(0);
      } else {
        expect(entry.position.x, `${entry.code} must sit on the midline`).toBe(0);
      }
    }
  });

  it('keeps every coordinate inside a 1.75 m body', () => {
    for (const entry of BODY_POINT_POSITIONS) {
      expect(entry.position.y).toBeGreaterThanOrEqual(0);
      expect(entry.position.y).toBeLessThanOrEqual(1.75);
    }
  });

  it('has no duplicate codes', () => {
    const codes = BODY_POINT_POSITIONS.map((entry) => entry.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('is honest about validation', () => {
    // When the first point is validated, this test should change — not be deleted.
    expect(BODY_POINT_POSITIONS.every((entry) => entry.validated === false)).toBe(true);
    expect(findBodyPoint('ST36')?.validated).toBe(false);
  });
});

describe('positionFor', () => {
  it('mirrors a bilateral point across the midline for the left side', () => {
    const right = positionFor('ST36', 'right');
    const left = positionFor('ST36', 'left');
    expect(right).not.toBeNull();
    expect(left?.position).toEqual({ ...right!.position, x: -right!.position.x });
    expect(left?.approach?.x).toBeCloseTo(-right!.approach!.x);
    expect(left?.approach?.z).toBeCloseTo(right!.approach!.z);
  });

  it('answers a midline point the same whatever side is asked for', () => {
    expect(positionFor('DU20', 'left')).toEqual(positionFor('DU20', 'midline'));
  });

  it('returns null for a point with no coordinate rather than inventing one', () => {
    expect(positionFor('BL60', 'right')).toBeNull();
  });
});
