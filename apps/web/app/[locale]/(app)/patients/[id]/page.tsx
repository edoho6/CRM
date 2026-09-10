import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { CalendarPlus, ClipboardList, Pencil } from 'lucide-react';
import {
  Dash,
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
  Tr,
} from '@clinic/ui';
import { Link } from '@clinic/i18n/navigation';
import type {
  Appointment,
  AppointmentPaymentStatus,
  AppointmentType,
  ConsentDocument,
  Encounter,
  FormSubmission,
  FormTemplate,
  PackageBalance,
  PackageRedemption,
  Patient,
  Profile,
  TreatmentConfirmation,
  PatientConsentStatus,
  PatientConsentWithDocument,
  PatientDocument,
  PatientMedicalHistory,
  PatientTag,
} from '@clinic/db/types';
import { APPOINTMENT_STATUS_TONES, type Locale } from '@clinic/domain';
import { PageHeader } from '@/components/app-shell';
import { PhoneActions } from '@/components/phone-actions';
import { PaymentAction } from '@/features/billing/payment-status';
import { toPaymentSummary } from '@/features/billing/payment-summary';
import { getClinicScope } from '@/lib/session';
import { logRecordAccess } from '@/lib/access-log';
import { ageFromDateOfBirth, appointmentTypeName, patientStatusTone } from '@/lib/display';
import { RegisterOpenFile } from '@/features/workspace/register-open-file';
import { PatientTabs } from '@/features/patients/patient-tabs';
import { PatientFormsPanel } from '@/features/forms/patient-forms-panel';
import { TreatmentConfirmationPanel } from '@/features/documents/treatment-confirmation-panel';
import { PackagesPanel } from '@/features/billing/packages-panel';
import { MedicalHistoryForm } from '@/features/patients/medical-history-form';
import { StartEncounterButton } from '@/features/encounters/start-encounter-button';
import { DocumentsPanel } from '@/features/documents/documents-panel';
import { ConsentPanel } from '@/features/consent/consent-panel';
import { PatientTags, type TagChip } from '@/features/patients/patient-tags';
import { ConfirmationBadge } from '@/features/appointments/confirmation-status';
import { confirmationState } from '@/features/appointments/confirmation';
import { formatDate, formatDateTime } from '@clinic/i18n';

type AppointmentRow = Appointment & {
  appointment_type: Pick<AppointmentType, 'name_he' | 'name_en'> | null;
};

/** Only what the questionnaire picker needs — not every template column. */
type FormTemplateOption = Pick<
  FormTemplate,
  'id' | 'title' | 'description' | 'fields' | 'version'
