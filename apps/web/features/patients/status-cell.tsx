'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Check } from 'lucide-react';
import { Spinner } from '@clinic/ui';
import { cn } from '@clinic/ui/cn';
import { TREATMENT_STATUSES, type TreatmentStatus } from '@clinic/domain';
import { useRouter } from '@clinic/i18n/navigation';
import { setPatientStatus } from './actions';

/**
 * The patient's status, changed from the row it is on.
 *
 * Marking someone as having finished a course of treatment is a five-second
 * thought that used to cost a page load, an edit form, a save and a trip back to
 * the list. Done that way it does not get done, and the list slowly fills with
 * people who stopped coming two years ago.
 *
 * A plain `<select>` rather than a custom menu: it is fully accessible, it opens
 * as the platform's own control on a phone, it flips direction with the page,
 * and — the reason that matters here — the browser renders its list above
 * everything, so it can never be clipped by the scrolling table around it.
 */
export function PatientStatusCell({
  patientId,
  status,
}: {
  patientId: string;
  status: TreatmentStatus | null;
}) {
  const t = useTranslations('patients');
  const router = useRouter();
  const [value, setValue] = useState<TreatmentStatus>(status ?? 'active');
  const [saved, setSaved] = useState(false);
  const [failed, setFailed] = useState(false);
  const [isPending, startTransition] = useTransition();

  function change(next: TreatmentStatus) {
    const previous = value;
    // Optimistic: the select shows the new value immediately, and rolls back if
    // the write fails, so a dropped connection cannot leave the screen claiming
    // something the database never accepted.
    setValue(next);
    setFailed(false);

    startTransition(async () => {
      const result = await setPatientStatus(patientId, next);
      if (!result.ok) {
        setValue(previous);
        setFailed(true);
        return;
      }
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1500);
      // Refresh because the row may now fall outside the active-only filter.
      router.refresh();
    });
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <select
        value={value}
        disabled={isPending}
        aria-label={t('treatmentStatus')}
        aria-invalid={failed || undefined}
        onChange={(event) => change(event.target.value as TreatmentStatus)}
        className={cn(
          // Quiet at rest — fifty identical boxes down a list read as clutter,
          // so the control is bare text until the pointer or focus reaches it,
          // where it becomes a plain bordered select again.
          'ui-select h-8 max-w-[min(11rem,100%)] rounded-md border px-2 pe-7 text-base sm:text-sm',
          'hover:bg-white hover:text-ink-900 hover:shadow-xs',
          'focus-visible:bg-white focus-visible:text-ink-900 focus-visible:shadow-xs focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-focus focus-visible:border-focus disabled:bg-ink-50',
          failed
            ? 'border-red-600 bg-white text-ink-900'
            : 'border-transparent bg-transparent text-ink-700 hover:border-ink-200 focus-visible:border-focus',
        )}
      >
        {TREATMENT_STATUSES.map((option) => (
          <option key={option} value={option}>
            {t(`status.${option}`)}
          </option>
        ))}
      </select>

      {/* Neither state is colour alone: the spinner and the tick are shapes, and
          a failure also puts the message below into the live region. */}
      {isPending ? <Spinner className="h-3.5 w-3.5 text-ink-500" /> : null}
      {saved && !isPending ? <Check className="h-4 w-4 text-jade-700" aria-hidden /> : null}
      {failed ? (
        <span role="alert" className="text-xs text-red-700">
          {t('statusSaveFailed')}
        </span>
      ) : null}
    </span>
  );
}
