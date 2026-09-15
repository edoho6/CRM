import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { createServerSupabase, getCurrentUser, isSupabaseConfigured } from '@clinic/db';
import { logRecordAccess } from '@clinic/db/access-log';
import { checkRateLimit, recordFailure } from '@clinic/db/rate-limit';
import type { PatientDocument } from '@clinic/db/types';
import { renderSubmissionHtml, type FormField } from '@clinic/domain';
import { formatDateTime } from '@clinic/i18n';

/**
 * Download link for a document shared with the signed-in patient.
 *
 * Mirrors the staff app's version. The row lookup goes through the patient's own
 * Row Level Security policy (`patient_documents_portal_self`), which already
 * requires `shared_with_patient = true` — so a document never marked shared
 * simply doesn't exist as far as this query is concerned, regardless of what id
 * is guessed.
 *
 * A questionnaire the patient filled in has no file in storage: its document
 * row points at the submission (`form-submission:<id>`), and the page is
 * rendered here from the submission's own frozen copy of the questions — read
 * through the patient's own policies on submissions and signatures, so it can
 * only ever be their own.
 */
/** A patient taking copies of their own documents; thirty a quarter of an hour. */
const DOWNLOAD_BUDGET = { max: 30 } as const;

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const inline = new URL(request.url).searchParams.get('inline') === '1';

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  }

  const supabase = await createServerSupabase();

  // Counted per patient, and only for copies leaving the system: the inline
  // form is how the portal shows a document on the page.
  if (!inline) {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    const limitKey = `portal-doc:${user.id}`;
    const limit = checkRateLimit(limitKey, DOWNLOAD_BUDGET);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: 'too_many_requests' },
        { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
      );
    }
    recordFailure(limitKey, DOWNLOAD_BUDGET);
  }

  const { data: document, error } = await supabase
    .from('patient_documents')
    .select('file_path, file_name')
    .eq('id', id)
    .maybeSingle<Pick<PatientDocument, 'file_path' | 'file_name'>>();

  if (error || !document) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  // The staff app has always recorded this; the portal did not, so a document
  // read by the patient left no trace at all. Same rule as the staff side: a
  // copy taken out is an export and is never deduplicated, showing it on the
  // page is a view.
  await logRecordAccess(supabase, 'patient_documents', id, inline ? 'view' : 'export');

  if (document.file_path.startsWith('form-submission:')) {
    return renderFiledSubmission(
      supabase,
      document.file_path.slice('form-submission:'.length),
      document.file_name,
      inline,
    );
  }

  const { data: signed, error: signError } = await supabase.storage
    .from('patient-documents')
    .createSignedUrl(document.file_path, 60, inline ? undefined : { download: document.file_name });

  if (signError || !signed) {
    return NextResponse.json({ error: 'sign_failed' }, { status: 500 });
  }

  return NextResponse.redirect(signed.signedUrl);
}

async function renderFiledSubmission(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  submissionId: string,
  fileName: string,
  inline: boolean,
): Promise<NextResponse> {
  const { data: submission } = await supabase
    .from('form_submissions')
    .select(
      'id, clinic_id, fields, answers, submitted_at, template:form_templates(title), patient:patients(full_name)',
    )
    .eq('id', submissionId)
    .maybeSingle<{
      id: string;
      clinic_id: string;
      fields: FormField[];
      answers: Record<string, unknown>;
      submitted_at: string;
      template: { title: string } | null;
      patient: { full_name: string } | null;
    }>();
  if (!submission) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const [{ data: signature }, { data: clinic }] = await Promise.all([
    supabase
      .from('signatures')
      .select('method, content')
      .eq('form_submission_id', submissionId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle<{ method: 'drawn' | 'typed'; content: string }>(),
    // The clinic's name for the page header; a policy that withholds it
    // costs the header a name, nothing more.
    supabase
      .from('clinics')
      .select('name')
      .eq('id', submission.clinic_id)
      .maybeSingle<{ name: string }>(),
  ]);

  const locale = (await cookies()).get('NEXT_LOCALE')?.value === 'en' ? 'en' : 'he';
  const t = await getTranslations({ locale, namespace: 'forms.rendered' });

  const html = renderSubmissionHtml({
    title: submission.template?.title ?? fileName,
    clinicName: clinic?.name ?? '',
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
  if (!inline)
    headers['Content-Disposition'] = `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`;
  return new NextResponse(html, { headers });
}