>;

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
  const tBilling = await getTranslations('billing');

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
    formTemplatesResult,
    formSubmissionsResult,
    confirmationsResult,
    practitionerResult,
    packagesResult,
    tagLinksResult,
    allTagsResult,
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
    // Only active questionnaires can be filled in. A retired one is retired so
    // it stops being offered — its past answers are still read below.
    scope.supabase
      .from('form_templates')
      .select('id, title, description, fields, version')
      .eq('is_active', true)
      .order('title', { ascending: true })
      .limit(200)
      .returns<FormTemplateOption[]>(),
    scope.supabase
      .from('form_submissions')
      .select('*')
      .eq('patient_id', id)
      .order('submitted_at', { ascending: false })
      .limit(200)
      .returns<FormSubmission[]>(),
    scope.supabase
      .from('treatment_confirmations')
      .select('*')
      .eq('patient_id', id)
      .order('issued_at', { ascending: false })
      .limit(50)
      .returns<TreatmentConfirmation[]>(),
    // Only to know whether a confirmation can be issued at all. Said before the
    // work rather than after it.
    scope.supabase
      .from('profiles')
      .select('full_name')
      .eq('id', scope.context.membership.user_id)
      .maybeSingle<Pick<Profile, 'full_name'>>(),
    // The balance comes from the view rather than being counted here, so this
    // page and the trigger that refuses an overdraw agree by construction.
    scope.supabase
      .from('package_balances')
      .select('*')
      .eq('patient_id', id)
      .order('purchased_on', { ascending: false })
      .returns<PackageBalance[]>(),
    scope.supabase
      .from('patient_tag_links')
      .select('tag:patient_tags(id, name, color)')
      .eq('patient_id', id)
      .returns<{ tag: TagChip | null }[]>(),
    scope.supabase
      .from('patient_tags')
      .select('id, name, color')
      .order('name', { ascending: true })
      .limit(500)
      .returns<Pick<PatientTag, 'id' | 'name' | 'color'>[]>(),
  ]);

  // Only this patient's cards. The table has no patient column, and a
  // clinic-wide fetch capped at 500 rows was silently the wrong 500 once the
  // practice had redeemed enough sessions for other people.
  const packageIds = (packagesResult.data ?? []).map((balance) => balance.package_id);
  const redemptionsResult =
    packageIds.length > 0
      ? await scope.supabase
          .from('package_redemptions')
          .select('*')
          .in('package_id', packageIds)
          .order('redeemed_on', { ascending: false })
          .returns<PackageRedemption[]>()
      : { data: [] as PackageRedemption[] };

  /*
   * Whether each booking has been paid for.
   *
   * The view counts an invoice raised against the treatment that came out of the
   * appointment, not only one raised against the booking itself — the visit is
   * what was paid for, and which of the two rows it was attached to is an
   * internal detail.
   */
  const [paymentResult, billingSettingsResult] = await Promise.all([
    scope.supabase
      .from('appointment_payment_status')
      .select('*')
      .eq('patient_id', id)
      .returns<AppointmentPaymentStatus[]>(),
    scope.supabase
      .from('clinic_payment_settings')
      .select('is_active')
      .maybeSingle<{ is_active: boolean }>(),
  ]);

  const appointmentPayments = new Map(
    (paymentResult.data ?? []).map((row) => [row.appointment_id, row]),
  );
  const canBill = billingSettingsResult.data?.is_active === true;

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
            {patient.phone ? <PhoneActions phone={patient.phone} /> : <Dash />}
          </DetailRow>
          <DetailRow label={t('fields.email')}>
            {patient.email ? (
              <a href={`mailto:${patient.email}`} dir="ltr" className="text-jade-800">
                {patient.email}
              </a>
            ) : (
              <Dash />
            )}
          </DetailRow>
          <DetailRow label={t('fields.dateOfBirth')}>
            {patient.date_of_birth ? (
              <span dir="ltr">
                {formatDate(new Date(patient.date_of_birth))}
                {age !== null ? ` · ${t('years', { count: age })}` : ''}
              </span>
            ) : (
              <Dash />
            )}
          </DetailRow>
          <DetailRow label={t('fields.nationalId')}>
            {patient.national_id ? (
              <span dir="ltr" className="tabular-nums">
                {patient.national_id}
              </span>
            ) : (
              <Dash />
            )}
          </DetailRow>
          <DetailRow label={t('fields.city')}>{patient.city ?? <Dash />}</DetailRow>
          <DetailRow label={t('fields.address')}>{patient.address ?? <Dash />}</DetailRow>
          <DetailRow label={t('fields.occupation')}>{patient.occupation ?? <Dash />}</DetailRow>
          <DetailRow label={t('fields.referralSource')}>{patient.referral_source ?? <Dash />}</DetailRow>
          <DetailRow label={t('fields.emergencyContactName')}>
            {patient.emergency_contact_name ?? <Dash />}
          </DetailRow>
          <DetailRow label={t('fields.emergencyContactPhone')}>
            {patient.emergency_contact_phone ? (
              <PhoneActions phone={patient.emergency_contact_phone} />
            ) : (
              <Dash />
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
      <EmptyState
        icon={<ClipboardList className="h-8 w-8" />}
        title={t('noEncounters')}
        action={<StartEncounterButton patientId={patient.id} />}
      />
    ) : (
      <TableWrapper responsive>
        <SortableTable defaultSortKey="date" defaultSortDirection="desc">
          <thead>
            <tr>
              <SortTh sortKey="date">{tc('date')}</SortTh>
              <SortTh sortKey="status">{tc('status')}</SortTh>
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
                {/* The date is the way in, as it is on the treatments page.
                    It used to be plain text with a separate "view" link at
                    the far end of the row — the one place in the app where
                    the thing you look at and the thing you click were
                    different cells. */}
                <Td>
                  <Link
                    href={`/encounters/${encounter.id}`}
                    className="font-medium text-jade-800 underline-offset-2 hover:underline"
                    dir="ltr"
                  >
                    {formatDate(new Date(encounter.encounter_date))}
                  </Link>
                </Td>
                <Td>
                  <Badge tone={encounter.status === 'signed' ? 'success' : 'warning'}>
                    {tEnc(`status.${encounter.status}`)}
                  </Badge>
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
      <TableWrapper responsive>
        <SortableTable defaultSortKey="date" defaultSortDirection="desc">
          <thead>
            <tr>
              <SortTh sortKey="date">{tc('date')}</SortTh>
              <SortTh sortKey="type">{tApp('type')}</SortTh>
              <SortTh sortKey="arrival">{tApp('confirmation.title')}</SortTh>
              <SortTh sortKey="status">{tc('status')}</SortTh>
              <SortTh sortKey="payment">{tBilling('title')}</SortTh>
            </tr>
          </thead>
          <SortBody locale={locale}>
            {appointments.map((appointment) => (
              <Tr
                key={appointment.id}
                sort={{
                  date: new Date(appointment.start_at).getTime(),
                  type: appointmentTypeName(appointment.appointment_type, locale as Locale),
                  arrival: tApp(`confirmation.${confirmationState(appointment)}`),
                  status: tApp(`status.${appointment.status}`),
                  payment: appointmentPayments.get(appointment.id)?.payment_state ?? 'unbilled',
                }}
              >
                <Td>
                  <span dir="ltr">
                    {formatDateTime(new Date(appointment.start_at))}
                  </span>
                </Td>
                <Td>
                  {appointmentTypeName(appointment.appointment_type, locale as Locale) || <Dash />}
                </Td>
                <Td>
                  <ConfirmationBadge appointment={appointment} />
                </Td>
                <Td>
                  <Badge tone={APPOINTMENT_STATUS_TONES[appointment.status]}>
                    {tApp(`status.${appointment.status}`)}
                  </Badge>
                </Td>
                <Td>
                  <PaymentAction
                    summary={toPaymentSummary(appointmentPayments.get(appointment.id))}
                    canBill={canBill}
                  />
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
            {/* One badge. There used to be two — an active flag and an outcome —
                which could contradict each other and, when they agreed, said the
                same thing twice. */}
            <Badge tone={patientStatusTone(patient.treatment_status)}>
              {t(`status.${patient.treatment_status ?? 'active'}`)}
            </Badge>
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
        // The labels the practitioner put on this file, each a link to
        // everyone else who carries it. A toolbar under the heading, in the
        // header's own slot for one, rather than pulled up with a negative margin.
        below={
          <PatientTags
            patientId={patient.id}
            tags={(tagLinksResult.data ?? []).flatMap((row) => (row.tag ? [row.tag] : []))}
            allTags={allTagsResult.data ?? []}
          />
        }
      />


      {/* Puts this file on the tab strip in the shell, which knows the URL
          but not whose name is on it. */}
      <RegisterOpenFile
        kind="patient"
        id={patient.id}
        label={patient.full_name}
        href={`/patients/${patient.id}`}
      />

      <PatientTabs
        overview={overview}
        encounters={encountersPanel}
        encounterCount={encounters.length}
        appointments={
          <div className="space-y-5">
            <PackagesPanel
              patientId={patient.id}
              balances={packagesResult.data ?? []}
              redemptions={redemptionsResult.data ?? []}
            />
            {appointmentsPanel}
          </div>
        }
        documents={
          <div className="space-y-5">
            <TreatmentConfirmationPanel
              patientId={patient.id}
              treatments={encounters.map((encounter) => ({
                id: encounter.id,
                date: encounter.encounter_date.slice(0, 10),
              }))}
              issued={confirmationsResult.data ?? []}
              practitionerReady={Boolean(practitionerResult.data?.full_name?.trim())}
            />
            <DocumentsPanel patientId={patient.id} documents={documents} />
          </div>
        }
        medical={<MedicalHistoryForm patientId={patient.id} history={history} />}
        forms={
          <PatientFormsPanel
            patientId={patient.id}
            templates={formTemplatesResult.data ?? []}
            submissions={formSubmissionsResult.data ?? []}
          />
        }
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
