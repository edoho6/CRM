'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Stethoscope } from 'lucide-react';
import { Button, Spinner } from '@clinic/ui';
import { useRouter } from '@clinic/i18n/navigation';
import { startEncounter } from './actions';

export function StartEncounterButton({
  patientId,
  appointmentId,
  variant = 'primary',
  size = 'md',
  label,
  onStarted,
}: {
  patientId: string;
  appointmentId?: string | null;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md';
  label?: string;
  /**
   * Called once the record exists, just before leaving for it. A dialog that
   * hosts this button closes itself here rather than being torn down mid-
   * navigation with its focus trap and scroll lock still in place.
   */
  onStarted?: () => void;
}) {
  const t = useTranslations('encounters');
  const tAll = useTranslations();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errorKey, setErrorKey] = useState<string | null>(null);

  function handleClick() {
    setErrorKey(null);
    startTransition(async () => {
      const result = await startEncounter(patientId, appointmentId ?? null);
      if (!result.ok) {
        setErrorKey(result.error.key);
        return;
      }
      onStarted?.();
      router.push(`/encounters/${result.data.id}`);
    });
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button type="button" variant={variant} size={size} onClick={handleClick} disabled={isPending}>
        {isPending ? <Spinner /> : <Stethoscope className="h-4 w-4" />}
        {label ?? t('start')}
      </Button>
      {/* The reason, not "something went wrong": the key is one of the
          catalogue's error messages, and the difference between "the record
          is locked" and "the server is down" is the difference between
          knowing what to do next and not. */}
      {errorKey ? (
        <span role="alert" className="text-xs text-red-600">
          {tAll.has(errorKey) ? tAll(errorKey) : tAll('common.errorGeneric')}
        </span>
      ) : null}
    </span>
  );
}
