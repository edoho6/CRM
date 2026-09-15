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
 * It lives in the data package, not in the staff app, because the portal reads
 * patient records too: a patient opening their own file, or downloading a
 * document from it, is an access worth accounting for by the same rule. The
 * database decides what may be logged and by whom (`log_record_access`,
 * migration 68); this side only has to remember to ask.
 *
 * It never throws and never blocks the page. A clinical record failing to open
 * because its access log entry could not be written would be a worse outcome
 * than the gap in the log, and the gap is visible: the log simply has no row.
 */
export type AuditableTable =
  | 'patients'
  | 'encounters'
  | 'tcm_notes'
  | 'patient_documents'
  | 'invoices'
  | 'appointments'
  | 'form_submissions'
  | 'dispensing_records'
  | 'treatment_confirmations';

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
