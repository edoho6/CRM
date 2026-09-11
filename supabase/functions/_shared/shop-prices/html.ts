// Small text helpers for the adapters that read pages rather than feeds.
// Regular expressions only: a full HTML parser is more than a product name
// and a price deserve, and it is one more dependency in the Edge Function.

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  laquo: '«',
  raquo: '»',
  shy: '',
  times: '×',
  deg: '°',
  copy: '©',
  reg: '®',
  trade: '™',
};

/** `&#8211;`, `&quot;` and friends, as WooCommerce writes them into product names. */
export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, body: string) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : whole;
    }
    const named = NAMED_ENTITIES[body.toLowerCase()];
    return named === undefined ? whole : named;
  });
}

/** Tags out, entities decoded, whitespace collapsed. */
export function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

/** Every capture group 1 of a global regex, in order. */
export function matchAll(text: string, pattern: RegExp): string[] {
  const out: string[] = [];
  const flags = pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g';
  const re = new RegExp(pattern.source, flags);
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out.push(m[1] ?? m[0]);
    if (m[0] === '') re.lastIndex++;
  }
  return out;
}

/** The first `<script type="application/ld+json">` block describing a Product, parsed. */
export function jsonLdProduct(html: string): Record<string, unknown> | null {
  const blocks = matchAll(html, /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
  for (const block of blocks) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(block.trim());
    } catch {
      continue;
    }
    const found = findProduct(parsed);
    if (found) return found;
  }
  return null;
}

function findProduct(node: unknown): Record<string, unknown> | null {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findProduct(child);
      if (found) return found;
    }
    return null;
  }
  const record = node as Record<string, unknown>;
  const type = record['@type'];
  if (type === 'Product' || (Array.isArray(type) && type.includes('Product'))) return record;
  if (Array.isArray(record['@graph'])) return findProduct(record['@graph']);
  return null;
}

/** A price out of a JSON-LD offer, `itemprop="price"`, or an Open Graph tag. */
export function priceFromPage(html: string): { price: number; currency: string | null } | null {
  const product = jsonLdProduct(html);
  if (product) {
    const offers = product.offers;
    const offer = Array.isArray(offers) ? offers[0] : offers;
    if (offer && typeof offer === 'object') {
      const o = offer as Record<string, unknown>;
      const raw = o.price ?? o.lowPrice;
      const price = typeof raw === 'number' ? raw : parseFloat(String(raw ?? '').replace(/[^\d.]/g, ''));
      if (Number.isFinite(price)) {
        return { price, currency: typeof o.priceCurrency === 'string' ? o.priceCurrency : null };
      }
    }
  }
  const meta =
    html.match(/<meta[^>]*property=["']product:price:amount["'][^>]*content=["']([^"']+)["']/i) ??
    html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']product:price:amount["']/i);
  if (meta) {
    const price = parseFloat(meta[1].replace(/[^\d.]/g, ''));
    const cur = html.match(/<meta[^>]*property=["']product:price:currency["'][^>]*content=["']([^"']+)["']/i);
    if (Number.isFinite(price)) return { price, currency: cur ? cur[1] : null };
  }
  const itemprop =
    html.match(/itemprop=["']price["'][^>]*content=["']([^"']+)["']/i) ??
    html.match(/<[^>]*itemprop=["']price["'][^>]*>([^<]+)</i);
  if (itemprop) {
    const price = parseFloat(itemprop[1].replace(/[^\d.]/g, ''));
    if (Number.isFinite(price)) return { price, currency: null };
  }
  return null;
}

/** The page's product name: JSON-LD, then Open Graph, then `<h1>`, then `<title>`. */
export function nameFromPage(html: string): string | null {
  const product = jsonLdProduct(html);
  if (product && typeof product.name === 'string' && product.name.trim()) return decodeEntities(product.name.trim());
  const og =
    html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i) ??
    html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i);
  if (og) return decodeEntities(og[1].trim());
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1) {
    const text = stripTags(h1[1]);
    if (text) return text;
  }
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return title ? stripTags(title[1]) : null;
}

/** `<loc>` entries of a sitemap or sitemap index. */
export function sitemapLocations(xml: string): string[] {
  return matchAll(xml, /<loc>\s*([^<\s]+)\s*<\/loc>/i).map(decodeEntities);
}

export function absoluteUrl(base: string, href: string): string {
  try {
    return new URL(href, base).toString();
  } catch {
    return href;
  }
}
