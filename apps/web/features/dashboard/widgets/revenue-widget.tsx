'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { defineWidget } from '@clinic/domain/widgets';
import { Link } from '@clinic/i18n/navigation';
import { useAsyncData } from '@/lib/use-supabase';
import { registerWidget } from '../registry';
import { WidgetLoading } from '../widget-frame';

/**
 * Money this month: what came in, and what is still owed.
 *
 * Reads settled payments and open invoices directly, so the figure agrees with
 * the billing screen to the shekel rather than being a separately computed
 * estimate.
 */

interface RevenueStats {
  collectedThisMonth: number;
  outstanding: number;
  invoicesThisMonth: number;
}

function RevenueWidget() {
  const t = useTranslations('widgets.revenue');
  const format = useFormatter();

  const { data, loading } = useAsyncData<RevenueStats>(async (supabase) => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const [paidResult, openResult, invoicesResult] = await Promise.all([
      supabase.from('payments').select('amount').eq('status', 'paid').gte('paid_at', monthStart),
      supabase
        .from('invoices')
        .select('total, amount_paid')
        .in('status', ['sent', 'partially_paid']),
      supabase
        .from('invoices')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', monthStart)
        .neq('status', 'cancelled'),
    ]);

    if (paidResult.error) throw new Error(paidResult.error.message);
    if (openResult.error) throw new Error(openResult.error.message);

    const collected = (paidResult.data ?? []).reduce(
      (sum, row) => sum + Number((row as { amount: number }).amount),
      0,
    );
    const outstanding = (openResult.data ?? []).reduce((sum, row) => {
      const invoice = row as { total: number; amount_paid: number };
      return sum + Math.max(0, Number(invoice.total) - Number(invoice.amount_paid));
    }, 0);

    return {
      collectedThisMonth: collected,
      outstanding,
      invoicesThisMonth: invoicesResult.count ?? 0,
    };
  });

  if (loading) return <WidgetLoading />;

  return (
    <Link href="/billing" className="flex h-full flex-col justify-between gap-3 rounded-lg transition-colors hover:bg-ink-50/60">
      <div>
        <p className="text-xs font-medium text-ink-500">{t('collectedThisMonth')}</p>
        <p className="mt-1 text-3xl font-semibold text-jade-800" dir="ltr">
          {format.number(data?.collectedThisMonth ?? 0, 'currency')}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-ink-50 px-3 py-2">
          <p className="text-[11px] text-ink-500">{t('outstanding')}</p>
          <p className="text-sm font-semibold text-ink-800" dir="ltr">
            {format.number(data?.outstanding ?? 0, 'currency')}
          </p>
        </div>
        <div className="rounded-lg bg-ink-50 px-3 py-2">
          <p className="text-[11px] text-ink-500">{t('invoicesThisMonth')}</p>
          <p className="text-sm font-semibold text-ink-800">{data?.invoicesThisMonth ?? 0}</p>
        </div>
      </div>
    </Link>
  );
}

registerWidget(
  defineWidget<Record<string, never>>({
    type: 'revenue',
    displayName: { he: 'הכנסות החודש', en: 'Revenue this month' },
    description: {
      he: 'תשלומים שנגבו החודש, ויתרות פתוחות בחשבוניות.',
      en: 'Payments collected this month, and what is still outstanding.',
    },
    icon: 'Wallet',
    defaultSize: 'sm',
    allowedSizes: ['sm', 'md'],
    defaultConfig: {},
    component: RevenueWidget,
    singleton: true,
  }),
);
