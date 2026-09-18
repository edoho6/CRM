import { cache } from 'react';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Leaf } from 'lucide-react';
import { Card, CardBody } from '@clinic/ui';
import { Link } from '@clinic/i18n/navigation';
import { tryCreateServerSupabase } from '@clinic/db/server';
import {
  BookingFlow,
  type BookingClinic,
  type BookingLocation,
  type BookingPractitioner,
  type BookingType,
} from './booking-flow';

const SLUG = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;

/** One read per request, shared by the tab title and the page. */
const loadBooking = cache(async (slug: string) => {
  const supabase = SLUG.test(slug) ? await tryCreateServerSupabase() : null;
  const { data } = supabase
    ? await supabase.rpc('booking_clinic', { p_slug: slug })
    : { data: null };
  return (data ?? null) as BookingPayload | null;
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const t = await getTranslations({ locale, namespace: 'booking' });
  const payload = await loadBooking(slug);
  return { title: payload ? `${t('pageTitle')} · ${payload.clinic.name}` : t('pageTitle') };
}

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
  const tSite = await getTranslations('site');

  const payload = await loadBooking(slug);

  const brand = (
    <div className="flex flex-col items-center gap-2 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-accent-fg">
        <Leaf className="h-5 w-5" aria-hidden />
      </span>
      <h1 className="text-xl font-semibold text-ink-900">
        {payload?.clinic.name ?? tc('appName')}
      </h1>
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
      {/* A public page owes its reader the accessibility statement. */}
      <p className="text-center text-xs">
        <Link
          href="/accessibility"
          className="text-ink-600 underline-offset-2 hover:text-ink-900 hover:underline"
        >
          {tSite('footer.accessibility')}
        </Link>
      </p>
    </div>
  );
}
