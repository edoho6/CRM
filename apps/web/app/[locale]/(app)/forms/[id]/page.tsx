import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { FormTemplate } from '@clinic/db/types';
import { PageHeader } from '@/components/app-shell';
import { getClinicScope } from '@/lib/session';
import { FormBuilder } from '@/features/forms/form-builder';
import { pageTitle } from '@/lib/page-title';

export const generateMetadata = pageTitle('forms', 'single');

/**
 * Editing a questionnaire.
 *
 * The same builder as creating one — a form is never finished, and a separate
 * read-only view would be a second place for the questions to be described.
 */
export default async function EditFormPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('forms');

  const scope = await getClinicScope();
  if (!scope) return null;

  const { data: template } = await scope.supabase
    .from('form_templates')
    .select('*')
    .eq('id', id)
    .maybeSingle<FormTemplate>();

  if (!template) notFound();

  return (
    <>
      <PageHeader
        title={template.title}
        description={t('versionNote', { version: template.version })}
      />
      <FormBuilder
        templateId={template.id}
        initialTitle={template.title}
        initialDescription={template.description ?? ''}
        initialFields={template.fields}
        initialActive={template.is_active}
      />
    </>
  );
}
