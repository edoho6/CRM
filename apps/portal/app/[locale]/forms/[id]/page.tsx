import { notFound } from 'next/navigation';
import { redirect } from '@clinic/i18n/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Alert } from '@clinic/ui';
import { getCurrentUser, isSupabaseConfigured, tryCreateServerSupabase } from '@clinic/db';
import type { FormSubmission, FormTemplate } from '@clinic/db/types';
import type { Locale } from '@clinic/domain';
import { PortalForm } from '../portal-form';
import { PortalShell } from '../../portal-shell';
import { formatDate } from '@clinic/i18n';
import { pageTitle } from '@/lib/page-title';

export const generateMetadata = pageTitle('portal.forms');

/**
 * One questionnaire, on its own screen, a section at a time.
 *
 * Reached from the list; the template comes back only if the clinic has
 * published it to its patients (`form_templates_patient_read`), so a guessed
 * id shows nothing.
 */
export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PortalFormPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('portal.forms');
  const tc = await getTranslations('common');

  if (!isSupabaseConfigured()) {
    return (
      <main className="mx-auto max-w-lg px-6 py-16">
        <Alert tone="warning">{tc('errorGeneric')}</Alert>
      </main>
    );
  }

  const user = await getCurrentUser();
  if (!user) {
    redirect({ href: '/login', locale: locale as Locale });
    return null;
  }

  const supabase = await tryCreateServerSupabase();
  if (!supabase) return null;

  const { data: patientId } = await supabase.rpc('current_patient_id');
  if (!patientId) {
    redirect({ href: '/', locale: locale as Locale });
    return null;
  }

  if (!UUID.test(id)) notFound();

  const [templateResult, submissionResult] = await Promise.all([
    supabase
      .from('form_templates')
      .select('id, title, description, fields, version')
      .eq('id', id)
      .eq('is_active', true)
      .maybeSingle<Pick<FormTemplate, 'id' | 'title' | 'description' | 'fields' | 'version'>>(),
    supabase
      .from('form_submissions')
      .select('id, submitted_at')
      .eq('template_id', id)
      .order('submitted_at', { ascending: false })
      .limit(1)
      .maybeSingle<Pick<FormSubmission, 'id' | 'submitted_at'>>(),
  ]);

  const template = templateResult.data;
  if (!template) notFound();
  const answered = submissionResult.data?.submitted_at ?? null;

  return (
    <PortalShell current="forms" title={template.title}>
      {template.description ? (
        <p className="text-sm text-ink-700" dir="auto">
          {template.description}
        </p>
      ) : null}

      {/* Said before the questions, not after: someone who filled this in
          last week should know that before answering it again. It is not
          blocked — a follow-up questionnaire is meant to be answered more
          than once. */}
      {answered ? (
        <Alert tone="info">{t('answeredOn', { date: formatDate(new Date(answered)) })}</Alert>
      ) : null}

      <PortalForm templateId={template.id} fields={template.fields} />
    </PortalShell>
  );
}
