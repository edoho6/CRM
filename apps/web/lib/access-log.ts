import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Records that someone read a patient record.
 *
 * Nothing in Postgres fires on a SELECT, so unlike every write in this system
 * a read has to be reported by the application. That makes this call easy to
 * forget, which is why it lives in one helper with one name rather than being
 * written out at each site — a missing call is then a missing line rather than
 * a subtly different one.
 *
 * It never throws and never blocks the page. A clinical record failing to open
 * because its access log entry could not be written would be a worse outcome
 * than the gap in the log, and the gap is visible: the log simply has no row.
 */
export type AuditableTable = 'patients' | 'encounters' | 'tcm_notes' | 'patient_documents';

export async function logRecordAccess(
  supabase: SupabaseClient,
  table: AuditableTable,
  recordId: string,
  action: 'view' | 'export' = 'view',
): Promise<void> {
  try {
    await supabase.rpc('log_record_access', {
      p_table: table,
      p_record: recordId,
      p_action: action,
    });
  } catch {
    // Deliberately swallowed: see the note above.
  }
}
