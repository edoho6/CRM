'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Alert, Button } from '@clinic/ui';

/**
 * The portal's error page. Big type and one button, because it is read on
 * a phone by someone who came to look at an appointment, not to debug.
 */
export default function PortalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const t = useTranslations('common');

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="grid min-h-dvh place-items-center px-6 py-12">
      <div className="w-full max-w-md space-y-4">
        <Alert tone="danger" title={t('errorTitle')}>
          {t('errorGeneric')}
        </Alert>
        <Button size="lg" className="w-full" onClick={retry}>
          {t('retry')}
        </Button>
      </div>
    </main>
  );
}
