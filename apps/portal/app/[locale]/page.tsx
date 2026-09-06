import { redirect } from '@clinic/i18n/navigation';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import { CalendarDays, Download, FileText, LogOut } from 'lucide-react';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
} from '@clinic/ui';
import { getCurrentUser, isSupabaseConfigured, tryCreateServerSupabase } from '@clinic/db';
import type { Appointment, AppointmentType, PatientDocument, Profile } from '@clinic/db/types';
import type { Locale } from '@clinic/domain';
import { appointmentTypeName } from './appointment-name';
import { portalSignOut } from './login/actions';

// Everything here is one patient's own data; nothing may be cached at build time.
export const dynamic = 'force-dynamic';

type PortalAppointment = Appointment & {
  appointment_type: Pick<AppointmentType, 'name_he' | 'name_en'> | null;
  practitioner: Pick<Profile, 'id' | 'full_name'> | null;
};

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
        <Alert tone="info">{t('notLinked')}</Alert>
        <form action={portalSignOut}>
          <Button type="submit" variant="secondary" size="sm">
            <LogOut className="h-4 w-4" />
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

  return (
    <main className="mx-auto max-w-2xl space-y-5 px-4 py-8 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-ink-900">{t('welcome', { name })}</h1>
        <form action={portalSignOut}>
          <Button type="submit" variant="ghost" size="sm">
            <LogOut className="h-4 w-4" />
            {t('signOut')}
          </Button>
        </form>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>{t('myAppointments')}</CardTitle>
        </CardHeader>
        <CardBody className={appointments.length === 0 ? undefined : 'p-0'}>
          {appointments.length === 0 ? (
            <EmptyState
              icon={<CalendarDays className="h-7 w-7" />}
              title={t('noAppointments')}
              className="border-0 bg-transparent py-4"
            />
          ) : (
            <ul className="divide-y divide-ink-100">
              {appointments.map((appointment) => (
                <li key={appointment.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink-900" dir="ltr">
                      {format.dateTime(new Date(appointment.start_at), 'weekday')}
                      {' · '}
                      {format.dateTime(new Date(appointment.start_at), 'time')}
                    </p>
                    <p className="truncate text-xs text-ink-500">
                      {appointmentTypeName(appointment.appointment_type, locale as Locale)}
                      {appointment.practitioner?.full_name
                        ? ` · ${t('appointmentWith', { practitioner: appointment.practitioner.full_name })}`
                        : ''}
                    </p>
                  </div>
                  <Badge tone={appointment.status === 'confirmed' ? 'success' : 'neutral'}>
                    {tApp(`status.${appointment.status}`)}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('myDocuments')}</CardTitle>
        </CardHeader>
        <CardBody className={documents.length === 0 ? undefined : 'p-0'}>
          {documents.length === 0 ? (
            <EmptyState
              icon={<FileText className="h-7 w-7" />}
              title={t('noDocuments')}
              className="border-0 bg-transparent py-4"
            />
          ) : (
            <ul className="divide-y divide-ink-100">
              {documents.map((document) => (
                <li key={document.id}>
                  <a
                    href={`/api/documents/${document.id}`}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-ink-50"
                  >
                    <FileText className="h-4 w-4 shrink-0 text-ink-400" aria-hidden />
                    <span className="min-w-0 flex-1 truncate text-sm text-ink-800">
                      {document.file_name}
                    </span>
                    <span className="shrink-0 text-xs text-ink-500" dir="ltr">
                      {format.dateTime(new Date(document.created_at), 'short')}
                    </span>
                    <Download className="h-4 w-4 shrink-0 text-ink-400" aria-hidden />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </main>
  );
}
