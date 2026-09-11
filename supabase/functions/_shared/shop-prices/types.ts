// The price job's shapes.
//
// Everything under _shared/shop-prices is plain TypeScript with explicit `.ts`
// imports and nothing from Deno or Node, so the same files are run by the
// Edge Function, by vitest in apps/web (through the `@shop/*` alias) and by
// the dry-run script under Node's own type stripping. Only "erasable" syntax
// is used here for that reason: no enums, no parameter properties.

export type StorePlatform =
  | 'woocommerce'
  | 'shopify'
  | 'html_cashcow'
  | 'html_kala'
  | 'html_magento1'
  | 'unsupported';

export type StoreStatus = 'active' | 'paused' | 'awaiting_permission' | 'unsupported';

export type ShopCategory =
  | 'needles'
  | 'moxa'
  | 'cupping'
  | 'guasha'
  | 'ear_seeds'
  | 'tdp_lamps'
  | 'electro'
  | 'granules'
  | 'formulas'
  | 'raw_herbs'
  | 'consumables'
  | 'accessories';

export type SizeKind = 'dims' | 'mass' | 'vol' | 'len' | 'pct';

/** Where an unfinished pass stopped. The adapter owns the shape; run.ts only stores it. */
export type Bookmark = Record<string, unknown>;

/** The columns of shop_stores the job reads. */
export interface StoreRow {
  id: string;
  slug: string;
  name: string;
  base_url: string;
  platform: StorePlatform;
  status: StoreStatus;
  config: Record<string, unknown>;
  crawl_delay_ms: number;
  bookmark: Bookmark | null;
  refresh_requested_at: string | null;
  last_started_at: string | null;
  last_completed_at: string | null;
  last_success_at: string | null;
  last_error_at: string | null;
  consecutive_failures: number;
}

/**
 * One thing a shop lists, exactly as much of it as the comparison needs: the
 * name, the price, the link, and the identifiers that let the same thing be
 * recognised in another shop. No description, no picture.
 */
export interface RawItem {
  externalId: string;
  name: string;
  url: string;
  price: number;
  currency: string;
  sku: string | null;
  gtin: string | null;
  available: boolean;
  /** The shop's own category names or tags, for the classifier. */
  categories: string[];
}

export interface AdapterPage {
  items: RawItem[];
  /** Where to continue, or null when the catalogue has been read to the end. */
  next: Bookmark | null;
  /** Requests this page cost, for the run's statistics. */
  requests: number;
}

export interface FetchOptions {
  accept?: string;
  etag?: string | null;
  lastModified?: string | null;
}

export interface FetchResult {
  status: number;
  ok: boolean;
  /** A conditional request answered 304. `text` is empty then. */
  notModified: boolean;
  text: string;
  etag: string | null;
  lastModified: string | null;
  headers: Record<string, string>;
  url: string;
}

export interface Fetcher {
  get(url: string, options?: FetchOptions): Promise<FetchResult>;
  /** Requests made so far, for the statistics and the tests. */
  readonly requests: number;
}

export interface Robots {
  allows(path: string): boolean;
  /** From Crawl-delay, when the shop states one. */
  crawlDelayMs: number | null;
}

export interface Logger {
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
}

export interface AdapterContext {
  store: StoreRow;
  fetcher: Fetcher;
  robots: Robots;
  log: Logger;
}

export interface Adapter {
  /** The paths the adapter will request, checked against robots.txt before the first one. */
  paths(store: StoreRow): string[];
  fetchPage(context: AdapterContext, position: Bookmark | null): Promise<AdapterPage>;
}

/** What the matcher makes of one raw name: the product it belongs to. */
export interface ProductIdentity {
  brand: string | null;
  brandLabel: string | null;
  displayItem: string;
  itemKey: string;
  sizeKind: SizeKind | null;
  sizeA: number | null;
  sizeB: number | null;
  sizeUnit: string | null;
  packCount: number | null;
  canonicalName: string;
  fingerprint: string;
  category: ShopCategory;
}

/** One element of the array shop_upsert_offers takes. */
export interface OfferPayload {
  external_id: string;
  raw_name: string;
  url: string;
  sku: string | null;
  gtin: string | null;
  fingerprint: string;
  price: number;
  currency: string;
  available: boolean;
  product: {
    brand: string | null;
    display_item: string;
    item_key: string;
    size_kind: SizeKind | null;
    size_a: number | null;
    size_b: number | null;
    size_unit: string | null;
    pack_count: number | null;
    canonical_name: string;
    category: ShopCategory;
  };
}

export interface UpsertStats {
  new_products: number;
  new_offers: number;
  updated: number;
  price_changes: number;
}

export interface RunStats {
  pages: number;
  fetched: number;
  in_scope: number;
  new_products: number;
  new_offers: number;
  price_changes: number;
}

export type RunTrigger = 'cron' | 'manual';

export interface FinishInput {
  storeId: string;
  runId: string;
  trigger: RunTrigger;
  ok: boolean;
  partial: boolean;
  error: string | null;
  stats: RunStats;
}

/** The database as the job sees it: the four functions of the migration, and the store list. */
export interface Db {
  listStores(): Promise<StoreRow[]>;
  claimStore(storeId: string, runId: string): Promise<StoreRow | null>;
  saveBookmark(storeId: string, bookmark: Bookmark | null): Promise<void>;
  upsertOffers(storeId: string, runId: string, offers: OfferPayload[]): Promise<UpsertStats>;
  finishRun(input: FinishInput): Promise<number>;
}

export interface RunOutcome {
  /** The store this tick worked on, or null when nothing was due. */
  picked: string | null;
  claimed: boolean;
  ok: boolean;
  partial: boolean;
  error: string | null;
  stats: RunStats;
}
