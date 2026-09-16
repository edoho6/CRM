import { describe, expect, it } from 'vitest';
import type { RecordedPoint } from '@clinic/db/types';
import { compareHerbs, comparePoints, placementOf, pointKey } from './encounter-diff';

function point(code: string, extra: Partial<RecordedPoint> = {}): RecordedPoint {
  return { point: code, technique: 'even', ...extra } as RecordedPoint;
}

const herb = (key: string, quantity: number | null, name = key) => ({ key, name, quantity });

describe('placementOf', () => {
  it('takes the region when the note has one', () => {
    expect(placementOf(point('LI4', { region: 'left' }))).toBe('left');
    expect(placementOf(point('REN12', { region: 'center' }))).toBe('center');
  });

  it('falls back to the old side column for notes written before regions', () => {
    expect(placementOf(point('LI4', { side: 'left' }))).toBe('left');
    expect(placementOf(point('REN12', { side: 'midline' }))).toBe('center');
    expect(placementOf(point('LI4', { side: 'right' }))).toBe('right');
  });

  it('assumes the right side when a note says nothing at all', () => {
    expect(placementOf(point('LI4'))).toBe('right');
  });
});

describe('pointKey', () => {
  it('ignores case and stray spaces, which are typing and not identity', () => {
    expect(pointKey(' li4 ', 'right')).toBe(pointKey('LI4', 'right'));
  });

  it('keeps the side, because the same point on the other side is another needle', () => {
    expect(pointKey('LI4', 'left')).not.toBe(pointKey('LI4', 'right'));
  });
});

describe('comparePoints', () => {
  it('marks what stayed, what went and what is new', () => {
    const { before, now } = comparePoints(
      [point('LI4', { region: 'right' }), point('ST36', { region: 'right' })],
      [
        { point: 'LI4', region: 'right' },
        { point: 'SP6', region: 'right' },
      ],
    );
    expect(before.map((cell) => [cell.code, cell.status])).toEqual([
      ['LI4', 'kept'],
      ['ST36', 'dropped'],
    ]);
    expect(now.map((cell) => [cell.code, cell.status])).toEqual([
      ['LI4', 'kept'],
      ['SP6', 'added'],
    ]);
  });

  it('gives a matched point the same pair number on both sides', () => {
    const { before, now } = comparePoints(
      [point('LI4', { region: 'right' }), point('ST36', { region: 'right' })],
      [
        { point: 'ST36', region: 'right' },
        { point: 'LI4', region: 'right' },
      ],
    );
    const pairOf = (cells: { code: string; pair?: number }[], code: string) =>
      cells.find((cell) => cell.code === code)?.pair;
    expect(pairOf(before, 'LI4')).toBe(pairOf(now, 'LI4'));
    expect(pairOf(before, 'ST36')).toBe(pairOf(now, 'ST36'));
    expect(pairOf(before, 'LI4')).not.toBe(pairOf(before, 'ST36'));
  });

  it('treats the same point on the other side as a change, not as kept', () => {
    const { before, now } = comparePoints(
      [point('LI4', { region: 'right' })],
      [{ point: 'LI4', region: 'left' }],
    );
    expect(before[0]!.status).toBe('dropped');
    expect(now[0]!.status).toBe('added');
  });

  it('counts a point recorded twice in one visit once', () => {
    const { now } = comparePoints(
      [],
      [
        { point: 'LI4', region: 'right' },
        { point: 'LI4', region: 'right' },
      ],
    );
    expect(now).toHaveLength(1);
  });

  it('reads a first visit as everything added', () => {
    const { before, now } = comparePoints([], [{ point: 'LI4', region: 'right' }]);
    expect(before).toEqual([]);
    expect(now.map((cell) => cell.status)).toEqual(['added']);
  });
});

describe('compareHerbs', () => {
  it('marks a dose that moved, and carries the earlier figure', () => {
    const { before, now } = compareHerbs([herb('huang-qi', 9)], [herb('huang-qi', 6)]);
    expect(before[0]!.status).toBe('kept');
    expect(now[0]!.status).toBe('changed');
    expect(now[0]!.was).toBe(9);
  });

  it('leaves an unchanged dose alone', () => {
    const { now } = compareHerbs([herb('huang-qi', 9)], [herb('huang-qi', 9)]);
    expect(now[0]!.status).toBe('kept');
    expect(now[0]!.was).toBeUndefined();
  });

  it('does not call a rounding difference a dose change', () => {
    const { now } = compareHerbs([herb('huang-qi', 9)], [herb('huang-qi', 9.0005)]);
    expect(now[0]!.status).toBe('kept');
  });

  it('marks herbs added and dropped', () => {
    const { before, now } = compareHerbs(
      [herb('huang-qi', 9), herb('dang-gui', 6)],
      [herb('huang-qi', 9), herb('bai-shao', 6)],
    );
    expect(before.map((cell) => [cell.key, cell.status])).toEqual([
      ['huang-qi', 'kept'],
      ['dang-gui', 'dropped'],
    ]);
    expect(now.map((cell) => [cell.key, cell.status])).toEqual([
      ['huang-qi', 'kept'],
      ['bai-shao', 'added'],
    ]);
  });

  it('does not compare doses when one side has none', () => {
    const { now } = compareHerbs([herb('huang-qi', null)], [herb('huang-qi', 9)]);
    expect(now[0]!.status).toBe('kept');
    expect(now[0]!.was).toBeUndefined();
  });

  it('keeps the first of two lines for the same herb', () => {
    const { now } = compareHerbs([], [herb('huang-qi', 9), herb('huang-qi', 3)]);
    expect(now).toHaveLength(1);
    expect(now[0]!.quantity).toBe(9);
  });

  it('reads an empty current prescription as everything dropped', () => {
    const { before, now } = compareHerbs([herb('huang-qi', 9)], []);
    expect(before.map((cell) => cell.status)).toEqual(['dropped']);
    expect(now).toEqual([]);
  });
});
