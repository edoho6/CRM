import { ChevronRight } from 'lucide-react';
import { Link } from '@clinic/i18n/navigation';
import { formatDate } from '@clinic/i18n';
import { cn } from '@clinic/ui/cn';
import { getTranslations } from 'next-intl/server';

/**
 * Which treatment this is, and the way to the ones either side of it.
 *
 * "Session four of nine" is the thing a practitioner says out loud and the thing
 * the record never showed — the page knew the date and nothing about where the
 * date sat in a course of treatment.
 *
 * Numbered from the first visit forward, so the number does not change meaning
 * when another treatment is added later. Counting backwards from the most recent
 * would renumber every earlier record on every new visit, and "session four"
 * would stop being a thing you could write down.
 */

export interface EncounterStep {
  id: string;
  date: string;
}

export async function EncounterNav({
  encounterId,
  steps,
}: {
  encounterId: string;
  /** Every treatment for this patient, oldest first. */
  steps: EncounterStep[];
}) {
  const t = await getTranslations('encounters');

  const index = steps.findIndex((step) => step.id === encounterId);
  if (index < 0 || steps.length === 0) return null;

  // Oldest first, so the previous treatment is the one before in the array.
  const previous = steps[index - 1] ?? null;
  const next = steps[index + 1] ?? null;

  const arrow = (dir: 'prev' | 'next') =>
    cn(
      'h-4 w-4 shrink-0',
      // Previous is towards the start of the line: left in English, right in
      // Hebrew. The icon points right by default, so it is the English case
      // that needs turning.
      dir === 'prev' ? 'ltr:rotate-180' : 'rtl:rotate-180',
    );

  const linkClass =
    'inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-ink-700 transition-colors ' +
    'hover:bg-ink-100 hover:text-ink-900 focus-visible:outline-2 focus-visible:outline-offset-2 ' +
    'focus-visible:outline-focus';

  return (
    <nav aria-label={t('sessionNav')} className="no-print flex flex-wrap items-center gap-1">
      {previous ? (
        <Link href={`/encounters/${previous.id}`} className={linkClass}>
          <ChevronRight aria-hidden className={arrow('prev')} />
          <span dir="ltr" className="tabular-nums">
            {formatDate(previous.date)}
          </span>
        </Link>
      ) : (
        // A disabled-looking span rather than nothing, so the pair does not
        // shift sideways as you move through a course of treatment.
        <span className="px-2 py-1 text-sm text-ink-400" aria-hidden>
          —
        </span>
      )}

      <span className="rounded-md bg-ink-100 px-2 py-1 text-sm font-medium text-ink-800">
        {t('sessionNumber', { number: index + 1, total: steps.length })}
      </span>

      {next ? (
        <Link href={`/encounters/${next.id}`} className={linkClass}>
          <span dir="ltr" className="tabular-nums">
            {formatDate(next.date)}
          </span>
          <ChevronRight aria-hidden className={arrow('next')} />
        </Link>
      ) : (
        <span className="px-2 py-1 text-sm text-ink-400" aria-hidden>
          —
        </span>
      )}
    </nav>
  );
}
