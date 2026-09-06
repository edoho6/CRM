import { describe, expect, it } from 'vitest';
import type { DashboardLayout } from '@clinic/domain/widgets';
import {
  DASHBOARD_COLS,
  fromGridLayout,
  layoutsEqual,
  nextAvailableY,
  parseStoredLayout,
  toGridLayout,
  toLogicalX,
  toPhysicalX,
} from './layout-utils';

/**
 * The mirroring maths is the part of the dashboard most likely to break silently:
 * a wrong sign puts every widget off-screen in one language only, which is exactly
 * the kind of bug that survives testing in the other language.
 */
describe('RTL coordinate mirroring', () => {
  it('leaves left-to-right coordinates untouched', () => {
    expect(toPhysicalX(3, 4, 'ltr')).toBe(3);
    expect(toLogicalX(3, 4, 'ltr')).toBe(3);
  });

  it('mirrors across the grid in right-to-left', () => {
    // A 4-wide widget at logical x=0 must render hard against the right edge.
    expect(toPhysicalX(0, 4, 'rtl')).toBe(DASHBOARD_COLS - 4);
    expect(toPhysicalX(DASHBOARD_COLS - 4, 4, 'rtl')).toBe(0);
  });

  it('round-trips in both directions', () => {
    for (const dir of ['ltr', 'rtl'] as const) {
      for (let x = 0; x <= 8; x += 1) {
        const width = 4;
        expect(toLogicalX(toPhysicalX(x, width, dir), width, dir)).toBe(x);
      }
    }
  });

  it('never produces a negative column', () => {
    expect(toPhysicalX(11, 6, 'rtl')).toBe(0);
  });
});

describe('grid layout conversion', () => {
  const layout: DashboardLayout = [
    { id: 'a', type: 'note', x: 0, y: 0, w: 4, h: 3 },
    { id: 'b', type: 'low-stock', x: 4, y: 0, w: 8, h: 3 },
  ];

  it('applies per-type size constraints', () => {
    const grid = toGridLayout(layout, 'ltr', { note: { minW: 2, minH: 2 } });
    expect(grid[0]).toMatchObject({ i: 'a', x: 0, minW: 2, minH: 2 });
    expect(grid[1]).toMatchObject({ i: 'b', x: 4 });
  });

  it('survives a full round trip through the grid in Hebrew', () => {
    const grid = toGridLayout(layout, 'rtl', {});
    const back = fromGridLayout(grid, layout, 'rtl');
    expect(layoutsEqual(back, layout)).toBe(true);
  });

  it('keeps widgets the grid did not report', () => {
    const back = fromGridLayout([{ i: 'a', x: 0, y: 0, w: 4, h: 3 }], layout, 'ltr');
    expect(back).toHaveLength(2);
    expect(back.map((item) => item.id).sort()).toEqual(['a', 'b']);
  });

  it('preserves widget config through a move', () => {
    const withConfig: DashboardLayout = [
      { id: 'a', type: 'note', x: 0, y: 0, w: 4, h: 3, config: { html: '<p>hi</p>' } },
    ];
    const back = fromGridLayout([{ i: 'a', x: 2, y: 1, w: 4, h: 3 }], withConfig, 'ltr');
    expect(back[0]!.config).toEqual({ html: '<p>hi</p>' });
    expect(back[0]!.x).toBe(2);
  });
});

describe('parseStoredLayout', () => {
  it('returns an empty layout for anything that is not an array', () => {
    expect(parseStoredLayout(null)).toEqual([]);
    expect(parseStoredLayout({ nope: true })).toEqual([]);
    expect(parseStoredLayout('[]')).toEqual([]);
  });

  it('drops entries missing an id or type rather than rendering a broken widget', () => {
    const parsed = parseStoredLayout([
      { id: 'a', type: 'note', x: 0, y: 0, w: 4, h: 3 },
      { id: 'b' },
      { type: 'low-stock' },
      null,
    ]);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]!.id).toBe('a');
  });

  it('repairs missing or invalid geometry with sane defaults', () => {
    const parsed = parseStoredLayout([{ id: 'a', type: 'note' }]);
    expect(parsed[0]).toMatchObject({ x: 0, y: 0, w: 4, h: 3 });
  });
});

describe('nextAvailableY', () => {
  it('returns 0 for an empty dashboard', () => {
    expect(nextAvailableY([])).toBe(0);
  });

  it('places a new widget below the lowest existing one', () => {
    expect(
      nextAvailableY([
        { id: 'a', type: 'note', x: 0, y: 0, w: 4, h: 3 },
        { id: 'b', type: 'note', x: 4, y: 2, w: 4, h: 5 },
      ]),
    ).toBe(7);
  });
});
