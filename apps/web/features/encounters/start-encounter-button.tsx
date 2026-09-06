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
}: {
  patientId: string;
  appointmentId?: string | null;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md';
  label?: string;
}) {
  const t = useTranslations('encounters');
  const tc = useTranslations('common');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState(false);

  function handleClick() {
    setError(false);
    startTransition(async () => {
      const result = await startEncounter(patientId, appointmentId ?? null);
      if (!result.ok) {
        setError(true);
        return;
      }
      router.push(`/encounters/${(result.data as { id: string }).id}`);
      router.refresh();
    });
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button variant={variant} size={size} onClick={handleClick} disabled={isPending}>
        {isPending ? <Spinner /> : <Stethoscope className="h-4 w-4" />}
        {label ?? t('start')}
      </Button>
      {error ? <span className="text-xs text-red-600">{tc('errorGeneric')}</span> : null}
    </span>
  );
}
