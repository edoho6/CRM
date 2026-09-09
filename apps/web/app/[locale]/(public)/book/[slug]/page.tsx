import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Leaf } from 'lucide-react';
import { Card, CardBody } from '@clinic/ui';
import { tryCreateServerSupabase } from '@clinic/db/server';
import {
  BookingFlow,
  type BookingClinic,
  type BookingLocation,
  type BookingPractitioner,
  type BookingType,
} from './booking-flow';

const SLUG = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;

interface BookingPayload {
  clinic: BookingClinic;
  types: BookingType[];
  practitioners: BookingPractitioner[];
  locations: BookingLocation[];
}

/**
 * The clinic's booking page: its name, its own words, and the flow.
 *
 * Reads through one token-checked function — the clinic's public handle is
 * the token — so there is no session to have and nothing on the page but
 * what the clinic chose to show.
 */
export default async function BookingPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('booking');
  const tc = await getTranslations('common');

  const supabase = SLUG.test(slug) ? await tryCreateServerSupabase() : null;
  const { data } = supabase ? await supabase.rpc('booking_clinic', { p_slug: slug }) : { data: null };
  const payload = (data ?? null) as BookingPayload | null;

  const brand = (
    <div className="flex flex-col items-center gap-2 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-accent-fg">
        <Leaf className="h-5 w-5" aria-hidden />
      </span>
      <h1 className="text-lg font-semibold text-ink-900">{payload?.clinic.name ?? tc('appName')}</h1>
    </div>
  );

  if (!payload) {
    return (
      <div className="space-y-5">
        {brand}
        <Card>
          <CardBody className="text-center text-sm text-ink-700">{t('notAvailable')}</CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {brand}
      {payload.clinic.intro ? (
        <p className="whitespace-pre-wrap text-center text-sm text-ink-700" dir="auto">
          {payload.clinic.intro}
        </p>
      ) : (
        <p className="text-center text-sm text-ink-700">{t('defaultIntro')}</p>
      )}
      <BookingFlow
        slug={slug}
        clinic={payload.clinic}
        types={payload.types}
        practitioners={payload.practitioners}
        locations={payload.locations}
      />
      {payload.clinic.phone || payload.clinic.address ? (
        <p className="text-center text-xs text-ink-600">
          {payload.clinic.address ? <span dir="auto">{payload.clinic.address}</span> : null}
          {payload.clinic.address && payload.clinic.phone ? ' · ' : ''}
          {payload.clinic.phone ? (
            <a href={`tel:${payload.clinic.phone}`} dir="ltr" className="font-medium text-jade-800">
              {payload.clinic.phone}
            </a>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
