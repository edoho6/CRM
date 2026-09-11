import manifest from './shop-images.json';

/**
 * The picture a row of the price comparison shows.
 *
 * Never the shop's own photograph: those are the shop's. Instead a picture
 * from an open source under CC0 / CC BY / CC BY-SA, chosen by
 * scripts/fetch-shop-images.mjs and reviewed by eye — one per product where a
 * source names the brand, otherwise one per category, which is what most
 * rows show. CC BY needs its credit shown; the list links every picture to
 * /prices/credits and carries the credit on the picture itself.
 */
export interface ShopImage {
  /** Path under the site root. */
  src: string;
  title: string;
  source: string;
  author: string;
  page: string;
  licence: string;
  licenceUrl: string;
  creditRequired: boolean;
  scope: 'product' | 'category';
}

interface ManifestEntry {
  file?: string;
  title?: string;
  source?: string;
  author?: string;
  page?: string;
  licence?: string;
  licenceUrl?: string;
  creditRequired?: boolean;
}

interface Manifest {
  categories: Record<string, ManifestEntry>;
  products: Record<string, ManifestEntry>;
}

const entries = manifest as unknown as Manifest;

function toImage(entry: ManifestEntry | undefined, scope: ShopImage['scope']): ShopImage | null {
  if (!entry?.file) return null;
  return {
    src: entry.file.startsWith('/') ? entry.file : `/shop-images/${entry.file}`,
    title: entry.title ?? '',
    source: entry.source ?? '',
    author: entry.author ?? '',
    page: entry.page ?? '',
    licence: entry.licence ?? '',
    licenceUrl: entry.licenceUrl ?? '',
    creditRequired: entry.creditRequired !== false,
    scope,
  };
}

export function shopImageFor(product: { fingerprint: string; category: string }): ShopImage | null {
  return toImage(entries.products[product.fingerprint], 'product') ?? toImage(entries.categories[product.category], 'category');
}

/** Every picture in the manifest, for the credits page: categories first, then products by fingerprint. */
export function shopImageCredits(): { key: string; image: ShopImage }[] {
  const out: { key: string; image: ShopImage }[] = [];
  for (const [category, entry] of Object.entries(entries.categories).sort()) {
    const image = toImage(entry, 'category');
    if (image) out.push({ key: category, image });
  }
  for (const [fingerprint, entry] of Object.entries(entries.products).sort()) {
    const image = toImage(entry, 'product');
    if (image) out.push({ key: fingerprint, image });
  }
  return out;
}
