import Image from 'next/image';
import { getFormatter, getTranslations } from 'next-intl/server';
import { Tags } from 'lucide-react';
import { Badge, Dash, Table, TableWrapper, Td, Th, Tr } from '@clinic/ui';
import type { ShopOffer, ShopProductPrice } from '@clinic/db/types';
import { SortLinkTh } from '@/components/sort-link-th';
import { serverNow } from '@/lib/server-now';
import type { SortState } from '@/lib/sort-params';
import { PriceChip } from './price-chip';
import { PRICE_DEFAULT_SORT, type PriceSortKey } from './price-filter-params';
import type { StoreSummary } from './queries';
import { shopImageFor } from './shop-image';

/** A price older than this is shown with a warning: the shop may have moved on. */
export const STALE_AFTER_MS = 48 * 60 * 60_000;

/**
 * The comparison itself: one row per product, its cheapest offer, and every
 * shop's price as a link to buy there.
 *
 * Every price shown is a shop's own, read from its page; the unified name is
 * ours, built from the shops' names so one thing appears once. On a phone
 * the rows become cards and the chips wrap.
 */
export async function PriceTable({
  rows,
  offers,
  stores,
  sort,
}: {
  rows: ShopProductPrice[];
  offers: Map<string, ShopOffer[]>;
  stores: Map<string, StoreSummary>;
  sort: SortState<PriceSortKey>;
}) {
  const t = await getTranslations('prices');
  const tc = await getTranslations('common');
  const format = await getFormatter();
  const now = serverNow();

  const money = (value: number) =>
    format.number(value, { style: 'currency', currency: 'ILS', maximumFractionDigits: Number.isInteger(value) ? 0 : 2 });

  return (
    <TableWrapper responsive>
      <Table>
        <thead>
          <tr>
            <SortLinkTh sortKey="name" sort={sort} defaultSort={PRICE_DEFAULT_SORT}>
              {t('columns.product')}
            </SortLinkTh>
            <SortLinkTh sortKey="price" sort={sort} defaultSort={PRICE_DEFAULT_SORT}>
              {t('columns.cheapest')}
            </SortLinkTh>
            <Th>{t('columns.offers')}</Th>
            <SortLinkTh sortKey="stores" sort={sort} defaultSort={PRICE_DEFAULT_SORT}>
              {t('columns.stores')}
            </SortLinkTh>
            <SortLinkTh sortKey="updated" sort={sort} defaultSort={PRICE_DEFAULT_SORT}>
              {t('columns.updated')}
            </SortLinkTh>
          </tr>
        </thead>
        <tbody>
          {rows.map((product) => {
            const list = offers.get(product.id) ?? [];
            const available = list.filter((offer) => offer.is_available);
            const cheapest = available[0] ?? null;
            const cheapestStore = cheapest ? stores.get(cheapest.store_id) : undefined;
            const image = shopImageFor(product);
            const seen = product.last_seen_at ? Date.parse(product.last_seen_at) : null;
            const stale = seen !== null && now - seen > STALE_AFTER_MS;
            return (
              <Tr key={product.id}>
                <Td data-card-title>
                  <div className="flex items-start gap-3">
                    {image ? (
                      // Decorative beside the name; the credit rides on the
                      // picture as its title and in full on /prices/credits.
                      // 96 for a 48 px box, so it stays sharp on a phone.
                      <Image
                        src={image.src}
                        alt=""
                        width={96}
                        height={96}
                        loading="lazy"
                        title={image.creditRequired ? `${image.author} · ${image.licence}` : undefined}
                        className="h-12 w-12 shrink-0 rounded-lg border border-ink-200 object-cover"
                      />
                    ) : (
                      <span
                        aria-hidden
                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-dashed border-ink-200 text-ink-400"
                      >
                        <Tags className="h-5 w-5" />
                      </span>
                    )}
                    <div className="flex min-w-0 flex-col gap-1">
                      <span className="font-medium text-ink-900">{product.canonical_name}</span>
                      <span className="flex flex-wrap items-center gap-1.5">
                        <Badge tone="muted">{t(`categories.${product.category}`)}</Badge>
                        {product.brand ? (
                          <span className="text-xs text-ink-600" dir="ltr">
                            {product.brand}
                          </span>
                        ) : null}
                      </span>
                    </div>
                  </div>
                </Td>
                <Td>
                  {cheapest && cheapestStore ? (
                    <div className="flex flex-col">
                      <span className="text-base font-semibold text-ink-900">{money(Number(cheapest.price))}</span>
                      <span className="text-xs text-ink-600">{t('cheapestAt', { store: cheapestStore.name })}</span>
                    </div>
                  ) : (
                    <Dash label={tc('none')} />
                  )}
                </Td>
                <Td>
                  {list.length === 0 ? (
                    <Dash label={tc('none')} />
                  ) : (
                    <ul className="flex flex-wrap gap-1.5" aria-label={t('columns.offers')}>
                      {list.map((offer) => {
                        const store = stores.get(offer.store_id);
                        if (!store) return null;
                        const previous =
                          offer.previous_price !== null && Number(offer.previous_price) !== Number(offer.price)
                            ? t('was', { price: money(Number(offer.previous_price)) })
                            : null;
                        return (
                          <li key={offer.id}>
                            <PriceChip
                              offer={offer}
                              store={store}
                              cheapest={cheapest !== null && offer.id === cheapest.id}
                              priceLabel={money(Number(offer.price))}
                              previousLabel={previous}
                              unavailableLabel={t('unavailable')}
                              buyLabel={t('buyAt', { store: store.name })}
                              newTabLabel={tc('opensInNewTab')}
                            />
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </Td>
                <Td>{available.length > 0 ? t('storeCount', { count: available.length }) : <Dash label={tc('none')} />}</Td>
                <Td>
                  {seen === null ? (
                    <Dash />
                  ) : stale ? (
                    <Badge tone="warning">
                      {t('stale', { days: Math.max(1, Math.floor((now - seen) / 86_400_000)) })}
                    </Badge>
                  ) : (
                    <span className="text-sm text-ink-700">{format.relativeTime(new Date(seen), new Date(now))}</span>
                  )}
                </Td>
              </Tr>
            );
          })}
        </tbody>
      </Table>
    </TableWrapper>
  );
}
