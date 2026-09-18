'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { defineWidget } from '@clinic/domain/widgets';
import { Link } from '@clinic/i18n/navigation';
import { Stat } from '@clinic/ui';
import { monthStartIn } from '@clinic/domain';
import { useAsyncData } from '@/lib/use-supabase';
import { useDashboardContext, useWidgetInitialData } from '../dashboard-context';
import { fetchRevenueStats, type RevenueStats } from '../queries/revenue';
import { registerWidget } from '../registry';
import { WidgetLoading, WidgetError } from '../widget-frame';

/**
 * Money this month: what came in, and what is still owed.
 *
 * Reads settled payments and open invoices directly, so the figure agrees with
 * the billing screen to the shekel rather than being a separately computed
 * estimate.
 */

function RevenueWidget() {
  const t = useTranslations('widgets.revenue');
  const format = useFormatter();

  const { timeZone } = useDashboardContext();
  const initial = useWidgetInitialData<RevenueStats>('revenue');
  const { data, loading, error, reload } = useAsyncData<RevenueStats>(
    (supabase) => fetchRevenueStats(supabase, monthStartIn(new Date(), timeZone).toISOString()),
    [timeZone],
    { initial },
  );

  if (loading) return <WidgetLoading />;
  if (error && !data) return <WidgetError onRetry={reload} />;

  return (
    <Link
      href="/billing"
      className="flex h-full flex-col justify-between gap-3 rounded-lg transition-colors hover:bg-ink-50/60"
    >
      <Stat
        size="lg"
        tone="accent"
        value={<span dir="ltr">{format.number(data?.collectedThisMonth ?? 0, 'currency')}</span>}
        label={t('collectedThisMonth')}
      />
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-ink-50 px-3 py-2">
          <p className="text-xs text-ink-600">{t('outstanding')}</p>
          <p className="text-sm font-semibold text-ink-800 tabular-nums" dir="ltr">
            {format.number(data?.outstanding ?? 0, 'currency')}
          </p>
        </div>
        <div className="rounded-lg bg-ink-50 px-3 py-2">
          <p className="text-xs text-ink-600">{t('invoicesThisMonth')}</p>
          <p className="text-sm font-semibold text-ink-800">{data?.invoicesThisMonth ?? 0}</p>
        </div>
      </div>
    </Link>
  );
}

registerWidget(
  defineWidget<Record<string, never>>({
    type: 'revenue',
    icon: 'Wallet',
    defaultSize: 'sm',
    allowedSizes: ['sm', 'md'],
    defaultConfig: {},
    component: RevenueWidget,
    singleton: true,
  }),
);
