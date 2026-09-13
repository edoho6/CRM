// A web page as reading matter: the article, not the site around it.
import { htmlToText } from '../../medicine/lib.mjs';

const DROP = ['script', 'style', 'noscript', 'template', 'svg', 'nav', 'header', 'footer', 'aside', 'form', 'iframe'];

function stripTag(html, tag) {
  return html.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}\\s*>`, 'gi'), ' ');
}

function firstBlock(html, tag) {
  const match = html.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}\\s*>`, 'i'));
  return match ? match[1] : null;
}

/** @returns {{title: string, text: string}} */
export function pageText(html, url) {
  const source = String(html ?? '');
  const title = (source.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '').replace(/\s+/g, ' ').trim() || url;
  let body = firstBlock(source, 'main') ?? firstBlock(source, 'article') ?? firstBlock(source, 'body') ?? source;
  for (const tag of DROP) body = stripTag(body, tag);
  const text = htmlToText(
    body
      .replace(/<h([1-6])[^>]*>/gi, (_, level) => `\n\n${'#'.repeat(Number(level))} `)
      .replace(/<\/h[1-6]>/gi, '\n\n')
      .replace(/<\/(p|div|section|tr|blockquote|pre)>/gi, '\n\n')
      .replace(/<li[^>]*>/gi, '\n• '),
  );
  return { title: htmlToText(title), text };
}

/** Every link on the page, absolute, same origin, without a fragment or a query. */
export function pageLinks(html, base) {
  const links = new Set();
  const origin = new URL(base).origin;
  for (const match of String(html ?? '').matchAll(/<a\b[^>]*?href\s*=\s*["']([^"']+)["']/gi)) {
    try {
      const url = new URL(match[1], base);
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
