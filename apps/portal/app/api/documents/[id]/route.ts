import { NextResponse } from 'next/server';
import { createServerSupabase, isSupabaseConfigured } from '@clinic/db';
import type { PatientDocument } from '@clinic/db/types';

/**
 * Download link for a document shared with the signed-in patient.
 *
 * Mirrors the staff app's version. The row lookup goes through the patient's own
 * Row Level Security policy (`patient_documents_portal_self`), which already
 * requires `shared_with_patient = true` — so a document never marked shared
 * simply doesn't exist as far as this query is concerned, regardless of what id
 * is guessed.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  }

  const supabase = await createServerSupabase();

  const { data: document, error } = await supabase
    .from('patient_documents')
    .select('file_path, file_name')
    .eq('id', id)
    .maybeSingle<Pick<PatientDocument, 'file_path' | 'file_name'>>();

  if (error || !document) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const { data: signed, error: signError } = await supabase.storage
    .from('patient-documents')
    .createSignedUrl(document.file_path, 60, { download: document.file_name });

  if (signError || !signed) {
    return NextResponse.json({ error: 'sign_failed' }, { status: 500 });
  }

  return NextResponse.redirect(signed.signedUrl);
}
