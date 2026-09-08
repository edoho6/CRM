import { redirect } from '@clinic/i18n/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ClipboardList } from 'lucide-react';
import { Alert, Card, CardBody, CardHeader, CardTitle, EmptyState } from '@clinic/ui';
import { getCurrentUser, isSupabaseConfigured, tryCreateServerSupabase } from '@clinic/db';
import type { FormSubmission, FormTemplate } from '@clinic/db/types';
import type { Locale } from '@clinic/domain';
import { PortalForm } from './portal-form';
import { PortalNav } from '../portal-nav';
import { formatDate } from '@clinic/i18n';

/**
 * The questionnaires a patient can fill in before their visit.
 *
 * The point of doing this at home is that the first ten minutes of a first
 * appointment are otherwise spent on a clipboard. Every Israeli competitor
 * advertises it; here it needed no new database work at all, because
 * `form_templates_patient_read` and `form_submissions_patient_insert` have been
 * in place since the questionnaire builder was written.
 *
 * Nothing on this page takes a patient id from the URL. Every query is filtered
 * by RLS against `current_patient_id()`, so there is no id to tamper with.
 */
export const dynamic = 'force-dynamic';

export default async function PortalFormsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
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

  const [templatesResult, submissionsResult] = await Promise.all([
    supabase
      .from('form_templates')
      .select('id, title, description, fields, version')
      .eq('is_active', true)
      .order('title', { ascending: true })
      .limit(50)
      .returns<Pick<FormTemplate, 'id' | 'title' | 'description' | 'fields' | 'version'>[]>(),
    supabase
      .from('form_submissions')
      .select('id, template_id, submitted_at')
      .order('submitted_at', { ascending: false })
      .limit(50)
      .returns<Pick<FormSubmission, 'id' | 'template_id' | 'submitted_at'>[]>(),
  ]);

  const templates = templatesResult.data ?? [];
  const submissions = submissionsResult.data ?? [];

  /** The last time this questionnaire was answered, so it is not asked twice by accident. */
  const lastAnswered = new Map<string, string>();
  for (const submission of submissions) {
    if (!lastAnswered.has(submission.template_id)) {
      lastAnswered.set(submission.template_id, submission.submitted_at);
    }
  }

  return (
    <main className="mx-auto max-w-2xl space-y-5 px-4 py-8 sm:px-6">
      <PortalNav current="forms" />

      <h1 className="text-xl font-semibold text-ink-900">{t('title')}</h1>
      <p className="text-sm text-ink-700">{t('intro')}</p>

      {templates.length === 0 ? (
        <EmptyState icon={<ClipboardList className="h-8 w-8" />} title={t('none')} />
      ) : (
        <div className="space-y-5">
          {templates.map((template) => {
            const answered = lastAnswered.get(template.id);
            return (
              <Card key={template.id}>
                <CardHeader>
                  <CardTitle>{template.title}</CardTitle>
                </CardHeader>
                <CardBody className="space-y-3">
                  {template.description ? (
                    <p className="text-sm text-ink-700" dir="auto">
                      {template.description}
                    </p>
                  ) : null}

                  {/* Said before the questions, not after: someone who filled
                      this in last week should know that before answering it
                      again. It is not blocked — a follow-up questionnaire is
                      meant to be answered more than once. */}
                  {answered ? (
                    <Alert tone="info">
                      {t('answeredOn', {
                        date: formatDate(new Date(answered)),
                      })}
                    </Alert>
                  ) : null}

                  <PortalForm templateId={template.id} fields={template.fields} />
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </main>
  );
}
