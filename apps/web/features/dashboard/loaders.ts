import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { addMonthsIn, dateKeyIn, dayBoundsIn, monthStartIn } from '@clinic/domain';
import type { DashboardInitialData } from './dashboard-context';
import { fetchPatientStats } from './queries/patient-stats';
import {
  fetchTodayAppointments,
  fetchUpcomingAppointments,
  upcomingHorizon,
} from './queries/appointments';
import { fetchLowStock } from './queries/low-stock';
import { fetchRevenueStats } from './queries/revenue';
import { fetchEncountersSince } from './queries/encounters';
import { fetchOpenTasks } from './queries/tasks';

/** The zone a clinic falls back to before it has said where it is. */
export const DEFAULT_TIME_ZONE = 'Asia/Jerusalem';

/**
 * The widgets' data, fetched by the page before the first paint.
 *
 * The dashboard used to arrive as a grid of spinners: every widget fetched
 * in the browser after hydration, so the first thing the practitioner saw
 * each morning was a page waiting for itself. The page now runs the same
 * queries the widgets run (`queries/*`, one body for both), only for the
 * widget types actually on this person's dashboard, all at once, and hands
 * the results down through the dashboard context. A widget that finds its
 * data there renders it immediately; a widget whose query failed here is
 * simply left out and loads in the browser as before, so a bad query costs
 * a spinner and not the page.
 *
 * `server-only` because it must never be pulled into a client bundle: the
 * registry stays browser-side and knows nothing of this.
 */
export async function loadDashboardData(
  supabase: SupabaseClient,
  layout: readonly { type: string }[],
  timeZone: string,
): Promise<DashboardInitialData> {
  const now = new Date();
  const wanted = new Set(layout.map((item) => item.type));
  const data: Record<string, unknown> = {};
  const jobs: Promise<void>[] = [];

  const run = (type: string, query: () => Promise<unknown>) => {
    if (!wanted.has(type)) return;
    jobs.push(
      query()
        .then((value) => {
          data[type] = value;
        })
        .catch(() => {
          // Left out on purpose: the widget fetches for itself.
        }),
    );
  };

  const monthStart = monthStartIn(now, timeZone).toISOString();
  run('patient-stats', () => fetchPatientStats(supabase, monthStart));
  run('today-appointments', () => {
    const { start, end } = dayBoundsIn(now, timeZone);
    return fetchTodayAppointments(supabase, start.toISOString(), end.toISOString());
  });
  run('upcoming-appointments', () =>
    fetchUpcomingAppointments(supabase, now.toISOString(), upcomingHorizon(now).toISOString()),
  );
  run('low-stock', () => fetchLowStock(supabase));
  run('revenue', () => fetchRevenueStats(supabase, monthStart));
  run('treatment-kpis', () =>
    fetchEncountersSince(supabase, dateKeyIn(addMonthsIn(now, -1, timeZone), timeZone)),
  );
  run('tasks', () => fetchOpenTasks(supabase));

  await Promise.all(jobs);
  return data;
}
