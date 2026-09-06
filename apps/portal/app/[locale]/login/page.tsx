import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Leaf } from 'lucide-react';
import { Card, CardBody } from '@clinic/ui';
import type { Locale } from '@clinic/domain';
import { PortalLoginForm } from './login-form';

export default async function PortalLoginPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('auth');
  const tc = await getTranslations('common');

  return (
    <main className="grid min-h-dvh place-items-center px-6 py-12">
      <div className="w-full max-w-sm space-y-5">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-jade-600 text-white">
            <Leaf className="h-5 w-5" />
          </span>
          <h1 className="text-lg font-semibold text-ink-900">{tc('appName')}</h1>
        </div>

        <Card>
          <CardBody className="space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-ink-900">{t('magicLinkTitle')}</h2>
              <p className="text-xs text-ink-500">{t('magicLinkSubtitle')}</p>
            </div>
            <PortalLoginForm locale={locale as Locale} />
          </CardBody>
        </Card>
      </div>
    </main>
  );
}
