'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@clinic/ui';
import { usePathname, useRouter } from '@clinic/i18n/navigation';
import { useSearchParams } from 'next/navigation';
import { TREATMENT_STATUSES } from '@clinic/domain';

/**
 * Filters the patient list by how the course of treatment stands.
 *
 * Chips rather than a dropdown: there are six, they are the whole set, and
 * seeing them all at once is what makes "how many people stopped partway" a
 * question you think to ask rather than one you have to go looking for.
 *
 * Writes to the URL and leaves every other parameter alone, so it composes with
 * the search box beside it.
 */
export function TreatmentStatusFilter({ className }: { className?: string }) {
  const t = useTranslations('patients');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const current = searchParams.get('status');

  function select(status: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (status) params.set('status', status);
    else params.delete('status');

    // Every status but 'active' describes a file that is, by definition, not
    // active — so asking for one has to widen the list past the active-only
    // default, or the filter would always come back empty.
    if (status && status !== 'active') params.set('inactive', '1');
    else params.delete('inactive');

    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <div
      role="group"
      aria-label={t('treatmentStatus')}
      className={cn('flex flex-wrap gap-1', className)}
    >
      <button
        type="button"
        aria-pressed={!current}
        onClick={() => select(null)}
        className={cn(
          'rounded-full px-3 py-1 text-xs font-medium transition-colors',
          !current
            ? 'bg-accent text-accent-fg'
            : 'border border-ink-200 bg-white text-ink-700 hover:bg-ink-50',
        )}
      >
        {t('allStatuses')}
      </button>

      {TREATMENT_STATUSES.map((status) => {
        const active = current === status;
        return (
          <button
            key={status}
            type="button"
            aria-pressed={active}
            onClick={() => select(status)}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-medium transition-colors',
              active
                ? 'bg-accent text-accent-fg'
                : 'border border-ink-200 bg-white text-ink-700 hover:bg-ink-50',
            )}
          >
            {t(`status.${status}`)}
          </button>
        );
      })}
    </div>
  );
}
