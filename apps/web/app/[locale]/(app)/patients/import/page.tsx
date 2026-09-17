import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PageBody } from '@clinic/ui';
import { getClinicScope } from '@/lib/session';
import { PageHeader } from '@/components/app-shell';
import { ImportFlow } from '@/features/patients/import-flow';
import { pageTitle } from '@/lib/page-title';

export const generateMetadata = pageTitle('patients', 'import.title');

export default async function ImportPatientsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('patients');

  const scope = await getClinicScope();
  if (!scope) return null;

  return (
    <>
      <PageHeader title={t('import.title')} description={t('import.subtitle')} />
      <PageBody width="narrow">
        <ImportFlow />
      </PageBody>
    </>
  );
}
