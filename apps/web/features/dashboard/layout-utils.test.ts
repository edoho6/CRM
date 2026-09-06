import { describe, expect, it } from 'vitest';
import type { DashboardLayout } from '@clinic/domain/widgets';
import {
  SIZE_CLASSES,
  createInstanceId,
  isWidgetSize,
  layoutsEqual,
  nextSize,
  parseStoredLayout,
} from './layout-utils';

/**
 * The layout model is an ordered list with a size per widget. The part most
 * likely to bite silently is the upgrade path: dashboards saved by the previous
 * coordinate-based grid must come back in the same visual order, or a user
 * loses the arrangement they built without any error to tell them why.
 */
describe('parseStoredLayout', () => {
  it('returns an empty layout for anything that is not an array', () => {
    expect(parseStoredLayout(null)).toEqual([]);
    expect(parseStoredLayout({ nope: true })).toEqual([]);
    expect(parseStoredLayout('[]')).toEqual([]);
  });

  it('accepts the current shape unchanged and in order', () => {
    const stored = [
      { id: 'a', type: 'note', size: 'md', config: { html: '<p>hi</p>' } },
      { id: 'b', type: 'low-stock', size: 'sm' },
    ];
    expect(parseStoredLayout(stored)).toEqual(stored);
  });

  it('drops entries missing an id or type rather than rendering a broken widget', () => {
    const parsed = parseStoredLayout([
      { id: 'a', type: 'note', size: 'md' },
      { id: 'b' },
      { type: 'low-stock' },
      null,
      'junk',
    ]);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]!.id).toBe('a');
  });

  it('defaults an unknown size to md', () => {
    expect(parseStoredLayout([{ id: 'a', type: 'note', size: 'huge' }])[0]!.size).toBe('md');
    expect(parseStoredLayout([{ id: 'a', type: 'note' }])[0]!.size).toBe('md');
  });

  it('ignores a duplicated id so one widget cannot render twice', () => {
    const parsed = parseStoredLayout([
      { id: 'a', type: 'note', size: 'md' },
      { id: 'a', type: 'note', size: 'lg' },
    ]);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]!.size).toBe('md');
  });

  describe('upgrading a layout saved by the old pixel grid', () => {
    const legacy = [
      // Deliberately out of visual order: the grid stored them as they were added.
      { id: 'low', type: 'low-stock', x: 6, y: 2, w: 6, h: 4 },
      { id: 'today', type: 'today-appointments', x: 0, y: 0, w: 6, h: 4 },
      { id: 'quick', type: 'quick-actions', x: 9, y: 0, w: 3, h: 2 },
      { id: 'stats', type: 'patient-stats', x: 6, y: 0, w: 3, h: 2 },
      { id: 'upcoming', type: 'upcoming-appointments', x: 0, y: 4, w: 6, h: 4 },
    ];

    it('orders by row, then column, so the arrangement survives', () => {
      expect(parseStoredLayout(legacy).map((item) => item.id)).toEqual([
        'today',
        'stats',
        'quick',
        'low',
        'upcoming',
      ]);
    });

    it('maps the old width onto the nearest size preset', () => {
      const bySize = Object.fromEntries(parseStoredLayout(legacy).map((item) => [item.id, item.size]));
      expect(bySize).toEqual({
        today: 'lg',
        stats: 'sm',
        quick: 'sm',
        low: 'lg',
        upcoming: 'lg',
      });
    });

    it('carries widget config across the upgrade', () => {
      const parsed = parseStoredLayout([{ id: 'n', type: 'note', x: 0, y: 0, w: 4, h: 3, config: { html: 'x' } }]);
      expect(parsed[0]).toEqual({ id: 'n', type: 'note', size: 'md', config: { html: 'x' } });
    });

    it('never leaks the old coordinates into the new model', () => {
      const parsed = parseStoredLayout(legacy);
      for (const item of parsed) {
        expect(item).not.toHaveProperty('x');
        expect(item).not.toHaveProperty('w');
      }
    });
  });
});

describe('nextSize', () => {
  it('cycles through all four sizes and wraps', () => {
    expect(nextSize('sm')).toBe('md');
    expect(nextSize('md')).toBe('lg');
    expect(nextSize('lg')).toBe('xl');
    expect(nextSize('xl')).toBe('sm');
  });

  it('respects the sizes a widget allows', () => {
    expect(nextSize('lg', ['lg', 'xl'])).toBe('xl');
    expect(nextSize('xl', ['lg', 'xl'])).toBe('lg');
  });

  it('steps into the allowed set when the current size is outside it', () => {
    expect(nextSize('sm', ['lg', 'xl'])).toBe('lg');
  });
});

describe('layoutsEqual', () => {
  const layout: DashboardLayout = [
    { id: 'a', type: 'note', size: 'md', config: { html: 'x' } },
    { id: 'b', type: 'low-stock', size: 'sm' },
  ];

  it('is true for an identical arrangement', () => {
    expect(layoutsEqual(layout, JSON.parse(JSON.stringify(layout)))).toBe(true);
  });

  it('is order-sensitive, because order is the position', () => {
    expect(layoutsEqual(layout, [layout[1]!, layout[0]!])).toBe(false);
  });

  it('notices a size change and a config change', () => {
    expect(layoutsEqual(layout, [{ ...layout[0]!, size: 'lg' }, layout[1]!])).toBe(false);
    expect(layoutsEqual(layout, [{ ...layout[0]!, config: { html: 'y' } }, layout[1]!])).toBe(false);
  });
});

describe('sizes', () => {
  it('recognises exactly the four presets', () => {
    expect(isWidgetSize('sm')).toBe(true);
    expect(isWidgetSize('xl')).toBe(true);
    expect(isWidgetSize('huge')).toBe(false);
    expect(isWidgetSize(3)).toBe(false);
  });

  it('has a full Tailwind class string for every size, so nothing is purged', () => {
    for (const size of ['sm', 'md', 'lg', 'xl'] as const) {
      expect(SIZE_CLASSES[size]).toMatch(/xl:col-span-\d+/);
    }
  });
});

describe('createInstanceId', () => {
  it('prefixes with the type and is unique across calls', () => {
    const a = createInstanceId('note');
    const b = createInstanceId('note');
    expect(a.startsWith('note-')).toBe(true);
    expect(a).not.toBe(b);
  });
});
