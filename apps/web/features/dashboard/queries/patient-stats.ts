import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * The widgets' queries, as plain functions of a client.
 *
 * One body for two callers: the page runs it on the server for the first
 * paint, and the widget runs the same one in the browser on reload. Nothing
 * in here knows which; Row Level Security answers the same either way.
 */
export interface PatientStats {
  active: number;
  newThisMonth: number;
}

export async function fetchPatientStats(
  supabase: SupabaseClient,
  monthStartIso: string,
): Promise<PatientStats> {
  // `head: true` asks Postgres for the count only — no rows cross the wire.
  const [activeResult, newResult] = await Promise.all([
    supabase.from('patients').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabase
      .from('patients')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', monthStartIso),
  ]);

  if (activeResult.error) throw new Error(activeResult.error.message);
  if (newResult.error) throw new Error(newResult.error.message);

  return { active: activeResult.count ?? 0, newThisMonth: newResult.count ?? 0 };
}
