import { redirect } from '@clinic/i18n/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Check, ClipboardList } from 'lucide-react';
import { Alert, EmptyState, List, ListRow } from '@clinic/ui';
import { getCurrentUser, isSupabaseConfigured, tryCreateServerSupabase } from '@clinic/db';
import type { FormSubmission, FormTemplate } from '@clinic/db/types';
import type { Locale } from '@clinic/domain';
import { Link } from '@clinic/i18n/navigation';
import { PortalShell } from '../portal-shell';
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
 * A list of rows, one questionnaire each, leading to its own screen: every
 * questionnaire used to be open on this page at once, which on a phone was
 * a hundred questions on one scroll with nowhere to stand.
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
      .select('id, title, description')
      .eq('is_active', true)
      .order('title', { ascending: true })
      .limit(50)
      .returns<Pick<FormTemplate, 'id' | 'title' | 'description'>[]>(),
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
    <PortalShell current="forms" title={t('title')}>
      <p className="text-sm text-ink-700">{t('intro')}</p>

      {templates.length === 0 ? (
        <EmptyState icon={<ClipboardList className="h-8 w-8" />} title={t('none')} />
      ) : (
        <List>
          {templates.map((template) => {
            const answered = lastAnswered.get(template.id);
            return (
              <ListRow
                key={template.id}
                asChild
                chevron
                leading={
                  answered ? (
                    <Check className="h-5 w-5 text-jade-700" aria-hidden />
                  ) : (
                    <ClipboardList className="h-5 w-5" aria-hidden />
                  )
                }
                title={template.title}
                description={
                  answered
                    ? t('answeredOn', { date: formatDate(new Date(answered)) })
                    : (template.description ?? t('open'))
                }
              >
                <Link href={`/forms/${template.id}`} />
              </ListRow>
            );
          })}
        </List>
      )}
    </PortalShell>
  );
}
