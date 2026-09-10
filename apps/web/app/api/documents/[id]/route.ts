import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { createServerSupabase, isSupabaseConfigured } from '@clinic/db';
import type { PatientDocument } from '@clinic/db/types';
import { renderSubmissionHtml, type FormField } from '@clinic/domain';
import { formatDateTime } from '@clinic/i18n';
import { getMembershipContext } from '@/lib/session';
import { logRecordAccess } from '@/lib/access-log';

/**
 * A filed questionnaire has no object in storage: its document row points at
 * the submission, and the page is rendered here, on request, from the
 * submission's own frozen copy of the questions. Read through the caller's
 * Row Level Security like everything else.
 */
async function renderFiledSubmission(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  submissionId: string,
  fileName: string,
  inline: boolean,
): Promise<NextResponse> {
  const { data: submission } = await supabase
    .from('form_submissions')
    .select('id, fields, answers, submitted_at, template:form_templates(title), patient:patients(full_name)')
    .eq('id', submissionId)
    .maybeSingle<{
      id: string;
      fields: FormField[];
      answers: Record<string, unknown>;
      submitted_at: string;
      template: { title: string } | null;
      patient: { full_name: string } | null;
    }>();
  if (!submission) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const { data: signature } = await supabase
    .from('signatures')
    .select('method, content')
    .eq('form_submission_id', submissionId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<{ method: 'drawn' | 'typed'; content: string }>();

  const locale = (await cookies()).get('NEXT_LOCALE')?.value === 'en' ? 'en' : 'he';
  const t = await getTranslations({ locale, namespace: 'forms.rendered' });
  const context = await getMembershipContext();

  const html = renderSubmissionHtml({
    title: submission.template?.title ?? fileName,
    clinicName: context?.clinic.name ?? '',
    patientName: submission.patient?.full_name ?? '',
    submittedAt: formatDateTime(submission.submitted_at),
    fields: submission.fields,
    answers: submission.answers,
    signature: signature ?? null,
    locale,
    labels: {
      patient: t('patient'),
      submittedAt: t('submittedAt'),
      signature: t('signature'),
      noAnswer: t('noAnswer'),
      yes: t('yes'),
      no: t('no'),
    },
  });
  const headers: Record<string, string> = {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'private, no-store',
    'Content-Security-Policy': "default-src 'none'; img-src data:; style-src 'unsafe-inline'",
  };
  if (!inline) headers['Content-Disposition'] = `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`;
  return new NextResponse(html, { headers });
}

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

  if (document.file_path.startsWith('form-submission:')) {
    await logRecordAccess(supabase, 'patient_documents', id, inline ? 'view' : 'export');
    return renderFiledSubmission(supabase, document.file_path.slice('form-submission:'.length), document.file_name, inline);
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
