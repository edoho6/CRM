// A web page as reading matter: the article, not the site around it.
//
// Plain TypeScript with no runtime imports, so the same code reads a page
// in the scheduled refresh (Deno) and in the crawl script (Node): one
// notion of "the text of this page", and therefore one hash for it.

const DROP = ['script', 'style', 'noscript', 'template', 'svg', 'nav', 'header', 'footer', 'aside', 'form', 'iframe'];

/** Tags to text: block ends become line breaks, entities are decoded, the rest is dropped. */
export function htmlToText(html: string | null | undefined): string {
  return String(html ?? '')
    .replace(/<\s*(br|\/p|\/li|\/h[1-6]|\/div)\s*>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function stripTag(html: string, tag: string): string {
  return html.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}\\s*>`, 'gi'), ' ');
}

function firstBlock(html: string, tag: string): string | null {
  const match = html.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}\\s*>`, 'i'));
  return match ? match[1]! : null;
}

export interface PageText {
  title: string;
  text: string;
}

export function pageText(html: string | null | undefined, url: string): PageText {
  const source = String(html ?? '');
  const title = (source.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '').replace(/\s+/g, ' ').trim() || url;
  let body = firstBlock(source, 'main') ?? firstBlock(source, 'article') ?? firstBlock(source, 'body') ?? source;
  for (const tag of DROP) body = stripTag(body, tag);
  const text = htmlToText(
    body
      .replace(/<h([1-6])[^>]*>/gi, (_, level: string) => `\n\n${'#'.repeat(Number(level))} `)
      .replace(/<\/h[1-6]>/gi, '\n\n')
      .replace(/<\/(p|div|section|tr|blockquote|pre)>/gi, '\n\n')
      .replace(/<li[^>]*>/gi, '\n• '),
  );
  return { title: htmlToText(title), text };
}

/** Every link on the page, absolute, same origin, without a fragment or a query. */
export function pageLinks(html: string | null | undefined, base: string): string[] {
  const links = new Set<string>();
  const origin = new URL(base).origin;
  for (const match of String(html ?? '').matchAll(/<a\b[^>]*?href\s*=\s*["']([^"']+)["']/gi)) {
    try {
      const url = new URL(match[1]!, base);
      if (url.origin !== origin || !/^https?:$/.test(url.protocol)) continue;
      url.hash = '';
      url.search = '';
      links.add(url.href);
    } catch {
      // Not a URL.
    }
  }
  return [...links];
}
