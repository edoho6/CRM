import { notFound } from 'next/navigation';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import { CalendarPlus, Pencil } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardBody,
  DetailRow,
  EmptyState,
  SortBody,
  SortTh,
  SortableTable,
  TableWrapper,
  Td,
  Th,
  Tr,
} from '@clinic/ui';
import { Link } from '@clinic/i18n/navigation';
import type {
  Appointment,
  AppointmentType,
  ConsentDocument,
  Encounter,
  Patient,
  PatientConsentStatus,
  PatientConsentWithDocument,
  PatientDocument,
  PatientMedicalHistory,
} from '@clinic/db/types';
import type { Locale } from '@clinic/domain';
import { PageHeader } from '@/components/app-shell';
import { PhoneActions } from '@/components/phone-actions';
import { getClinicScope } from '@/lib/session';
import { logRecordAccess } from '@/lib/access-log';
import { ageFromDateOfBirth, appointmentTypeName } from '@/lib/display';
import { PatientTabs } from '@/features/patients/patient-tabs';
import { MedicalHistoryForm } from '@/features/patients/medical-history-form';
import { StartEncounterButton } from '@/features/encounters/start-encounter-button';
import { DocumentsPanel } from '@/features/documents/documents-panel';
import { ConsentPanel } from '@/features/consent/consent-panel';

type AppointmentRow = Appointment & {
  appointment_type: Pick<AppointmentType, 'name_he' | 'name_en'> | null;
};

