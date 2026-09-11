import { redirect } from '@clinic/i18n/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { isSupabaseConfigured } from '@clinic/db';
import { Card, CardBody } from '@clinic/ui';
import type { Locale } from '@clinic/domain';
import { Leaf } from 'lucide-react';
import { LanguageSwitcher } from '@/components/language-switcher';
import { getMembershipContext } from '@/lib/session';
import { LoginForm } from './login-form';
import { Link } from '@clinic/i18n/navigation';
import { pageTitle } from '@/lib/page-title';

export const generateMetadata = pageTitle('auth', 'signInTitle');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ join?: string }>;
}) {
  const { locale } = await params;
  const { join } = await searchParams;
  setRequestLocale(locale);

  if (!isSupabaseConfigured()) {
    redirect({ href: '/setup', locale: locale as Locale });
  }

  // Already signed in — no reason to show a login form.
  const context = await getMembershipContext();
  if (context) {
    redirect({ href: '/', locale: locale as Locale });
  }

  const t = await getTranslations('auth');
  const tc = await getTranslations('common');
  const tSite = await getTranslations('site');

  return (
    <main className="grid min-h-dvh place-items-center bg-ink-50 px-6 py-12">
      <div className="w-full max-w-sm space-y-5">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-accent-fg">
            <Leaf className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-xl font-semibold text-ink-900">{tc('appName')}</h1>
            <p className="text-xs text-ink-500">{tc('appTagline')}</p>
            {/* For whoever arrived here from a search: what this is, first. */}
            <Link href="/about" className="mt-1 inline-block text-xs text-jade-800 underline-offset-2 hover:underline">
              {tSite('aboutLink')}
            </Link>
          </div>
        </div>

        <Card>
          <CardBody className="space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-ink-900">{t('signInTitle')}</h2>
              <p className="text-xs text-ink-500">{t('signInSubtitle')}</p>
            </div>
            <LoginForm locale={locale as Locale} joinToken={join && UUID.test(join) ? join : undefined} />
          </CardBody>
        </Card>

        <p className="text-center text-sm text-ink-600">
          {t('signup.noAccount')}{' '}
          <Link href="/signup" className="font-medium text-jade-800 underline-offset-2 hover:underline">
            {t('signup.createOne')}
          </Link>
        </p>

        <div className="flex justify-center">
          <LanguageSwitcher />
        </div>
      </div>
    </main>
  );
}
