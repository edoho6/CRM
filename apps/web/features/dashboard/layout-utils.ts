import {
  WIDGET_SIZES,
  type DashboardLayout,
  type DashboardWidgetInstance,
  type WidgetSize,
} from '@clinic/domain/widgets';

/**
 * Dashboard layout helpers.
 *
 * The layout is an ordered list; the browser's CSS grid places it. That removes
 * the two things that made the previous pixel-grid fragile: coordinates that had
 * to be mirrored for Hebrew, and a compaction step that could disagree with them.
 */

/** Column span per size on the 12-column desktop grid. */
export const SIZE_COLUMNS: Record<WidgetSize, number> = { sm: 3, md: 4, lg: 6, xl: 12 };

/**
 * Tailwind needs complete class names in source to emit them, so the span
 * classes are spelled out per size rather than built from a number.
 */
export const SIZE_CLASSES: Record<WidgetSize, string> = {
  sm: 'md:col-span-3 xl:col-span-3',
  md: 'md:col-span-3 xl:col-span-4',
  lg: 'md:col-span-6 xl:col-span-6',
  xl: 'md:col-span-6 xl:col-span-12',
};

/** Minimum heights so a row of mixed widgets reads as one row, not a staircase. */
export const SIZE_MIN_HEIGHT: Record<WidgetSize, string> = {
  sm: 'min-h-56',
  md: 'min-h-56',
  lg: 'min-h-72',
  xl: 'min-h-40',
};

export function isWidgetSize(value: unknown): value is WidgetSize {
  return typeof value === 'string' && (WIDGET_SIZES as readonly string[]).includes(value);
}

/** The next size in the cycle, restricted to what the widget allows. */
export function nextSize(
  current: WidgetSize,
  allowed: readonly WidgetSize[] = WIDGET_SIZES,
): WidgetSize {
  const order = WIDGET_SIZES.filter((size) => allowed.includes(size));
  if (order.length === 0) return current;
  const index = order.indexOf(current);
  return order[(index + 1) % order.length] ?? order[0]!;
}

/** True when two layouts describe the same arrangement. */
export function layoutsEqual(a: DashboardLayout, b: DashboardLayout): boolean {
  if (a.length !== b.length) return false;
  return a.every((item, index) => {
    const other = b[index];
    return (
      other !== undefined &&
      item.id === other.id &&
      item.type === other.type &&
      item.size === other.size &&
      JSON.stringify(item.config ?? null) === JSON.stringify(other.config ?? null)
    );
  });
}

export function createInstanceId(type: string): string {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${type}-${random}`;
}

/** Maps a legacy pixel-grid width (in 12 columns) onto the nearest size preset. */
function sizeFromLegacyWidth(width: number): WidgetSize {
  if (width <= 3) return 'sm';
  if (width <= 4) return 'md';
  if (width <= 6) return 'lg';
  return 'xl';
}

interface LegacyInstance {
  id?: unknown;
  type?: unknown;
  size?: unknown;
  config?: unknown;
  x?: unknown;
  y?: unknown;
  w?: unknown;
}

/**
 * Guards against a malformed or hand-edited `layout` column, and upgrades
 * layouts saved by the previous coordinate-based grid: their `w` becomes a size
 * and their (y, x) order becomes the list order, so nobody loses an arrangement
 * because the model changed underneath it.
 */
export function parseStoredLayout(value: unknown): DashboardLayout {
  if (!Array.isArray(value)) return [];

  const entries = value
    .filter((entry): entry is LegacyInstance => Boolean(entry) && typeof entry === 'object')
    .filter((entry) => typeof entry.id === 'string' && typeof entry.type === 'string');

  const isLegacy = entries.some(
    (entry) => !isWidgetSize(entry.size) && typeof entry.w === 'number',
  );

  const ordered = isLegacy
    ? [...entries].sort((a, b) => {
        const ay = typeof a.y === 'number' ? a.y : 0;
        const by = typeof b.y === 'number' ? b.y : 0;
        if (ay !== by) return ay - by;
        const ax = typeof a.x === 'number' ? a.x : 0;
        const bx = typeof b.x === 'number' ? b.x : 0;
        return ax - bx;
      })
    : entries;

  const seen = new Set<string>();
  const parsed: DashboardLayout = [];

  for (const entry of ordered) {
    const id = entry.id as string;
    if (seen.has(id)) continue;
    seen.add(id);

    const size: WidgetSize = isWidgetSize(entry.size)
      ? entry.size
      : typeof entry.w === 'number'
        ? sizeFromLegacyWidth(entry.w)
        : 'md';

    const instance: DashboardWidgetInstance = {
      id,
      type: entry.type as string,
      size,
    };
    if (entry.config !== undefined) instance.config = entry.config;
    parsed.push(instance);
  }

  return parsed;
}
