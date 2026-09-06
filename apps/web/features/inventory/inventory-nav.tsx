'use client';

import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { Link, usePathname } from '@clinic/i18n/navigation';
import { cn } from '@clinic/ui';
import { STOCK_TABS, type StockTab } from './stock-tabs';

/**
 * Sub-navigation for the stock room.
 *
 * The four states of a stocked item are tabs on one page rather than four
 * routes, because they are one list read four ways and the practitioner moves
 * between them constantly. Batches and suppliers are the machinery behind that
 * list and sit apart from it.
 */
export function InventoryNav({ counts }: { counts?: Partial<Record<StockTab, number>> }) {
  const t = useTranslations('nav');
  const tTab = useTranslations('inventory.tabs');
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const onStockPage = pathname === '/inventory';
  const activeTab = (searchParams.get('tab') ?? 'in_stock') as StockTab;

  return (
    <div className="mb-5 space-y-2">
      <nav className="flex flex-wrap items-center gap-1 rounded-lg border border-ink-200 bg-white p-1">
        {STOCK_TABS.map((tab) => {
          const isActive = onStockPage && activeTab === tab;
          const count = counts?.[tab];
          return (
            <Link
              key={tab}
              href={tab === 'in_stock' ? '/inventory' : { pathname: '/inventory', query: { tab } }}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                isActive ? 'bg-jade-600 text-white' : 'text-ink-600 hover:bg-ink-50',
              )}
            >
              {tTab(tab)}
              {count !== undefined ? (
                <span
                  className={cn(
                    'rounded-full px-1.5 text-xs tabular-nums',
                    isActive ? 'bg-white/20' : 'bg-ink-100 text-ink-600',
                  )}
                >
                  {count}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <nav className="flex flex-wrap items-center gap-1 rounded-lg border border-ink-200 bg-white p-1">
        {(
          [
            { href: '/inventory/batches', labelKey: 'batches' },
            { href: '/inventory/suppliers', labelKey: 'suppliers' },
          ] as const
        ).map((section) => {
          const isActive = pathname.startsWith(section.href);
          return (
            <Link
              key={section.href}
              href={section.href}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                isActive ? 'bg-jade-600 text-white' : 'text-ink-600 hover:bg-ink-50',
              )}
            >
              {t(section.labelKey)}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
