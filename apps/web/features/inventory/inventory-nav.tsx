'use client';

import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { usePathname } from '@clinic/i18n/navigation';
import { SegmentedLinks } from '@/components/segmented-links';
import { STOCK_TABS, type StockTab } from './stock-tabs';

/**
 * Sub-navigation for the stock room.
 *
 * The four states of a stocked item are tabs on one page rather than four
 * routes, because they are one list read four ways and the practitioner moves
 * between them constantly. Batches and suppliers are the machinery behind that
 * list and sit apart from it — a second group on the same line, not a second
 * bar stacked under the first.
 */
export function InventoryNav({ counts }: { counts?: Partial<Record<StockTab, number>> }) {
  const t = useTranslations('nav');
  const tTab = useTranslations('inventory.tabs');
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const onStockPage = pathname === '/inventory';
  const activeTab = (searchParams.get('tab') ?? 'in_stock') as StockTab;

  return (
    <div className="mb-5 flex flex-wrap items-center gap-2">
      <SegmentedLinks
        as="nav"
        label={t('inventory')}
        items={STOCK_TABS.map((tab) => ({
          href: tab === 'in_stock' ? '/inventory' : { pathname: '/inventory', query: { tab } },
          label: tTab(tab),
          active: onStockPage && activeTab === tab,
          count: counts?.[tab],
        }))}
      />
      <SegmentedLinks
        as="nav"
        label={t('batches')}
        items={(
          [
            { href: '/inventory/batches', labelKey: 'batches' },
            { href: '/inventory/suppliers', labelKey: 'suppliers' },
          ] as const
        ).map((section) => ({
          href: section.href,
          label: t(section.labelKey),
          active: pathname.startsWith(section.href),
        }))}
      />
    </div>
  );
}
