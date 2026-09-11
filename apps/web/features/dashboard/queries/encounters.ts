import type { SupabaseClient } from '@supabase/supabase-js';

export interface EncounterRow {
  id: string;
  encounter_date: string;
  created_at: string;
  status: string;
  patient: { id: string; full_name: string } | null;
}

/** Every treatment from a day (`YYYY-MM-DD`) on, oldest first — the KPI tiles derive the rest. */
export async function fetchEncountersSince(
  supabase: SupabaseClient,
  fromKey: string,
): Promise<EncounterRow[]> {
  const { data, error } = await supabase
    .from('encounters')
    .select('id, encounter_date, created_at, status, patient:patients(id, full_name)')
    .gte('encounter_date', fromKey)
    .order('encounter_date', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as EncounterRow[];
}
