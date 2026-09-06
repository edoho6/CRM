import type { DashboardLayout, DashboardWidgetInstance } from '@clinic/domain/widgets';

/** Columns used by the desktop dashboard grid. */
export const DASHBOARD_COLS = 12;
export const DASHBOARD_ROW_HEIGHT = 76;
export const DASHBOARD_MARGIN: [number, number] = [16, 16];

/**
 * Mirroring between stored and displayed coordinates.
 *
 * Layouts are persisted in *logical* coordinates, where x = 0 is the reading-start
 * edge. The grid library only knows physical left-to-right pixels, so in Hebrew the
 * two are mirrored on the way in and back again on the way out.
 *
 * Storing logical coordinates means one saved dashboard looks right in both
 * languages — switching to English does not scramble the arrangement.
 */
export function toPhysicalX(logicalX: number, width: number, dir: 'rtl' | 'ltr'): number {
  if (dir === 'ltr') return logicalX;
  return Math.max(0, DASHBOARD_COLS - logicalX - width);
}

export function toLogicalX(physicalX: number, width: number, dir: 'rtl' | 'ltr'): number {
  if (dir === 'ltr') return physicalX;
  return Math.max(0, DASHBOARD_COLS - physicalX - width);
}

export interface GridLayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
}

export function toGridLayout(
  layout: DashboardLayout,
  dir: 'rtl' | 'ltr',
  constraints: Record<string, { minW?: number; minH?: number; maxW?: number; maxH?: number }>,
): GridLayoutItem[] {
  return layout.map((item) => ({
    i: item.id,
    x: toPhysicalX(item.x, item.w, dir),
    y: item.y,
    w: item.w,
    h: item.h,
    ...(constraints[item.type] ?? {}),
  }));
}

export function fromGridLayout(
  gridItems: readonly { i: string; x: number; y: number; w: number; h: number }[],
  previous: DashboardLayout,
  dir: 'rtl' | 'ltr',
): DashboardLayout {
  const byId = new Map(previous.map((item) => [item.id, item]));
  const next: DashboardLayout = [];

  for (const gridItem of gridItems) {
    const original = byId.get(gridItem.i);
    if (!original) continue;
    next.push({
      ...original,
      x: toLogicalX(gridItem.x, gridItem.w, dir),
      y: gridItem.y,
      w: gridItem.w,
      h: gridItem.h,
    });
  }

  // Preserve anything the grid did not report (defensive: never drop a widget
  // because of a transient render).
  for (const item of previous) {
    if (!next.some((entry) => entry.id === item.id)) {
      next.push(item);
    }
  }

  return next;
}

/** True when two layouts describe the same arrangement, ignoring key order. */
export function layoutsEqual(a: DashboardLayout, b: DashboardLayout): boolean {
  if (a.length !== b.length) return false;
  const serialise = (layout: DashboardLayout) =>
    layout
      .map((item) => `${item.id}:${item.type}:${item.x},${item.y},${item.w},${item.h}:${JSON.stringify(item.config ?? null)}`)
      .sort()
      .join('|');
  return serialise(a) === serialise(b);
}

/** Finds the first free row so a newly added widget lands below existing ones. */
export function nextAvailableY(layout: DashboardLayout): number {
  return layout.reduce((max, item) => Math.max(max, item.y + item.h), 0);
}

export function createInstanceId(type: string): string {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${type}-${random}`;
}

/** Guards against a malformed or hand-edited `layout` column. */
export function parseStoredLayout(value: unknown): DashboardLayout {
  if (!Array.isArray(value)) return [];
  const parsed: DashboardLayout = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const candidate = entry as Partial<DashboardWidgetInstance>;
    if (typeof candidate.id !== 'string' || typeof candidate.type !== 'string') continue;
    parsed.push({
      id: candidate.id,
      type: candidate.type,
      x: Number.isFinite(candidate.x) ? Number(candidate.x) : 0,
      y: Number.isFinite(candidate.y) ? Number(candidate.y) : 0,
      w: Number.isFinite(candidate.w) ? Math.max(1, Number(candidate.w)) : 4,
      h: Number.isFinite(candidate.h) ? Math.max(1, Number(candidate.h)) : 3,
      config: candidate.config,
    });
  }
  return parsed;
}
