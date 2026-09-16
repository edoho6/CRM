import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Patient } from '@clinic/db/types';
import { dateKeyIn } from '@clinic/domain';
import { PageHeader } from '@/components/app-shell';
import { getClinicScope } from '@/lib/session';
import { logRecordAccess } from '@/lib/access-log';
import { PatientForm } from '@/features/patients/patient-form';
import { pageTitle } from '@/lib/page-title';

export const generateMetadata = pageTitle('patients', 'edit');

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

  // Opening the edit form is reading the whole record, whether or not anything
  // is saved afterwards. A change would be caught by the audit trigger; this
  // catches the look.
  await logRecordAccess(scope.supabase, 'patients', id);

  return (
    <>
      <PageHeader title={t('edit')} description={patient.full_name} />
      <PatientForm patient={patient} today={dateKeyIn(new Date(), scope.context.clinic.timezone)} />
    </>
  );
}
