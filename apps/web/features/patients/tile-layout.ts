/**
 * The order and visibility of the status tiles above the patient list, as the
 * person using this browser arranged them.
 *
 * Pure, so it can be tested: the component reads and writes the browser's
 * storage and hands the result here.
 */
export interface TileLayout {
  /** Tile keys in the order to show them; a key not listed goes after these. */
  order: string[];
  hidden: string[];
}

export const EMPTY_TILE_LAYOUT: TileLayout = { order: [], hidden: [] };

/** Whatever was stored, made safe: unknown shapes become the default. */
export function parseTileLayout(raw: string | null): TileLayout {
  if (!raw) return EMPTY_TILE_LAYOUT;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return EMPTY_TILE_LAYOUT;
    const strings = (value: unknown) =>
      Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
    return {
      order: strings((parsed as { order?: unknown }).order),
      hidden: strings((parsed as { hidden?: unknown }).hidden),
    };
  } catch {
    return EMPTY_TILE_LAYOUT;
  }
}

/**
 * Items in the arranged order. Keys the layout never heard of — a status
 * added after the order was saved — keep their default order, after the
 * arranged ones, so nothing new is ever silently lost.
 */
export function arrangeTiles<T extends { key: string }>(items: T[], layout: TileLayout): T[] {
  const rank = new Map(layout.order.map((key, index) => [key, index]));
  return [...items].sort((a, b) => {
    const left = rank.get(a.key);
    const right = rank.get(b.key);
    if (left === undefined && right === undefined) return 0;
    if (left === undefined) return 1;
    if (right === undefined) return -1;
    return left - right;
  });
}

/** The layout with one tile moved a step earlier (negative) or later. */
export function moveTile<T extends { key: string }>(
  items: T[],
  layout: TileLayout,
  key: string,
  step: -1 | 1,
): TileLayout {
  const keys = arrangeTiles(items, layout).map((item) => item.key);
  const from = keys.indexOf(key);
  const to = from + step;
  if (from === -1 || to < 0 || to >= keys.length) return layout;
  keys.splice(from, 1);
  keys.splice(to, 0, key);
  return { ...layout, order: keys };
}

export function toggleTileHidden(layout: TileLayout, key: string): TileLayout {
  return {
    ...layout,
    hidden: layout.hidden.includes(key)
      ? layout.hidden.filter((entry) => entry !== key)
      : [...layout.hidden, key],
  };
}
