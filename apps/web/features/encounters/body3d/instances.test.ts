import { describe, expect, it } from 'vitest';
import type { MappedPoint } from '@/features/reference/body-map';
import { buildPointInstances } from './instances';
import { toBodyPointMap, type BodyPointRow } from './points';

function mapped(overrides: Partial<MappedPoint> & { code: string; region: string }): MappedPoint {
  return {
    key: `${overrides.code}:${overrides.region}`,
    pointId: `id-${overrides.code}`,
    label: overrides.code,
    view: 'front',
    x: 0,
    y: 0,
    bilateral: true,
    ...overrides,
  };
}

function row(code: string, side_type: BodyPointRow['side_type'], x: number, y: number, z: number): BodyPointRow {
  return { code, side_type, x, y, z, approach_x: null, approach_y: null, approach_z: null, validated: false, note: null };
}

/** The demonstration set the migration seeds, as the page would receive it. */
const positions = toBodyPointMap([
  row('DU20', 'midline', 0, 1.75, 0),
  row('REN4', 'midline', 0, 0.97, 0.1),
  row('LI4', 'bilateral', -0.45, 0.82, 0.08),
  row('ST36', 'bilateral', -0.18, 0.42, -0.03),
  row('SP6', 'bilateral', -0.145, 0.17, -0.09),
]);

describe('buildPointInstances', () => {
  it('puts a right-sided point on the right and a left-sided one on the left', () => {
    const { instances } = buildPointInstances(
      [mapped({ code: 'ST36', region: 'right' }), mapped({ code: 'SP6', region: 'left' })],
      positions,
    );
    expect(instances.map((i) => i.key)).toEqual(['ST36_R', 'SP6_L']);
    expect(instances[0].position.x).toBeLessThan(0);
    expect(instances[1].position.x).toBeGreaterThan(0);
  });

  it('shows both sides for a paired point recorded without a side', () => {
    const { instances } = buildPointInstances([mapped({ code: 'LI4', region: 'center' })], positions);
    expect(instances.map((i) => i.key).sort()).toEqual(['LI4_L', 'LI4_R']);
  });

  it('draws a midline point once, whatever side the note says', () => {
    const { instances } = buildPointInstances(
      [mapped({ code: 'REN4', region: 'right', bilateral: false })],
      positions,
    );
    expect(instances).toHaveLength(1);
    expect(instances[0].key).toBe('REN4');
    expect(instances[0].side).toBe('midline');
  });

  it('merges the same point prescribed twice on one side into one marker', () => {
    const { instances } = buildPointInstances(
      [mapped({ code: 'ST36', region: 'right', key: 'a' }), mapped({ code: 'ST36', region: 'right', key: 'b' })],
      positions,
    );
    expect(instances).toHaveLength(1);
  });

  it('reports points that have no coordinate instead of inventing one', () => {
    const { instances, missingCodes } = buildPointInstances(
      [
        mapped({ code: 'BL60', region: 'right' }),
        mapped({ code: 'BL60', region: 'left' }),
        mapped({ code: 'ST36', region: 'right' }),
      ],
      positions,
    );
    expect(instances.map((i) => i.key)).toEqual(['ST36_R']);
    expect(missingCodes).toEqual(['BL60']);
  });

  it('draws nothing and lists everything when the table is empty', () => {
    const { instances, missingCodes } = buildPointInstances(
      [mapped({ code: 'ST36', region: 'right' })],
      toBodyPointMap([]),
    );
    expect(instances).toHaveLength(0);
    expect(missingCodes).toEqual(['ST36']);
  });

  it('carries the label and catalogue id through for the tooltip and the link', () => {
    const { instances } = buildPointInstances(
      [mapped({ code: 'DU20', region: 'center', label: 'Bai Hui', pointId: 'uuid-1' })],
      positions,
    );
    expect(instances[0]).toMatchObject({ label: 'Bai Hui', pointId: 'uuid-1', validated: false });
  });
});
