import { getTranslations } from 'next-intl/server';
import { Link } from '@clinic/i18n/navigation';
import { Button } from '@clinic/ui';

export default async function PortalLocaleNotFound() {
  const t = await getTranslations('errors');

  return (
    <main className="grid min-h-dvh place-items-center px-6 py-12">
      <div className="max-w-sm text-center">
        <p className="text-5xl font-semibold text-ink-300">404</p>
        <h1 className="mt-3 text-lg font-semibold text-ink-900">{t('notFound')}</h1>
        <p className="mt-1 text-sm text-ink-500">{t('notFoundBody')}</p>
        <Button asChild className="mt-5">
          <Link href="/">{t('backHome')}</Link>
        </Button>
      </div>
    </main>
  );
}
