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
 *
 * `?inline=1` serves the file to be shown, not saved — an `<img>` on the
 * treatment page pointing at a tongue photograph. Two things differ: the
 * signed URL carries no download disposition, and the access is logged as a
 * view, which is deduplicated, rather than as an export, which is not. Without
 * that, every render of the page would write an "export" row per picture and
 * trip the mass-download rule on the access screen for someone who only
 * opened a record.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const inline = new URL(request.url).searchParams.get('inline') === '1';

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
    .createSignedUrl(document.file_path, 60, inline ? undefined : { download: document.file_name });

  if (signError || !signed) {
    return NextResponse.json({ error: 'sign_failed' }, { status: 500 });
  }

  // Taking a copy of a document out of the system is the strongest form of
  // access there is, so it is recorded as an export rather than a view — and
  // unlike a view it is never deduplicated: every download is its own row.
  // Showing it on the page is a view.
  await logRecordAccess(supabase, 'patient_documents', id, inline ? 'view' : 'export');

  return NextResponse.redirect(signed.signedUrl);
}
