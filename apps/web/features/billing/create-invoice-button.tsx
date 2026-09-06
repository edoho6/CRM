'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Receipt } from 'lucide-react';
import { Button, Spinner } from '@clinic/ui';
import { useRouter } from '@clinic/i18n/navigation';
import { createInvoiceFromEncounter } from './actions';

/**
 * Turns a finished treatment into an invoice.
 *
 * Re-clicking is safe: the action reuses the existing draft for the encounter
 * rather than issuing a second bill for the same visit.
 */
export function CreateInvoiceButton({ encounterId }: { encounterId: string }) {
  const t = useTranslations('billing');
  const tc = useTranslations('common');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState(false);

  function handleClick() {
    setError(false);
    startTransition(async () => {
      const result = await createInvoiceFromEncounter(encounterId);
      if (!result.ok) {
        setError(true);
        return;
      }
      router.push(`/billing/${(result.data as { id: string }).id}`);
      router.refresh();
    });
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button variant="secondary" onClick={handleClick} disabled={isPending}>
        {isPending ? <Spinner /> : <Receipt className="h-4 w-4" />}
        {t('createFromEncounter')}
      </Button>
      {error ? <span className="text-xs text-red-600">{tc('errorGeneric')}</span> : null}
    </span>
  );
}
