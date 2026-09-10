import { describe, expect, it } from 'vitest';
import type { MappedPoint } from '@/features/reference/body-map';
import { buildPointInstances } from './instances';

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

describe('buildPointInstances', () => {
  it('puts a right-sided point on the right and a left-sided one on the left', () => {
    const { instances } = buildPointInstances([
      mapped({ code: 'ST36', region: 'right' }),
      mapped({ code: 'SP6', region: 'left' }),
    ]);
    expect(instances.map((i) => i.key)).toEqual(['ST36_R', 'SP6_L']);
    expect(instances[0].position.x).toBeLessThan(0);
    expect(instances[1].position.x).toBeGreaterThan(0);
  });

  it('shows both sides for a paired point recorded without a side', () => {
    const { instances } = buildPointInstances([mapped({ code: 'LI4', region: 'center' })]);
    expect(instances.map((i) => i.key).sort()).toEqual(['LI4_L', 'LI4_R']);
  });

  it('draws a midline point once, whatever side the note says', () => {
    const { instances } = buildPointInstances([
      mapped({ code: 'REN4', region: 'right', bilateral: false }),
    ]);
    expect(instances).toHaveLength(1);
    expect(instances[0].key).toBe('REN4');
    expect(instances[0].side).toBe('midline');
  });

  it('merges the same point prescribed twice on one side into one marker', () => {
    const { instances } = buildPointInstances([
      mapped({ code: 'ST36', region: 'right', key: 'a' }),
      mapped({ code: 'ST36', region: 'right', key: 'b' }),
    ]);
    expect(instances).toHaveLength(1);
  });

  it('reports points that have no coordinate instead of inventing one', () => {
    const { instances, missingCodes } = buildPointInstances([
      mapped({ code: 'BL60', region: 'right' }),
      mapped({ code: 'BL60', region: 'left' }),
      mapped({ code: 'ST36', region: 'right' }),
    ]);
    expect(instances.map((i) => i.key)).toEqual(['ST36_R']);
    expect(missingCodes).toEqual(['BL60']);
  });

  it('carries the label and catalogue id through for the tooltip and the link', () => {
    const { instances } = buildPointInstances([
      mapped({ code: 'DU20', region: 'center', label: 'Bai Hui', pointId: 'uuid-1' }),
    ]);
    expect(instances[0]).toMatchObject({ label: 'Bai Hui', pointId: 'uuid-1', validated: false });
  });
});
