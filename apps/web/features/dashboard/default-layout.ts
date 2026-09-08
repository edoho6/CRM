import type { DashboardLayout } from '@clinic/domain/widgets';

/**
 * The dashboard a practitioner sees before they have arranged their own.
 *
 * It opens on the number that frames a clinic day — how many treatments today,
 * this week, this month — then answers the next questions in order: who is
 * coming, how the practice is doing, what needs a hand. Sizes are chosen so each
 * row fills the twelve-column grid exactly.
 */
const FULL_LAYOUT: DashboardLayout = [
  { id: 'treatment-kpis-default', type: 'treatment-kpis', size: 'xl' },
  { id: 'today-appointments-default', type: 'today-appointments', size: 'lg' },
  { id: 'tasks-default', type: 'tasks', size: 'md' },
  { id: 'patient-stats-default', type: 'patient-stats', size: 'sm' },
  { id: 'revenue-default', type: 'revenue', size: 'sm' },
  { id: 'upcoming-appointments-default', type: 'upcoming-appointments', size: 'lg' },
  { id: 'quick-actions-default', type: 'quick-actions', size: 'sm' },
  { id: 'low-stock-default', type: 'low-stock', size: 'sm' },
];

/**
 * Widgets that only mean something when the clinic tracks herb stock.
 *
 * A plain set of type names rather than a flag on the widget definition, and
 * the reason is the server/client boundary: the default layout is chosen in a
 * Server Component, and the registry is populated by `registerWidget()` calls
 * at the top of `'use client'` modules — which do not run on the server. Asking
 * the registry there would find nothing and filter nothing. This list has no
 * such dependency and is read on both sides.
 */
export const INVENTORY_WIDGET_TYPES: ReadonlySet<string> = new Set(['low-stock']);

/**
 * The default, for this clinic.
 *
 * A clinic with inventory switched off used to get the low-stock widget anyway
 * — the one screen in the app that ignored the setting — so its first
 * dashboard opened on a card about stock it does not keep.
 */
export function defaultDashboardLayout(tracksInventory: boolean): DashboardLayout {
  return tracksInventory
    ? FULL_LAYOUT
    : FULL_LAYOUT.filter((item) => !INVENTORY_WIDGET_TYPES.has(item.type));
}
