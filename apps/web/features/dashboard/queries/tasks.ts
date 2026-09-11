import type { SupabaseClient } from '@supabase/supabase-js';
import type { ClinicTaskWithPatient } from '@clinic/db/types';

/** Open tasks, urgent first, then by due date, at most fifty. */
export async function fetchOpenTasks(supabase: SupabaseClient): Promise<ClinicTaskWithPatient[]> {
  const { data, error } = await supabase
    .from('clinic_tasks')
    .select('*, patient:patients(id, full_name)')
    .is('done_at', null)
    .order('is_urgent', { ascending: false })
    .order('due_on', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data ?? []) as ClinicTaskWithPatient[];
}
