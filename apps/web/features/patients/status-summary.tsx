'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@clinic/ui';
import { usePathname, useRouter } from '@clinic/i18n/navigation';
import { useSearchParams } from 'next/navigation';
import { TREATMENT_STATUSES, type TreatmentStatus } from '@clinic/domain';

export interface StatusCounts {
  byStatus: Record<TreatmentStatus, number>;
  active: number;
  inactive: number;
  total: number;
}

/**
 * How the practice stands, in numbers, above the list.
 *
 * Two rows because two different questions are being asked. The first is about
 * the diary — how many people are currently in treatment and how many are not.
 * The second is about outcomes, which is the question worth being able to answer
 * about your own practice and the one nobody can answer from a list of names:
 * how many courses finished well, how many partly, how many did not help, how
 * many people simply stopped coming.
 *
 * Every tile is also a filter. A number you cannot click is a number you have to
 * take on trust; clicking through to the eleven people it counts is what makes
 * it checkable.
 *
 * Counting is done in the query rather than here, so these are counts of the
 * whole practice and not of whichever page happens to be loaded.
 */
export function PatientStatusSummary({ counts }: { counts: StatusCounts }) {
  const t = useTranslations('patients');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentStatus = searchParams.get('status');
  const showingInactive = searchParams.get('inactive') === '1';

  function go(next: { status?: TreatmentStatus | null; inactive?: boolean }) {
    const params = new URLSearchParams(searchParams.toString());

    if (next.status) params.set('status', next.status);
    else params.delete('status');

    // Anything but "in treatment" describes a file that is by definition not
    // active, so asking for one has to widen the list past the active-only
    // default or it comes back empty.
    if (next.inactive || (next.status && next.status !== 'active')) params.set('inactive', '1');
    else params.delete('inactive');

    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }

  /* Outcomes only. "In treatment" and "not active" are the row above; repeating
     them here would make the two rows look like one broken total. */
  const outcomes = TREATMENT_STATUSES.filter(
    (status) => status !== 'active' && status !== 'inactive',
  );

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Tile
          label={t('status.active')}
          value={counts.active}
          tone="jade"
          active={currentStatus === 'active'}
          onClick={() => go({ status: 'active' })}
        />
        <Tile
          label={t('kpi.notActive')}
          value={counts.inactive}
          tone="ink"
          active={!currentStatus && showingInactive}
          onClick={() => go({ inactive: true })}
        />
        <Tile
          label={t('kpi.total')}
          value={counts.total}
          tone="ink"
          active={!currentStatus && !showingInactive}
          onClick={() => go({})}
        />
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {outcomes.map((status) => (
          <Tile
            key={status}
            label={t(`status.${status}`)}
            value={counts.byStatus[status] ?? 0}
            tone={status === 'full_success' ? 'jade' : status === 'unsuccessful' ? 'red' : 'ink'}
            active={currentStatus === status}
            onClick={() => go({ status })}
          />
        ))}
      </div>
    </div>
  );
}

/* Whole class strings per tone: Tailwind only sees classes written literally. */
const TONES = {
  jade: { value: 'text-jade-800', active: 'border-jade-500 bg-jade-50' },
  red: { value: 'text-red-700', active: 'border-red-600 bg-red-50' },
  ink: { value: 'text-ink-900', active: 'border-ink-400 bg-ink-100' },
} as const;

function Tile({
  label,
  value,
  tone,
  active,
  onClick,
}: {
  label: string;
  value: number;
  tone: keyof typeof TONES;
  active: boolean;
  onClick: () => void;
}) {
  const style = TONES[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded-lg border p-2.5 text-start transition-colors',
        active ? style.active : 'border-ink-200 bg-white hover:bg-ink-50',
      )}
    >
      <span dir="ltr" className={cn('block text-xl font-semibold tabular-nums', style.value)}>
        {value}
      </span>
      <span className="mt-0.5 block text-xs leading-tight text-ink-600">{label}</span>
    </button>
  );
}
