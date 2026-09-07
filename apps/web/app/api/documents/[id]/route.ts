import { NextResponse } from 'next/server';
import { createServerSupabase, isSupabaseConfigured } from '@clinic/db';
import type { PatientDocument } from '@clinic/db/types';
import { logRecordAccess } from '@/lib/access-log';

/**
 * Download link for one patient document.
 *
 * The bucket is private, so a link can't just point at the file directly. This
 * route looks the row up through the caller's own Row Level Security first —
 * which is what actually decides whether they may have it — and only then mints
 * a short-lived signed URL, generated fresh at click time rather than embedded in
 * the page, so it can never go stale while the page sits open.
 *
 * `/api/*` is excluded from the locale-rewriting middleware, so this path is
 * reachable exactly as written from both the patient list and any future portal
 * integration that links here.
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

  // Taking a copy of a document out of the system is the strongest form of
  // access there is, so it is recorded as an export rather than a view — and
  // unlike a view it is never deduplicated: every download is its own row.
  await logRecordAccess(supabase, 'patient_documents', id, 'export');

  return NextResponse.redirect(signed.signedUrl);
}
