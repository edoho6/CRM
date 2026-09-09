'use client';

import { useTranslations } from 'next-intl';
import { SegmentedControl } from '@clinic/ui';
import { usePathname, useRouter } from '@clinic/i18n/navigation';
import { useSearchParams } from 'next/navigation';

/**
 * How far back the report looks.
 *
 * Months rather than a date pair, because that is what the queries underneath
 * take — see `features/assistant/queries.ts`. A free date range would have to be
 * translated into months somewhere, and the honest place to stop is where the
 * data actually is.
 *
 * The state lives in the URL, like every other filter here: a report is a thing
 * you send to your accountant, and a link that reopens the same one is the
 * cheapest way to do that.
 */
// The values live in ./period, a plain module the server can read too; they
// are re-exported here for whoever already imports them from the filter.
import { DEFAULT_PERIOD, PERIODS, parsePeriod, type Period } from './period';

export { DEFAULT_PERIOD, PERIODS, parsePeriod, type Period };
/** Anything else in the URL — a typo, a hand-edit — falls back rather than errors. */

export function PeriodFilter({ current }: { current: Period }) {
  const t = useTranslations('reports');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function select(months: Period) {
    const params = new URLSearchParams(searchParams.toString());
    // The default is left out of the URL entirely, so the plain path is the
    // canonical link rather than one of two spellings of the same report.
    if (months === DEFAULT_PERIOD) params.delete('months');
    else params.set('months', String(months));

    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <SegmentedControl
      className="no-print"
      label={t('period')}
      size="md"
      value={String(current)}
      onChange={(next) => select(Number(next) as Period)}
      options={PERIODS.map((months) => ({
        value: String(months),
        label: t('lastMonths', { count: months }),
      }))}
    />
  );
}
