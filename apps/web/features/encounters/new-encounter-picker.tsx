'use client';

import { useMemo, useState, useTransition } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { Stethoscope } from 'lucide-react';
import { Alert, Button, Card, CardBody, Combobox, Spinner, type ComboboxOption, type ComboboxValue } from '@clinic/ui';
import { useRouter } from '@clinic/i18n/navigation';
import { startEncounter } from './actions';

export interface TodayVisit {
  appointmentId: string;
  patientId: string;
  patientName: string;
  startAt: string;
}

/**
 * A new treatment, before it knows whose.
 *
 * Two ways to the same place. Today's bookings are listed first, because on
 * a working day that is who is in the chair; one tap opens their record
 * against that booking. Under them, a search over every active patient for
 * the walk-in and the phone consultation.
 */
export function NewEncounterPicker({
  patients,
  today,
}: {
  patients: { id: string; full_name: string; phone: string | null }[];
  today: TodayVisit[];
}) {
  const t = useTranslations('encounters.newPicker');
  const tEnc = useTranslations('encounters');
  const tAll = useTranslations();
  const format = useFormatter();
  const router = useRouter();
  const [choice, setChoice] = useState<ComboboxValue | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const options: ComboboxOption[] = useMemo(
    () =>
      patients.map((patient) => ({
        id: patient.id,
        label: patient.full_name,
        // Searchable by number, not shown: two people can share a name.
        keywords: patient.phone ?? undefined,
      })),
    [patients],
  );

  function open(patientId: string, appointmentId: string | null) {
    setErrorKey(null);
    startTransition(async () => {
      const result = await startEncounter(patientId, appointmentId);
      if (!result.ok) {
        setErrorKey(result.error.key);
        return;
      }
      router.push(`/encounters/${result.data.id}`);
    });
  }

  return (
    <div className="space-y-5">
      {errorKey ? (
        <Alert tone="danger">
          {tAll.has(errorKey) ? tAll(errorKey) : tAll('common.errorGeneric')}
        </Alert>
      ) : null}

      {today.length > 0 ? (
        <section aria-labelledby="new-encounter-today" className="space-y-2">
          <h2 id="new-encounter-today" className="text-sm font-semibold text-ink-900">
            {t('today')}
          </h2>
          <ul className="divide-y divide-ink-100 rounded-lg border border-ink-200 bg-white">
            {today.map((visit) => (
              <li key={visit.appointmentId}>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => open(visit.patientId, visit.appointmentId)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-start hover:bg-ink-50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus"
                >
                  <span dir="ltr" className="w-12 shrink-0 text-sm font-semibold tabular-nums text-ink-800">
                    {format.dateTime(new Date(visit.startAt), 'time')}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-base text-ink-900">
                    {visit.patientName}
                  </span>
                  <Stethoscope className="h-4 w-4 shrink-0 text-jade-700" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="new-encounter-search" className="space-y-2">
        <h2 id="new-encounter-search" className="text-sm font-semibold text-ink-900">
          {t('anyPatient')}
        </h2>
        <Card>
          <CardBody className="space-y-3">
            <Combobox
              label={t('searchLabel')}
              placeholder={t('searchPlaceholder')}
              options={options}
              value={choice}
              onChange={setChoice}
            />
            <div className="flex justify-end">
              <Button
                type="button"
                disabled={isPending || !choice?.id}
                onClick={() => choice?.id && open(choice.id, null)}
              >
                {isPending ? <Spinner /> : <Stethoscope className="h-4 w-4" aria-hidden />}
                {tEnc('start')}
              </Button>
            </div>
          </CardBody>
        </Card>
        <p className="text-xs text-ink-500">{t('hint')}</p>
      </section>
    </div>
  );
}
