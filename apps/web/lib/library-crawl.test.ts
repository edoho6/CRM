import { describe, expect, it } from 'vitest';
import { isAllowed, parseRobots, rulesFor } from '../../../scripts/library/lib/robots.mjs';
import { pageLinks, pageText } from '../../../scripts/library/lib/html.mjs';

describe('robots', () => {
  const robots = parseRobots(`
User-agent: *
Disallow: /private/
Allow: /private/public-note
Crawl-delay: 2

User-agent: herbalist-library
Disallow: /members/
`);

  it('prefers our own group over the general one', () => {
    const ours = rulesFor(robots, 'herbalist-library/1.0 (contact)');
    expect(isAllowed(ours, '/members/x')).toBe(false);
    expect(isAllowed(ours, '/private/anything')).toBe(true);
    const general = rulesFor(robots, 'somebody-else');
    expect(isAllowed(general, '/private/anything')).toBe(false);
    expect(isAllowed(general, '/private/public-note')).toBe(true);
    expect(general.crawlDelay).toBe(2);
  });

  it('allows everything when there is no robots file', () => {
    expect(isAllowed(rulesFor(parseRobots(''), 'x'), '/anything')).toBe(true);
  });
});

describe('page text and links', () => {
  const html = `<html><head><title>Gui Zhi Tang — Formulas</title></head><body>
<nav><a href="/menu">Menu</a></nav>
<main><h1>Gui Zhi Tang</h1><p>Releases the exterior and harmonises ying and wei.</p>
<h2>Ingredients</h2><ul><li>Gui Zhi 9g</li><li>Bai Shao 9g</li></ul>
<a href="/formulas/ma-huang-tang#top">Ma Huang Tang</a> <a href="https://other.example/x">elsewhere</a>
<a href="/formulas/list?page=2">page 2</a></main>
<footer>© site</footer><script>track()</script></body></html>`;

  it('keeps the article and drops the site around it', () => {
    const { title, text } = pageText(html, 'https://example.org/formulas/gui-zhi-tang');
    expect(title).toBe('Gui Zhi Tang — Formulas');
    expect(text).toContain('# Gui Zhi Tang');
    expect(text).toContain('## Ingredients');
    expect(text).toContain('• Gui Zhi 9g');
    expect(text).not.toContain('Menu');
    expect(text).not.toContain('© site');
    expect(text).not.toContain('track()');
  });

  it('lists same-site links without fragments or queries', () => {
    expect(pageLinks(html, 'https://example.org/formulas/gui-zhi-tang')).toEqual([
      'https://example.org/menu',
      'https://example.org/formulas/ma-huang-tang',
      'https://example.org/formulas/list',
    ]);
  });

  it('keeps the query when asked, because a database keeps its records there — fragments still go', () => {
    const records = '<a href=" detail.php?lang=eng&id=F1">one</a><a href="detail.php?lang=eng&id=F1#top">same</a><a href="detail.php?lang=eng&id=F2">two</a><a href="index.php">list</a>';
    const base = 'https://db.example.org/cmed/cmfid/index.php?lang=eng';
    expect(pageLinks(records, base, { keepQuery: true })).toEqual([
      'https://db.example.org/cmed/cmfid/detail.php?lang=eng&id=F1',
      'https://db.example.org/cmed/cmfid/detail.php?lang=eng&id=F2',
      'https://db.example.org/cmed/cmfid/index.php',
    ]);
    expect(pageLinks(records, base)).toEqual(['https://db.example.org/cmed/cmfid/detail.php', 'https://db.example.org/cmed/cmfid/index.php']);
  });
});