export default async function PatientDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('patients');
  const tc = await getTranslations('common');
  const tEnc = await getTranslations('encounters');
  const tApp = await getTranslations('appointments');
  const format = await getFormatter();

  const scope = await getClinicScope();
  if (!scope) return null;

  const { data: patient } = await scope.supabase
    .from('patients')
    .select('*')
    .eq('id', id)
    .maybeSingle<Patient>();

  if (!patient) notFound();

  // Opening a patient file is the act the access log exists to record. It is
  // logged before the panels load, so a page that errors half-way through still
  // leaves the trace.
  await logRecordAccess(scope.supabase, 'patients', patient.id);

  const [
    historyResult,
    encountersResult,
    appointmentsResult,
    documentsResult,
    consentStatusResult,
    consentHistoryResult,
    consentDocumentsResult,
  ] = await Promise.all([
    scope.supabase
      .from('patient_medical_history')
      .select('*')
      .eq('patient_id', id)
      .maybeSingle<PatientMedicalHistory>(),
    scope.supabase
      .from('encounters')
      .select('*')
      .eq('patient_id', id)
      .order('encounter_date', { ascending: false })
      .limit(100)
      .returns<Encounter[]>(),
    scope.supabase
      .from('appointments')
      .select('*, appointment_type:appointment_types(name_he, name_en)')
      .eq('patient_id', id)
      .order('start_at', { ascending: false })
      .limit(100)
      .returns<AppointmentRow[]>(),
    scope.supabase
      .from('patient_documents')
      .select('*')
      .eq('patient_id', id)
      .order('created_at', { ascending: false })
      .returns<PatientDocument[]>(),
    scope.supabase
      .from('patient_consent_status')
      .select('*')
      .eq('patient_id', id)
      .returns<PatientConsentStatus[]>(),
    scope.supabase
      .from('patient_consents')
      .select('*, document:consent_documents(kind, version, locale, title, published_at)')
      .eq('patient_id', id)
      .order('decided_at', { ascending: true })
      .returns<PatientConsentWithDocument[]>(),
    // Only the published documents, and only in the language being read: a
    // consent should cite the text the patient was actually shown.
    scope.supabase
      .from('consent_documents')
      .select('*')
      .not('published_at', 'is', null)
      .eq('locale', locale)
      .order('version', { ascending: false })
      .returns<ConsentDocument[]>(),
  ]);

  const history = historyResult.data ?? null;
  const encounters = encountersResult.data ?? [];
  const appointments = appointmentsResult.data ?? [];
  const documents = documentsResult.data ?? [];
  const age = ageFromDateOfBirth(patient.date_of_birth);

  const overview = (
    <Card>
      <CardBody>
        <dl className="grid grid-cols-1 gap-x-6 sm:grid-cols-2 lg:grid-cols-3">
          <DetailRow label={t('fields.fullName')}>{patient.full_name}</DetailRow>
          <DetailRow label={t('fields.phone')}>
            {patient.phone ? <PhoneActions phone={patient.phone} /> : '—'}
          </DetailRow>
          <DetailRow label={t('fields.email')}>
            {patient.email ? (
              <a href={`mailto:${patient.email}`} dir="ltr" className="text-jade-800">
                {patient.email}
              </a>
            ) : (
              '—'
            )}
          </DetailRow>
          <DetailRow label={t('fields.dateOfBirth')}>
            {patient.date_of_birth ? (
              <span dir="ltr">
                {format.dateTime(new Date(patient.date_of_birth), 'short')}
                {age !== null ? ` · ${t('years', { count: age })}` : ''}
              </span>
            ) : (
              '—'
            )}
          </DetailRow>
          <DetailRow label={t('fields.nationalId')}>
            {patient.national_id ? (
              <span dir="ltr" className="tabular-nums">
                {patient.national_id}
              </span>
            ) : (
              '—'
            )}
          </DetailRow>
          <DetailRow label={t('fields.city')}>{patient.city ?? '—'}</DetailRow>
          <DetailRow label={t('fields.address')}>{patient.address ?? '—'}</DetailRow>
          <DetailRow label={t('fields.occupation')}>{patient.occupation ?? '—'}</DetailRow>
          <DetailRow label={t('fields.referralSource')}>{patient.referral_source ?? '—'}</DetailRow>
          <DetailRow label={t('fields.emergencyContactName')}>
            {patient.emergency_contact_name ?? '—'}
          </DetailRow>
          <DetailRow label={t('fields.emergencyContactPhone')}>
            {patient.emergency_contact_phone ? (
              <PhoneActions phone={patient.emergency_contact_phone} />
            ) : (
              '—'
            )}
          </DetailRow>
        </dl>
        {patient.notes ? (
          <div className="mt-4 rounded-lg bg-ink-50 p-3">
            <p className="text-xs text-ink-500">{t('fields.notes')}</p>
            <p className="mt-1 text-sm whitespace-pre-wrap text-ink-800">{patient.notes}</p>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );

  const encountersPanel =
    encounters.length === 0 ? (
      <EmptyState title={t('noEncounters')} />
    ) : (
      <TableWrapper>
        <SortableTable defaultSortKey="date" defaultSortDirection="desc">
          <thead>
            <tr>
              <SortTh sortKey="date">{tc('date')}</SortTh>
              <SortTh sortKey="status">{tc('status')}</SortTh>
              <Th />
            </tr>
          </thead>
          <SortBody locale={locale}>
            {encounters.map((encounter) => (
              <Tr
                key={encounter.id}
                sort={{
                  date: new Date(encounter.encounter_date).getTime(),
                  status: tEnc(`status.${encounter.status}`),
                }}
              >
                <Td>
                  <span dir="ltr">
                    {format.dateTime(new Date(encounter.encounter_date), 'short')}
                  </span>
                </Td>
                <Td>
                  <Badge tone={encounter.status === 'signed' ? 'success' : 'warning'}>
                    {tEnc(`status.${encounter.status}`)}
                  </Badge>
                </Td>
                <Td className="text-end">
                  <Link
                    href={`/encounters/${encounter.id}`}
                    className="text-sm font-medium text-jade-800 underline-offset-2 hover:underline"
                  >
                    {tc('viewAll')}
                  </Link>
                </Td>
              </Tr>
            ))}
          </SortBody>
        </SortableTable>
      </TableWrapper>
    );

  const appointmentsPanel =
    appointments.length === 0 ? (
      <EmptyState title={t('noAppointments')} />
    ) : (
      <TableWrapper>
        <SortableTable defaultSortKey="date" defaultSortDirection="desc">
          <thead>
            <tr>
              <SortTh sortKey="date">{tc('date')}</SortTh>
              <SortTh sortKey="type">{tApp('type')}</SortTh>
              <SortTh sortKey="status">{tc('status')}</SortTh>
            </tr>
          </thead>
          <SortBody locale={locale}>
            {appointments.map((appointment) => (
              <Tr
                key={appointment.id}
                sort={{
                  date: new Date(appointment.start_at).getTime(),
                  type: appointmentTypeName(appointment.appointment_type, locale as Locale),
                  status: tApp(`status.${appointment.status}`),
                }}
              >
                <Td>
                  <span dir="ltr">
                    {format.dateTime(new Date(appointment.start_at), 'dateTime')}
                  </span>
                </Td>
                <Td>{appointmentTypeName(appointment.appointment_type, locale as Locale) || '—'}</Td>
                <Td>
                  <Badge tone={appointment.status === 'cancelled' ? 'danger' : 'neutral'}>
                    {tApp(`status.${appointment.status}`)}
                  </Badge>
                </Td>
              </Tr>
            ))}
          </SortBody>
        </SortableTable>
      </TableWrapper>
    );

  return (
    <>
      <PageHeader
        title={patient.full_name}
        description={
          <span className="flex items-center gap-2">
            <Badge tone={patient.is_active ? 'success' : 'muted'}>
              {patient.is_active ? tc('active') : tc('inactive')}
            </Badge>
            {/* The outcome, beside the active flag rather than instead of it.
                Only shown once it says something: "in treatment" is the default
                and adds nothing next to the badge already there. */}
            {patient.treatment_status && patient.treatment_status !== 'active' ? (
              <Badge
                tone={
                  patient.treatment_status === 'full_success'
                    ? 'success'
                    : patient.treatment_status === 'unsuccessful'
                      ? 'danger'
                      : patient.treatment_status === 'dropped_out'
                        ? 'warning'
                        : 'neutral'
                }
              >
                {t(`status.${patient.treatment_status}`)}
              </Badge>
            ) : null}
            {age !== null ? <span>{t('years', { count: age })}</span> : null}
          </span>
        }
        actions={
          <>
            <StartEncounterButton patientId={patient.id} />
            <Button asChild variant="secondary">
              <Link href={{ pathname: '/calendar', query: { patient: patient.id, new: '1' } }}>
                <CalendarPlus className="h-4 w-4" />
                {tApp('new')}
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href={`/patients/${patient.id}/edit`}>
                <Pencil className="h-4 w-4" />
                {tc('edit')}
              </Link>
            </Button>
          </>
        }
      />

      <PatientTabs
        overview={overview}
        encounters={encountersPanel}
        appointments={appointmentsPanel}
        documents={<DocumentsPanel patientId={patient.id} documents={documents} />}
        medical={<MedicalHistoryForm patientId={patient.id} history={history} />}
        consent={
          <ConsentPanel
            patientId={patient.id}
            patientName={patient.full_name}
            statuses={consentStatusResult.data ?? []}
            history={consentHistoryResult.data ?? []}
            documents={consentDocumentsResult.data ?? []}
          />
        }
      />
    </>
  );
}
