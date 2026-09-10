import { describe, expect, it } from 'vitest';
import {
  EMPTY_TILE_LAYOUT,
  arrangeTiles,
  moveTile,
  parseTileLayout,
  toggleTileHidden,
} from './tile-layout';

const items = [{ key: 'a' }, { key: 'b' }, { key: 'c' }, { key: 'd' }];

describe('tile layout', () => {
  it('keeps the default order with nothing saved', () => {
    expect(arrangeTiles(items, EMPTY_TILE_LAYOUT).map((i) => i.key)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('puts arranged tiles first and unknown ones after, in their own order', () => {
    const layout = { order: ['c', 'a'], hidden: [] };
    expect(arrangeTiles(items, layout).map((i) => i.key)).toEqual(['c', 'a', 'b', 'd']);
  });

  it('moves a tile one step and stops at the edges', () => {
    let layout = moveTile(items, EMPTY_TILE_LAYOUT, 'c', -1);
    expect(arrangeTiles(items, layout).map((i) => i.key)).toEqual(['a', 'c', 'b', 'd']);
    layout = moveTile(items, layout, 'a', -1);
    expect(arrangeTiles(items, layout).map((i) => i.key)).toEqual(['a', 'c', 'b', 'd']);
    layout = moveTile(items, layout, 'd', 1);
    expect(arrangeTiles(items, layout).map((i) => i.key)).toEqual(['a', 'c', 'b', 'd']);
  });

  it('hides and shows again', () => {
    const hidden = toggleTileHidden(EMPTY_TILE_LAYOUT, 'b');
    expect(hidden.hidden).toEqual(['b']);
    expect(toggleTileHidden(hidden, 'b').hidden).toEqual([]);
  });

  it('survives whatever was in storage', () => {
    expect(parseTileLayout(null)).toEqual(EMPTY_TILE_LAYOUT);
    expect(parseTileLayout('not json')).toEqual(EMPTY_TILE_LAYOUT);
    expect(parseTileLayout('{"order": ["a", 3, null], "hidden": "x"}')).toEqual({
      order: ['a'],
      hidden: [],
    });
  });
});
