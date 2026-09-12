import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Leaf } from 'lucide-react';
import { Alert, Card, CardBody } from '@clinic/ui';
import { Link } from '@clinic/i18n/navigation';
import type { Locale } from '@clinic/domain';
import { PortalLoginForm } from './login-form';

export default async function PortalLoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string; deleted?: string }>;
}) {
  const { locale } = await params;
  const { error, deleted } = await searchParams;
  setRequestLocale(locale);

  const t = await getTranslations('auth');
  const tc = await getTranslations('common');

  return (
    <main className="grid min-h-dvh place-items-center px-6 py-12">
      <div className="w-full max-w-sm space-y-5">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-accent-fg">
            <Leaf className="h-5 w-5" />
          </span>
          <h1 className="text-lg font-semibold text-ink-900">{tc('appName')}</h1>
        </div>

        {deleted ? (
          <Alert tone="success">
            {t('deletedNotice')}
          </Alert>
        ) : null}

        <Card>
          <CardBody className="space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-ink-900">{t('magicLinkTitle')}</h2>
              <p className="text-xs text-ink-500">{t('magicLinkSubtitle')}</p>
            </div>
            {/* `?error=expired` is where the magic-link landing sends a link
                that was opened twice or a day late. */}
            <PortalLoginForm locale={locale as Locale} expired={error === 'expired'} />
          </CardBody>
        </Card>

        {/* What signing in agrees to, readable before doing it. */}
        <p className="text-center text-xs leading-relaxed text-ink-500">
          {t.rich('legalLinks', {
            terms: (chunks) => (
              <Link href="/terms" className="underline underline-offset-2 hover:text-ink-900">
                {chunks}
              </Link>
            ),
            privacy: (chunks) => (
              <Link href="/privacy" className="underline underline-offset-2 hover:text-ink-900">
                {chunks}
              </Link>
            ),
          })}
        </p>
      </div>
    </main>
  );
}
