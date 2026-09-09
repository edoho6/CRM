import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Leaf } from 'lucide-react';
import { Card, CardBody } from '@clinic/ui';
import { tryCreateServerSupabase } from '@clinic/db/server';
import type { Locale } from '@clinic/domain';
import { formatDate, formatTime } from '@clinic/i18n';
import { appointmentTypeName } from '@/lib/display';
import { RespondForm } from './respond-form';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface TokenRow {
  start_at: string;
  end_at: string;
  status: string;
  confirmation_response: 'confirmed' | 'declined' | null;
  clinic_name: string;
  clinic_phone: string | null;
  clinic_address: string | null;
  practitioner_name: string | null;
  patient_first_name: string;
  type_name_he: string | null;
  type_name_en: string | null;
  room_name: string | null;
}

/**
 * The page behind the reminder link.
 *
 * Reads through a token-checked function rather than a table, so there is no
 * session to have and nothing to see but this one appointment: the day, the
 * hour, the clinic, and the patient's first name so they know it is theirs.
 */
export default async function ConfirmPage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('confirm');
  const tc = await getTranslations('common');

  const supabase = UUID.test(token) ? await tryCreateServerSupabase() : null;
  const { data } = supabase
    ? await supabase.rpc('appointment_by_token', { p_token: token })
    : { data: null };
  const row = (Array.isArray(data) ? data[0] : null) as TokenRow | undefined;

  const brand = (
    <div className="flex flex-col items-center gap-2 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-accent-fg">
        <Leaf className="h-5 w-5" aria-hidden />
      </span>
      <h1 className="text-lg font-semibold text-ink-900">{row?.clinic_name ?? tc('appName')}</h1>
    </div>
  );

  if (!row) {
    return (
      <div className="space-y-5">
        {brand}
        <Card>
          <CardBody className="text-center text-sm text-ink-700">{t('expired')}</CardBody>
        </Card>
      </div>
    );
  }

  const cancelled = row.status === 'cancelled';
  const typeName = appointmentTypeName(
    { name_he: row.type_name_he, name_en: row.type_name_en },
    locale as Locale,
  );

  return (
    <div className="space-y-5">
      {brand}
      <Card>
        <CardBody className="space-y-4">
          <p className="text-base text-ink-800">{t('greeting', { name: row.patient_first_name })}</p>

          <div className="rounded-lg border border-ink-200 bg-ink-50 p-4 text-center">
            <p className="text-xs text-ink-600">{t('youHave')}</p>
            <p className="mt-1 text-2xl font-semibold text-ink-900" dir="ltr">
              {formatDate(row.start_at)}
            </p>
            <p className="text-xl font-semibold text-ink-900" dir="ltr">
              {formatTime(row.start_at)}
            </p>
            <p className="mt-2 text-sm text-ink-700">
              {[typeName, row.practitioner_name, row.room_name].filter(Boolean).join(' · ')}
            </p>
            {row.clinic_address ? (
              <p className="mt-1 text-xs text-ink-600" dir="auto">
                {row.clinic_address}
              </p>
            ) : null}
          </div>

          {cancelled ? (
            <p className="text-center text-sm text-red-700">{t('cancelled')}</p>
          ) : (
            <RespondForm token={token} current={row.confirmation_response} />
          )}

          {row.clinic_phone ? (
            <p className="text-center text-xs text-ink-600">
              {t('questions')}{' '}
              <a href={`tel:${row.clinic_phone}`} dir="ltr" className="font-medium text-jade-800">
                {row.clinic_phone}
              </a>
            </p>
          ) : null}
        </CardBody>
      </Card>
    </div>
  );
}
