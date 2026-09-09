'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Alert, Button } from '@clinic/ui';
import { Link } from '@clinic/i18n/navigation';

/**
 * The page shown when anything under the locale layout fails: sign-in, the
 * printed sheet, the public confirmation page, and the staff shell itself
 * when its layout throws — the one case the boundary inside `(app)` cannot
 * catch, because it sits below that layout.
 *
 * Generic on purpose. A raw error can name tables and columns, which is
 * neither useful to a practitioner nor safe to show; the detail goes to the
 * console for whoever is looking there.
 */
export default function LocaleError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const t = useTranslations('common');
  const tErrors = useTranslations('errors');

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="grid min-h-dvh place-items-center bg-ink-50 px-6 py-12">
      <div className="w-full max-w-md space-y-4">
        <Alert tone="danger" title={t('errorTitle')}>
          {t('errorGeneric')}
        </Alert>
        <div className="flex flex-wrap gap-2">
          <Button onClick={retry}>{t('retry')}</Button>
          <Button asChild variant="secondary">
            <Link href="/">{tErrors('backHome')}</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
