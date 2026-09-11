import { redirect } from '@clinic/i18n/navigation';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import { CalendarDays, CalendarPlus, FileText, LogOut } from 'lucide-react';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  List,
  ListRow,
} from '@clinic/ui';
import { getCurrentUser, isSupabaseConfigured, tryCreateServerSupabase } from '@clinic/db';
import type { Appointment, AppointmentType, PatientDocument, Profile } from '@clinic/db/types';
import { APPOINTMENT_STATUS_TONES, statusTone, type Locale } from '@clinic/domain';
import { appointmentTypeName } from './appointment-name';
import { portalSignOut } from './login/actions';
import { PortalShell } from './portal-shell';
import { formatDate } from '@clinic/i18n';

// Everything here is one patient's own data; nothing may be cached at build time.
export const dynamic = 'force-dynamic';

type PortalAppointment = Appointment & {
  appointment_type: Pick<AppointmentType, 'name_he' | 'name_en'> | null;
  practitioner: Pick<Profile, 'id' | 'full_name'> | null;
};

/**
 * The patient's home: the next appointment first and large, because that
 * is the question they opened the portal with; the rest of the diary and
 * the documents as plain rows under it.
 */
export default async function PortalHomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('portal');
  const tc = await getTranslations('common');
  const tApp = await getTranslations('appointments');
  const format = await getFormatter();

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

  // Resolves through patient_portal_access; null means the invite was never claimed.
  const { data: patientId } = await supabase.rpc('current_patient_id');

  if (!patientId) {
    return (
      <main className="mx-auto max-w-lg space-y-4 px-6 py-16">
        <EmptyState
          icon={<CalendarDays className="h-8 w-8" />}
          title={t('notLinked')}
          description={t('clinicContact')}
        />
        <form action={portalSignOut} className="flex justify-center">
          <Button type="submit" variant="secondary">
            <LogOut className="h-4 w-4" aria-hidden />
            {t('signOut')}
          </Button>
        </form>
      </main>
    );
  }

  const nowIso = new Date().toISOString();

  const [appointmentsResult, documentsResult, patientResult] = await Promise.all([
    supabase
      .from('appointments')
      .select(
        '*, appointment_type:appointment_types(name_he, name_en), practitioner:profiles(id, full_name)',
      )
      .gte('start_at', nowIso)
      .neq('status', 'cancelled')
      .order('start_at', { ascending: true })
      .limit(20)
      .returns<PortalAppointment[]>(),
    supabase
      .from('patient_documents')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
      .returns<PatientDocument[]>(),
    supabase.from('patients').select('first_name, last_name').maybeSingle<{
      first_name: string;
      last_name: string;
    }>(),
  ]);

  const appointments = appointmentsResult.data ?? [];
  const documents = documentsResult.data ?? [];
  const name = patientResult.data
    ? `${patientResult.data.first_name} ${patientResult.data.last_name}`
    : '';
  const [next, ...later] = appointments;

  const describe = (appointment: PortalAppointment) =>
    [
      appointmentTypeName(appointment.appointment_type, locale as Locale),
      appointment.practitioner?.full_name
        ? t('appointmentWith', { practitioner: appointment.practitioner.full_name })
        : null,
    ]
      .filter(Boolean)
      .join(' · ');

  return (
    <PortalShell current="home" title={t('welcome', { name })}>
      {/* The next appointment, as a card you can read from across the room:
          the day and the hour large, the rest in a line, and the two things
          a phone does with an appointment. */}
      <Card>
        <CardHeader>
          <CardTitle>{t('nextAppointment')}</CardTitle>
        </CardHeader>
        <CardBody>
          {!next ? (
            <EmptyState
              icon={<CalendarDays className="h-7 w-7" />}
              title={t('noAppointments')}
              className="border-0 bg-transparent py-4"
            />
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg bg-jade-50 p-4 text-center">
                <p className="text-2xl font-semibold text-ink-900" dir="ltr">
                  {format.dateTime(new Date(next.start_at), 'weekday')}
                </p>
                <p className="text-3xl font-semibold text-jade-800 tabular-nums" dir="ltr">
                  {format.dateTime(new Date(next.start_at), 'time')}
                </p>
                <p className="mt-2 text-sm text-ink-700">{describe(next)}</p>
                <div className="mt-2">
                  <Badge tone={statusTone(APPOINTMENT_STATUS_TONES, next.status)}>
                    {tApp(`status.${next.status}`)}
                  </Badge>
                </div>
              </div>
              <Button asChild variant="secondary" size="lg" className="w-full">
                <a href={`/api/appointments/${next.id}/ics`}>
                  <CalendarPlus className="h-5 w-5" aria-hidden />
                  {t('addToCalendar')}
                </a>
              </Button>
            </div>
          )}
        </CardBody>
      </Card>

      {later.length > 0 ? (
        <section aria-labelledby="portal-more" className="space-y-2">
          <h2 id="portal-more" className="text-base font-semibold text-ink-900">
            {t('moreAppointments')}
          </h2>
          <List>
            {later.map((appointment) => (
              <ListRow
                key={appointment.id}
                leading={<CalendarDays className="h-5 w-5" aria-hidden />}
                title={
                  <span dir="ltr">
                    {format.dateTime(new Date(appointment.start_at), 'weekday')}
                    {' · '}
                    {format.dateTime(new Date(appointment.start_at), 'time')}
                  </span>
                }
                description={describe(appointment)}
                trailing={
                  <Badge tone={statusTone(APPOINTMENT_STATUS_TONES, appointment.status)}>
                    {tApp(`status.${appointment.status}`)}
                  </Badge>
                }
              />
            ))}
          </List>
        </section>
      ) : null}

      <section aria-labelledby="portal-documents" className="space-y-2">
        <h2 id="portal-documents" className="text-base font-semibold text-ink-900">
          {t('myDocuments')}
        </h2>
        {documents.length === 0 ? (
          <EmptyState icon={<FileText className="h-7 w-7" />} title={t('noDocuments')} />
        ) : (
          <List>
            {documents.map((document) => (
              <ListRow
                key={document.id}
                asChild
                chevron
                leading={<FileText className="h-5 w-5" aria-hidden />}
                title={document.file_name}
                description={
                  <span dir="ltr">{formatDate(new Date(document.created_at))}</span>
                }
              >
                {/* Opened in place rather than downloaded: a phone shows a PDF
                    on the spot, and "download" leaves a file nobody finds. */}
                <a href={`/api/documents/${document.id}?inline=1`} target="_blank" rel="noreferrer" />
              </ListRow>
            ))}
          </List>
        )}
      </section>
    </PortalShell>
  );
}
