import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import {
  BookOpen,
  Boxes,
  CalendarDays,
  ClipboardList,
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

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
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
      images: [{ url: `/og/about-${locale === 'he' ? 'he' : 'en'}.png`, width: 1200, height: 630, alt: t('title') }],
    },
    twitter: { card: 'summary_large_image', title: t('title'), description: t('description') },
  };
}

export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('site');

  return (
    <SiteFrame>
      <section className="py-10 text-center sm:py-16">
        <h1 className="text-3xl font-semibold text-ink-900 sm:text-4xl">{t('hero.title')}</h1>
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
              <h3 className="mt-3 text-base font-semibold text-ink-900">{t(`features.${key}.title`)}</h3>
              <p className="mt-1 text-sm text-ink-600">{t(`features.${key}.body`)}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="site-trust" className="mt-10 rounded-card border border-ink-200 bg-white p-6">
        <h2 id="site-trust" className="flex items-center gap-2 text-base font-semibold text-ink-900">
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
