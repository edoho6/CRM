import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Patient } from '@clinic/db/types';
import { PageHeader } from '@/components/app-shell';
import { getClinicScope } from '@/lib/session';
import { PatientForm } from '@/features/patients/patient-form';

export default async function EditPatientPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('patients');

  const scope = await getClinicScope();
  if (!scope) return null;

  const { data: patient } = await scope.supabase
    .from('patients')
    .select('*')
    .eq('id', id)
    .maybeSingle<Patient>();

  if (!patient) notFound();

  return (
    <>
      <PageHeader title={t('edit')} description={patient.full_name} />
      <PatientForm patient={patient} />
    </>
  );
}
