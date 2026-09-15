import { describe, expect, it } from 'vitest';
import { findBodyPoint, positionFor, toBodyPointMap, toBodyPointPosition, type BodyPointRow } from './points';

function row(overrides: Partial<BodyPointRow> & { code: string }): BodyPointRow {
  return {
    side_type: 'bilateral',
    x: -0.18,
    y: 0.42,
    z: -0.03,
    approach_x: -0.6,
    approach_y: 0,
    approach_z: 0.8,
    validated: false,
    note: null,
    ...overrides,
  };
}

describe('folding body_points rows', () => {
  it('reads numerics whether they arrive as numbers or as strings', () => {
    const entry = toBodyPointPosition(row({ code: 'ST36', x: '-0.18', y: '0.42', z: '-0.03', approach_x: '-0.6' }));
    expect(entry?.position).toEqual({ x: -0.18, y: 0.42, z: -0.03 });
    expect(entry?.approach).toEqual({ x: -0.6, y: 0, z: 0.8 });
  });

  it('upper-cases the code, so a row written as st36 still matches the catalogue', () => {
    const map = toBodyPointMap([row({ code: 'st36' })]);
    expect(findBodyPoint(map, 'ST36')?.code).toBe('ST36');
    expect(findBodyPoint(map, 'st36')?.code).toBe('ST36');
  });

  it('leaves out the approach when any of its three numbers is missing', () => {
    const entry = toBodyPointPosition(row({ code: 'ST36', approach_y: null }));
    expect(entry?.approach).toBeUndefined();
  });

  it('pins a midline point to x = 0 whatever the row says', () => {
    const entry = toBodyPointPosition(row({ code: 'DU20', side_type: 'midline', x: 0.02, y: 1.75, z: 0 }));
    expect(entry?.position.x).toBe(0);
    expect(entry?.sideType).toBe('midline');
  });

  it('skips a row whose coordinate is not a number rather than inventing one', () => {
    const map = toBodyPointMap([row({ code: 'BL60', y: 'nope' }), row({ code: 'ST36' })]);
    expect(map.size).toBe(1);
    expect(findBodyPoint(map, 'BL60')).toBeUndefined();
  });

  it('shares one empty map for no rows, so a page without coordinates costs nothing', () => {
    expect(toBodyPointMap([])).toBe(toBodyPointMap(null));
    expect(toBodyPointMap(undefined).size).toBe(0);
  });
});

describe('positionFor', () => {
  const st36 = toBodyPointPosition(row({ code: 'ST36' }))!;
  const du20 = toBodyPointPosition(row({ code: 'DU20', side_type: 'midline', x: 0, y: 1.75, z: 0, approach_x: 0, approach_y: 1, approach_z: 0 }))!;

  it('mirrors a bilateral point across the midline for the left side', () => {
    const right = positionFor(st36, 'right');
    const left = positionFor(st36, 'left');
    expect(left.position).toEqual({ ...right.position, x: -right.position.x });
    expect(left.approach?.x).toBeCloseTo(-right.approach!.x);
    expect(left.approach?.z).toBeCloseTo(right.approach!.z);
  });

  it('answers a midline point the same whatever side is asked for', () => {
    expect(positionFor(du20, 'left')).toEqual(positionFor(du20, 'midline'));
  });

  it('carries the validation flag through, so an unchecked number is drawn as one', () => {
    expect(positionFor(st36, 'right').validated).toBe(false);
    expect(positionFor({ ...st36, validated: true }, 'left').validated).toBe(true);
  });
});
