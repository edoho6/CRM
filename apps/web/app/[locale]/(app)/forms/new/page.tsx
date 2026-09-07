import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PageHeader } from '@/components/app-shell';
import { FormBuilder } from '@/features/forms/form-builder';

export default async function NewFormPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('forms');

  return (
    <>
      <PageHeader title={t('newForm')} description={t('builderHint')} />
      <FormBuilder
        templateId={null}
        initialTitle=""
        initialDescription=""
        initialFields={[]}
        initialActive
      />
    </>
  );
}
