import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import {
  BookOpen,
  Boxes,
  CalendarDays,
  ClipboardList,
  Leaf,
  Receipt,
  ShieldCheck,
  Smartphone,
  Tags,
  Users,
} from 'lucide-react';
import { Button } from '@clinic/ui';
import { Link } from '@clinic/i18n/navigation';
import { SiteFrame } from '../site-frame';

/**
 * What the product is, for someone who searched its name.
 *
 * One of the two pages a search engine is asked to index (app/robots.ts),
 * so it says in plain words what a clinic gets, and leads to sign-in and
 * sign-up.
 */

const FEATURES = [
  { key: 'patients', icon: Users },
  { key: 'calendar', icon: CalendarDays },
  { key: 'records', icon: ClipboardList },
  { key: 'herbs', icon: BookOpen },
  { key: 'inventory', icon: Boxes },
  { key: 'billing', icon: Receipt },
  { key: 'portal', icon: Smartphone },
  { key: 'prices', icon: Tags },
] as const;

const TRUST = ['isolation', 'audit', 'storage'] as const;

/**
 * The screens on the page, photographed from the sandbox clinic by
 * scripts/render-site-shots.mjs (fictional patients only). Sizes are the
 * files' own, so the page keeps their shape before they load.
 */
const DESKTOP_SHOT = { width: 1920, height: 1200 };
const PHONE_SHOT = { width: 780, height: 1560 };
const SCREENS = ['calendar', 'treatment', 'patient'] as const;
const PHONE_SCREENS = ['phoneDashboard', 'phoneCalendar'] as const;
const PHONE_FILES = { phoneDashboard: 'phone-dashboard', phoneCalendar: 'phone-calendar' } as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'site.meta' });
  return {
    // Absolute: the layout's template would append the product's name to a
    // title that already begins with it.
    title: { absolute: t('title') },
    description: t('description'),
    robots: { index: true, follow: true },
    alternates: { languages: { he: '/he/about', en: '/en/about' } },
    openGraph: {
      title: t('title'),
      description: t('description'),
      type: 'website',
      locale: locale === 'he' ? 'he_IL' : 'en_US',
      images: [
        {
          url: `/og/about-${locale === 'he' ? 'he' : 'en'}.png`,
          width: 1200,
          height: 630,
          alt: t('title'),
        },
      ],
    },
    twitter: { card: 'summary_large_image', title: t('title'), description: t('description') },
  };
}

export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('site');
  const tc = await getTranslations('common');

  return (
    <SiteFrame>
      <section className="py-10 text-center sm:py-16">
        {/* The mark, large, over the promise: the same leaf as the header
            and the home-screen icon, so the page and the app are one thing. */}
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-accent text-accent-fg shadow-md">
          <Leaf className="h-10 w-10" aria-hidden />
        </div>
        <p className="mt-3 text-lg font-semibold text-ink-900">{tc('appName')}</p>
        <h1 className="mt-4 text-3xl font-semibold text-ink-900 sm:text-4xl">{t('hero.title')}</h1>
        <p className="mx-auto mt-4 max-w-2xl text-base text-ink-700">{t('hero.body')}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/signup">{t('cta.signup')}</Link>
          </Button>
          <Button asChild size="lg" variant="secondary">
            <Link href="/login">{t('cta.login')}</Link>
          </Button>
        </div>
      </section>

      <section aria-labelledby="site-screens" className="mb-10">
        <h2 id="site-screens" className="text-center text-base font-semibold text-ink-900">
          {t('screens.title')}
        </h2>
        <figure className="mt-4 overflow-hidden rounded-card border border-ink-200 bg-white shadow-sm">
          <img
            src={`/site/dashboard-${locale}.webp`}
            width={DESKTOP_SHOT.width}
            height={DESKTOP_SHOT.height}
            alt={t('screens.dashboard')}
            decoding="async"
            className="block h-auto w-full"
          />
          <figcaption className="border-t border-ink-100 px-4 py-2 text-center text-sm text-ink-600">
            {t('screens.dashboard')}
          </figcaption>
        </figure>
        <ul className="mt-4 grid gap-4 sm:grid-cols-3">
          {SCREENS.map((key) => (
            <li key={key}>
              <figure className="overflow-hidden rounded-card border border-ink-200 bg-white shadow-sm">
                <img
                  src={`/site/${key}-${locale}.webp`}
                  width={DESKTOP_SHOT.width}
                  height={DESKTOP_SHOT.height}
                  alt={t(`screens.${key}`)}
                  loading="lazy"
                  decoding="async"
                  className="block h-auto w-full"
                />
                <figcaption className="border-t border-ink-100 px-3 py-2 text-center text-xs text-ink-600">
                  {t(`screens.${key}`)}
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>
        <ul className="mt-4 flex flex-wrap justify-center gap-4">
          {PHONE_SCREENS.map((key) => (
            <li key={key} className="w-56">
              <figure className="overflow-hidden rounded-card border border-ink-200 bg-white shadow-sm">
                <img
                  src={`/site/${PHONE_FILES[key]}-${locale}.webp`}
                  width={PHONE_SHOT.width}
                  height={PHONE_SHOT.height}
                  alt={t(`screens.${key}`)}
                  loading="lazy"
                  decoding="async"
                  className="block h-auto w-full"
                />
                <figcaption className="border-t border-ink-100 px-3 py-2 text-center text-xs text-ink-600">
                  {t(`screens.${key}`)}
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="site-features">
        <h2 id="site-features" className="sr-only">
          {t('features.title')}
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ key, icon: Icon }) => (
            <li key={key} className="rounded-card border border-ink-200 bg-white p-4">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-jade-100 text-jade-800">
                <Icon className="h-4 w-4" aria-hidden />
              </span>
              <h3 className="mt-3 text-base font-semibold text-ink-900">
                {t(`features.${key}.title`)}
              </h3>
              <p className="mt-1 text-sm text-ink-600">{t(`features.${key}.body`)}</p>
            </li>
          ))}
        </ul>
      </section>

      <section
        aria-labelledby="site-trust"
        className="mt-10 rounded-card border border-ink-200 bg-white p-6"
      >
        <h2
          id="site-trust"
          className="flex items-center gap-2 text-base font-semibold text-ink-900"
        >
          <ShieldCheck className="h-5 w-5 text-jade-800" aria-hidden />
          {t('trust.title')}
        </h2>
        <ul className="mt-3 grid gap-3 text-sm text-ink-700 sm:grid-cols-3">
          {TRUST.map((key) => (
            <li key={key}>{t(`trust.${key}`)}</li>
          ))}
        </ul>
      </section>
    </SiteFrame>
  );
}
