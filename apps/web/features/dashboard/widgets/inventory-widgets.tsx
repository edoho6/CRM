'use client';

import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { AlertTriangle } from 'lucide-react';
import { Badge } from '@clinic/ui';
import { defineWidget } from '@clinic/domain/widgets';
import type { Locale } from '@clinic/domain';
import type { HerbStockLevel } from '@clinic/db/types';
import { Link } from '@clinic/i18n/navigation';
import { useAsyncData } from '@/lib/use-supabase';
import { useWidgetInitialData } from '../dashboard-context';
import { fetchLowStock } from '../queries/low-stock';
import { herbPrimaryName, herbSecondaryName } from '@/lib/display';
import { registerWidget } from '../registry';
import { WidgetEmpty, WidgetLoading } from '../widget-frame';

/**
 * Low-stock widget.
 *
 * Reads the `herb_stock_levels` view, which already compares the summed remaining
 * quantity against each herb's reorder threshold — so "what needs ordering" is one
 * query rather than a client-side reduce over every batch.
 */
function LowStockWidget() {
  const t = useTranslations('widgets.lowStock');
  const tUnit = useTranslations('inventory.unit');
  const locale = useLocale() as Locale;
  const format = useFormatter();

  const initial = useWidgetInitialData<HerbStockLevel[]>('low-stock');
  const { data, loading } = useAsyncData<HerbStockLevel[]>(fetchLowStock, [], { initial });

  if (loading) return <WidgetLoading />;

  const rows = data ?? [];
  if (rows.length === 0) {
    return <WidgetEmpty>{t('empty')}</WidgetEmpty>;
  }

  return (
    <ul className="divide-y divide-ink-100">
      {rows.map((row) => {
        const isOut = Number(row.total_remaining) <= 0;
        return (
          <li key={row.herb_id}>
            <Link
              href={`/reference/herbs/${row.herb_id}`}
              className="flex items-center gap-2 py-2 transition-colors hover:bg-ink-50"
            >
              <AlertTriangle
                className={
                  isOut ? 'h-4 w-4 shrink-0 text-red-500' : 'h-4 w-4 shrink-0 text-amber-500'
                }
                aria-hidden
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-ink-900">
                  {herbPrimaryName(row, locale)}
                </span>
                <span className="block truncate text-xs text-ink-500" dir="ltr">
                  {herbSecondaryName(row, locale)}
                </span>
              </span>
              {isOut ? (
                <Badge tone="danger">{t('outOfStock')}</Badge>
              ) : (
                <span className="shrink-0 text-xs text-ink-600 tabular-nums">
                  {format.number(Number(row.total_remaining))} {tUnit(row.default_unit)}
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

registerWidget(
  defineWidget<Record<string, never>>({
    type: 'low-stock',
    icon: 'PackageMinus',
    defaultSize: 'sm',
    defaultConfig: {},
    component: LowStockWidget,
    singleton: true,
  }),
);
