/**
 * Every preference this browser keeps for the person using it, by key.
 *
 * One list, in a plain module, because the pre-paint script in `theme.ts`
 * reads these before React exists and the components read them after — and
 * a key spelled two ways is a preference that is remembered by one and
 * forgotten by the other. The table-size key is also spelled out in the
 * shared kit (`packages/ui/src/table-size.tsx`), which cannot import from
 * here; the two are kept equal by hand and by `theme.test.ts`.
 */
export const PREF_KEYS = {
  theme: 'herbalist-theme',
  sidebarCollapsed: 'herbalist-sidebar-collapsed',
  navOrder: 'herbalist-nav-order',
  tableSize: 'herbalist-table-size',
  kpiMode: 'herbalist-patient-kpi-mode',
  kpiLayout: 'herbalist-patient-kpi-layout',
  gettingStartedHidden: 'herbalist-getting-started-hidden',
  /** sessionStorage, not localStorage: open files belong to a tab. */
  openFiles: 'herbalist-open-files',
} as const;

export const TABLE_SIZES = ['compact', 'regular', 'large'] as const;
export const KPI_MODES = ['tiles', 'pills', 'bar', 'hidden'] as const;

/**
 * The `<html>` attributes the pre-paint script writes from the stored
 * preferences, so the stylesheet can draw the remembered layout before React
 * has hydrated — a collapsed sidebar, a hidden strip of tiles, compact rows —
 * and the page never paints one way and then jumps to another.
 * Components read the same attributes to seed their state, and write them
 * back when the preference changes.
 */
export const LAYOUT_ATTRIBUTES = {
  sidebar: 'sidebar',
  tableSize: 'tableSize',
  kpiMode: 'kpiMode',
  gettingStarted: 'gettingStarted',
  openFiles: 'openFiles',
} as const;
