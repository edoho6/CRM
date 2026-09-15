import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { TreatmentConfirmation } from '@clinic/db/types';
import { getClinicScope } from '@/lib/session';
import { logRecordAccess } from '@/lib/access-log';
import { PrintButton } from '@/features/documents/print-button';
import { formatDate } from '@clinic/i18n';

/**
 * The treatment confirmation, as the patient hands it to their health fund.
 *
 * Everything is read from the confirmation row and nothing is looked up fresh.
 * That is deliberate and is the point of storing the details at all: reprinting
 * a document issued in March must produce the March document, not a new one
 * built from today's records.
 *
 * The footer disclaiming it as a tax document is not boilerplate. A page listing
 * a practitioner, a patient and a list of dates looks enough like a receipt that
 * somebody will eventually try to use it as one, and it is not issued from a
 * system that meets the bookkeeping regulations.
 */
export default async function ConfirmationPrintPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('confirmations.document');

  const scope = await getClinicScope();
  if (!scope) return null;

  const { data: confirmation } = await scope.supabase
    .from('treatment_confirmations')
    .select('*')
    .eq('id', id)
    .maybeSingle<TreatmentConfirmation>();

  if (!confirmation) notFound();

  // Named patient, named practitioner, dates of treatment — and printed to be
  // handed to a third party. An export, like the prescription.
  await logRecordAccess(scope.supabase, 'treatment_confirmations', id, 'export');

  const clinic = scope.context.clinic;

  const practitionerLine = [confirmation.practitioner_name, confirmation.practitioner_title]
    .filter(Boolean)
    .join(' · ');

  return (
    <article className="space-y-6">
      <PrintButton />

      <header className="border-b border-ink-300 pb-4">
        <h1 className="text-xl font-semibold">{clinic.name}</h1>
        <p className="mt-0.5 text-sm text-ink-600">
          {[clinic.address, clinic.phone].filter(Boolean).join(' · ')}
        </p>
        {clinic.tax_id ? (
          <p className="text-sm text-ink-600">
            {t('taxId')}: <span dir="ltr">{clinic.tax_id}</span>
          </p>
        ) : null}
      </header>

      <div>
        <h2 className="text-lg font-semibold">{t('heading')}</h2>
        <p className="mt-0.5 text-sm text-ink-600">
          {t('issuedOn', {
            date: formatDate(new Date(confirmation.issued_at)),
          })}
        </p>
      </div>

      {/* The attestation itself, as one sentence. Assembled from the stored
          values rather than from a template with holes, so a missing ID number
          reads as an absence rather than as an empty bracket. */}
      <p className="text-base leading-relaxed" dir="auto">
        {t('statement', {
          practitioner: practitionerLine,
          practitionerId: confirmation.practitioner_national_id ?? '—',
          patient: confirmation.patient_name,
          patientId: confirmation.patient_national_id ?? '—',
        })}
      </p>

      {confirmation.practitioner_license ? (
        <p className="text-sm text-ink-700">
          {t('license')}: <span dir="ltr">{confirmation.practitioner_license}</span>
        </p>
      ) : null}

      <section>
        <h3 className="mb-2 text-sm font-semibold text-ink-900">
          {t('datesHeading', { count: confirmation.treatment_dates.length })}
        </h3>
        {/* A plain list in columns rather than a table: it is one column of
            data, and a table of one column is furniture around a list. */}
        <ul className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-3">
          {confirmation.treatment_dates.map((date) => (
            <li key={date} dir="ltr" className="tabular-nums text-sm">
              {formatDate(new Date(date))}
            </li>
          ))}
        </ul>
      </section>

      {confirmation.purpose ? (
        <p className="text-sm text-ink-700" dir="auto">
          {t('purpose')}: {confirmation.purpose}
        </p>
      ) : null}

      <section className="pt-8">
        <div className="w-64 border-t border-ink-400 pt-1">
          <p className="text-sm">{confirmation.practitioner_name}</p>
          <p className="text-xs text-ink-600">{t('signature')}</p>
        </div>
      </section>

      <footer className="border-t border-ink-200 pt-3 text-xs text-ink-600">
        {t('disclaimer')}
      </footer>
    </article>
  );
}
