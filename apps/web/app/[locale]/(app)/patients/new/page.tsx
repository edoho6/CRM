import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PageHeader } from '@/components/app-shell';
import { PatientForm } from '@/features/patients/patient-form';

export default async function NewPatientPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('patients');

  return (
    <>
      <PageHeader title={t('new')} />
      <PatientForm />
    </>
  );
}
