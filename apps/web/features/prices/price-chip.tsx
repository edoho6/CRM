import { cn } from '@clinic/ui';
import type { ShopOffer } from '@clinic/db/types';
import { ExternalLink } from '@/components/external-link';
import type { StoreSummary } from './queries';

/**
 * One shop's price for the product, as a link to buy it there.
 *
 * The cheapest offer is the one drawn in green — and marked `data-cheapest`,
 * so the smoke test can check the list agrees with itself. A price the shop
 * no longer lists is struck through rather than dropped: "was 120 last
 * month" is the reason to wait or to buy now.
 */
export function PriceChip({
  offer,
  store,
  cheapest,
  priceLabel,
  previousLabel,
  unavailableLabel,
  buyLabel,
  newTabLabel,
}: {
  offer: ShopOffer;
  store: StoreSummary;
  cheapest: boolean;
  priceLabel: string;
  /** "was 120", when the price changed; null otherwise. */
  previousLabel: string | null;
  unavailableLabel: string;
  buyLabel: string;
  newTabLabel: string;
}) {
  return (
    <ExternalLink
      href={offer.url}
      newTabLabel={newTabLabel}
      title={buyLabel}
      data-cheapest={cheapest ? '' : undefined}
      className={cn(
        'rounded-full border px-2.5 py-1 text-xs leading-5 transition-colors hover:bg-ink-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
        cheapest && offer.is_available
          ? 'border-jade-300 bg-jade-100 font-semibold text-jade-800'
          : 'border-ink-200 bg-white text-ink-800',
        !offer.is_available && 'text-ink-500',
      )}
    >
      <span className="max-w-[9rem] truncate">{store.name}</span>
      <span className={cn('whitespace-nowrap', !offer.is_available && 'line-through')}>{priceLabel}</span>
      {!offer.is_available ? <span className="whitespace-nowrap">· {unavailableLabel}</span> : null}
      {offer.is_available && previousLabel ? <span className="whitespace-nowrap text-ink-500">· {previousLabel}</span> : null}
    </ExternalLink>
  );
}
