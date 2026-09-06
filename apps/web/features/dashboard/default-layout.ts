import type { DashboardLayout } from '@clinic/domain/widgets';

/**
 * The dashboard a practitioner sees before they have arranged their own.
 *
 * Chosen to answer the three questions asked at the start of a clinic day: who is
 * coming, what needs ordering, and what do I click to add someone. Coordinates are
 * logical (x = 0 is the reading-start edge), so this reads correctly in Hebrew and
 * English alike.
 */
export const DEFAULT_DASHBOARD_LAYOUT: DashboardLayout = [
  { id: 'today-appointments-default', type: 'today-appointments', x: 0, y: 0, w: 6, h: 4 },
  { id: 'patient-stats-default', type: 'patient-stats', x: 6, y: 0, w: 3, h: 2 },
  { id: 'quick-actions-default', type: 'quick-actions', x: 9, y: 0, w: 3, h: 2 },
  { id: 'low-stock-default', type: 'low-stock', x: 6, y: 2, w: 6, h: 4 },
  { id: 'upcoming-appointments-default', type: 'upcoming-appointments', x: 0, y: 4, w: 6, h: 4 },
];
