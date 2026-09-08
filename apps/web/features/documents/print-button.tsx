'use client';

import { useTranslations } from 'next-intl';
import { Printer } from 'lucide-react';
import { Button } from '@clinic/ui';

/**
 * The print button on a printable page.
 *
 * `.no-print` on itself, which is the whole trick: it has to be on the page to
 * be pressed and off the page once it has been.
 *
 * Its own component because `window.print` needs the browser, and the document
 * around it is a Server Component that reads from the database. One button is a
 * smaller client boundary than the page.
 */
export function PrintButton() {
  const t = useTranslations('confirmations.document');

  return (
    <div className="no-print flex justify-end">
      <Button type="button" variant="secondary" size="sm" onClick={() => window.print()}>
        <Printer className="h-4 w-4" />
        {t('print')}
      </Button>
    </div>
  );
}
