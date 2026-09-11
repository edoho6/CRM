import type { SupabaseClient } from '@supabase/supabase-js';

export interface AppointmentRow {
  id: string;
  start_at: string;
  end_at: string;
  status: string;
  patient: { id: string; first_name: string; last_name: string; full_name: string } | null;
  appointment_type: { name_he: string; name_en: string; color: string } | null;
}

const SELECT =
  'id, start_at, end_at, status, patient:patients(id, first_name, last_name, full_name), appointment_type:appointment_types(name_he, name_en, color)';

/** The day's bookings, `[startIso, endIso)`, earliest first, cancellations left out. */
export async function fetchTodayAppointments(
  supabase: SupabaseClient,
  startIso: string,
  endIso: string,
): Promise<AppointmentRow[]> {
  const { data, error } = await supabase
    .from('appointments')
    .select(SELECT)
    .gte('start_at', startIso)
    .lt('start_at', endIso)
    .neq('status', 'cancelled')
    .order('start_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as AppointmentRow[];
}

/** The next week's bookings from an instant, at most twenty-five. */
export async function fetchUpcomingAppointments(
  supabase: SupabaseClient,
  fromIso: string,
  toIso: string,
): Promise<AppointmentRow[]> {
  const { data, error } = await supabase
    .from('appointments')
    .select(SELECT)
    .gte('start_at', fromIso)
    .lte('start_at', toIso)
    .neq('status', 'cancelled')
    .order('start_at', { ascending: true })
    .limit(25);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as AppointmentRow[];
}

/** Seven days on from an instant, as the upcoming widget counts them. */
export function upcomingHorizon(from: Date): Date {
  const horizon = new Date(from);
  horizon.setDate(horizon.getDate() + 7);
  return horizon;
}
