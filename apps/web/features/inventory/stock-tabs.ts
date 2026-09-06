/**
 * The four states of a stocked item.
 *
 * This lives in its own plain module rather than beside the nav component,
 * because the nav is a client component and a plain array exported from one
 * does not survive the crossing: on the server it arrives as a client
 * reference, not as an array, and any method call on it fails at request time
 * rather than at build time.
 */
export const STOCK_TABS = ['in_stock', 'low', 'out', 'to_order'] as const;
export type StockTab = (typeof STOCK_TABS)[number];

export function parseStockTab(value: string | undefined): StockTab {
  return (STOCK_TABS as readonly string[]).includes(value ?? '') ? (value as StockTab) : 'in_stock';
}
