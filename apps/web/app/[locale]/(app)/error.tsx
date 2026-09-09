'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Alert, Button } from '@clinic/ui';

/**
 * Error boundary for the authenticated area.
 *
 * A failed query in one module must not blank the whole app. The message stays
 * generic on purpose: a raw database error can name tables and columns, which is
 * neither useful to a practitioner nor safe to show.
 *
 * `retry` rather than `reset`: reset only re-renders what is already in the
 * browser, so a page that failed on its data would fail the same way again.
 * Retry fetches it afresh.
 */
export default function AppError({
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
    <div className="mx-auto max-w-md py-16">
      <Alert tone="danger" title={t('errorTitle')}>
        {t('errorGeneric')}
      </Alert>
      <Button className="mt-4" onClick={retry}>
        {t('retry')}
      </Button>
    </div>
  );
}
