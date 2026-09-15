// The little HTML that reading American Dragon needs: the accordion
// sections its pages are built from, tables as cells, lists as items, and
// text with the entities decoded. Plain TypeScript with no imports, so the
// scripts under scripts/catalogue import it with Node's type stripping and
// the tests run it under vitest.

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
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  deg: '°',
  frac12: '½',
  frac14: '¼',
  eacute: 'é',
  egrave: 'è',
  uuml: 'ü',
  ouml: 'ö',
  auml: 'ä',
  times: '×',
  middot: '·',
  bull: '•',
  copy: '©',
};

export function decodeEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => safeCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => safeCodePoint(Number(dec)))
    .replace(
      /&([a-z0-9]+);/gi,
      (whole, name: string) => NAMED_ENTITIES[name.toLowerCase()] ?? whole,
    );
}

function safeCodePoint(code: number): string {
  if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return '';
  try {
    return String.fromCodePoint(code);
  } catch {
    return '';
  }
}

/** Inline markup — "<em>He-</em>Sea" is one word, so these tags vanish without leaving a space. */
const INLINE_TAG = /<\/?(?:em|strong|b|i|a|span|u|sup|sub|font)\b[^>]*>/gi;

/** Tags gone, entities decoded, whitespace folded to single spaces. */
export function textOf(html: string | null | undefined): string {
  return decodeEntities(
    String(html ?? '')
      .replace(/<\s*br\s*\/?>/gi, ' ')
      .replace(INLINE_TAG, '')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/ /g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Text with the line structure kept: <br> and the block tags (<p>, <li>,
 * <div>, <tr>, headings, lists) become line breaks, so a cell that lists
 * several things one under the other comes back as several lines.
 */
export function linesOf(html: string | null | undefined): string[] {
  const broken = String(html ?? '')
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/?\s*(p|li|div|tr|h[1-6]|ol|ul|table)\b[^>]*>/gi, '\n')
    .replace(INLINE_TAG, '')
    .replace(/<[^>]+>/g, ' ');
  return decodeEntities(broken)
    .replace(/ /g, ' ')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line.length > 0);
}

export function stripScripts(html: string): string {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '');
}

/**
 * The inner HTML of the element that starts at `openIndex` (the index of
 * its `<div`), found by counting divs, because the site nests divs inside
 * its content boxes and a lazy regex would stop at the first inner `</div>`.
 */
function balancedDiv(html: string, openIndex: number): { inner: string; end: number } | null {
  const tag = /<\/?div\b[^>]*>/gi;
  tag.lastIndex = openIndex;
  let depth = 0;
  let innerStart = -1;
  for (;;) {
    const match = tag.exec(html);
    if (!match) return null;
    const isClose = match[0].startsWith('</');
    if (!isClose) {
      depth += 1;
      if (depth === 1) innerStart = match.index + match[0].length;
    } else {
      depth -= 1;
      if (depth === 0)
        return { inner: html.slice(innerStart, match.index), end: match.index + match[0].length };
    }
  }
}

export interface Section {
  title: string;
  html: string;
}

/**
 * The accordion an American Dragon page is made of: each `p7ABtrig` heading
 * followed by a `p7ABcontent` box. Titles come back as text ("PROPERTIES",
 * "NAME: JIE GENG - 桔梗 - RADIX PLATYCODI").
 */
export function accordionSections(html: string): Section[] {
  const source = stripScripts(html);
  const sections: Section[] = [];
  // The title is the first anchor inside the trigger box. Formula pages wrap
  // it in <strong> or <u>, and some pages put an empty <h3> before it, so
  // nothing between the box and the anchor is assumed.
  const trigger = /<div class="p7ABtrig">[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/gi;
  for (;;) {
    const match = trigger.exec(source);
    if (!match) break;
    const title = textOf(match[1]);
    const contentStart = source.indexOf('class="p7ABcontent"', match.index + match[0].length);
    if (contentStart < 0) break;
    const openIndex = source.lastIndexOf('<div', contentStart);
    const box = balancedDiv(source, openIndex);
    if (!box) break;
    sections.push({ title, html: box.inner });
    trigger.lastIndex = box.end;
  }
  return sections;
}

/** Every table in a fragment as rows of cell HTML (nested tables are left inside their cell). */
export function tables(html: string): string[][][] {
  const out: string[][][] = [];
  for (const table of html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)) {
    const rows: string[][] = [];
    for (const row of table[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
      const cells = [...row[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(
        (cell) => cell[1],
      );
      if (cells.length > 0) rows.push(cells);
    }
    out.push(rows);
  }
  return out;
}

/** The items of every list in a fragment, as text, empty ones dropped. */
export function listItems(html: string): string[] {
  return [...html.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
    .map((item) => textOf(item[1]))
    .filter((text) => text.length > 0);
}

/** The paragraphs of a fragment as text (a fragment without <p> is one paragraph). */
export function paragraphs(html: string): string[] {
  const found = [...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((p) => textOf(p[1]))
    .filter((text) => text.length > 0);
  if (found.length > 0) return found;
  const whole = textOf(html);
  return whole ? [whole] : [];
}

/** The text of the first <title> of a page. */
export function pageTitle(html: string): string {
  return textOf(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '');
}
