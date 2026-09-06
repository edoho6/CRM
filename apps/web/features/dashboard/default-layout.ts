import type { DashboardLayout } from '@clinic/domain/widgets';

/**
 * The dashboard a practitioner sees before they have arranged their own.
 *
 * It opens on the number that frames a clinic day — how many treatments today,
 * this week, this month — then answers the next questions in order: who is
 * coming, how the practice is doing, what needs a hand. Sizes are chosen so each
 * row fills the twelve-column grid exactly.
 */
export const DEFAULT_DASHBOARD_LAYOUT: DashboardLayout = [
  { id: 'treatment-kpis-default', type: 'treatment-kpis', size: 'xl' },
  { id: 'today-appointments-default', type: 'today-appointments', size: 'lg' },
  { id: 'patient-stats-default', type: 'patient-stats', size: 'sm' },
  { id: 'revenue-default', type: 'revenue', size: 'sm' },
  { id: 'upcoming-appointments-default', type: 'upcoming-appointments', size: 'lg' },
  { id: 'quick-actions-default', type: 'quick-actions', size: 'sm' },
  { id: 'low-stock-default', type: 'low-stock', size: 'sm' },
];
