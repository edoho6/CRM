import { describe, expect, it } from 'vitest';
import { detectBrand } from '@shop/brands.ts';
import { classify } from '@shop/classify.ts';
import { normaliseGtin } from '@shop/gtin.ts';
import { decodeEntities, jsonLdProduct, nameFromPage, priceFromPage, sitemapLocations } from '@shop/html.ts';
import { identify } from '@shop/match.ts';
import { extractMeasures, extractPack, needleDims, normaliseText, sizeKey } from '@shop/normalise.ts';
import type { ShopCategory } from '@shop/types.ts';
import dryang from '@shop/__fixtures__/dryang-names.json';
import medicinebom from '@shop/__fixtures__/medicinebom-names.json';
import rosamix from '@shop/__fixtures__/rosamix-names.json';
import tevadirect from '@shop/__fixtures__/tevadirect-names.json';

// The price job's pure logic: how a shop's name becomes a product. The
// fixtures are the real names the four shops listed on 2026-09-11 (names and
// categories only), so a change to the taxonomy shows up as a changed count.

describe('normaliseText', () => {
  it('unifies quotes, decimal commas, dimension marks and entities', () => {
    expect(normaliseText('מחטים 0,25 × 40 מ״מ &#8211; 100 יח׳')).toBe('מחטים 0.25x40 מ"מ 100 יח\'');
    expect(normaliseText('SEIRIN 0.20*30MM')).toBe('seirin 0.20x30mm');
    expect(normaliseText('מחטים עם מוליך-GOLDEN')).toBe('מחטים עם מוליך golden');
    expect(normaliseText('טייפ ב-150 ש"ח')).toBe('טייפ ב 150 ש"ח');
    expect(normaliseText('חד-פעמי (סט) / CQ-27')).toBe('חד פעמי סט cq-27');
  });
});

describe('extractMeasures', () => {
  it('reads dimensions, mass, volume, length and percent', () => {
    const dims = extractMeasures('מחטי דיקור 0.25x40 מ"מ 100 יח\'');
    expect(dims.measures).toEqual([{ kind: 'dims', a: 0.25, b: 40, unit: 'mm' }]);
    expect(dims.rest).toBe('מחטי דיקור 100 יח\'');

    const alcohol = extractMeasures('אלכוהול 70% 1 ליטר');
    expect(sizeKey(alcohol.measures)).toBe('vol:1000ml,pct:70%');

    expect(extractMeasures("מוקסה גסה 250 גר'").measures).toEqual([{ kind: 'mass', a: 250, b: null, unit: 'g' }]);
    expect(extractMeasures('קרם 1.5 ק"ג').measures[0]).toMatchObject({ kind: 'mass', a: 1500 });
    expect(extractMeasures('גליל אל בד רוחב 60 ס"מ').measures).toEqual([{ kind: 'len', a: 60, b: null, unit: 'cm' }]);
    expect(extractMeasures('פד גזה 10x10 ס"מ').measures).toEqual([{ kind: 'dims', a: 10, b: 10, unit: 'cm' }]);
  });

  it('does not read a word starting with a unit letter as a unit', () => {
    expect(extractMeasures('mini moxa 2 large').measures).toEqual([]);
    expect(extractMeasures('גרנולות 100 גרסה').measures).toEqual([]);
  });
});

describe('needleDims', () => {
  it('puts every needle at gauge × length in millimetres', () => {
    const gauge = { kind: 'dims' as const, a: 0.25, b: 40, unit: 'mm' };
    expect(needleDims(gauge, 'gauge_first')).toEqual(gauge);
    expect(needleDims({ kind: 'dims', a: 30, b: 16, unit: 'mm' }, 'length_first')).toEqual({ kind: 'dims', a: 0.16, b: 30, unit: 'mm' });
    expect(needleDims({ kind: 'dims', a: 100, b: 30, unit: 'mm' }, 'length_first')).toEqual({ kind: 'dims', a: 0.3, b: 100, unit: 'mm' });
    expect(needleDims({ kind: 'dims', a: 25, b: 40, unit: 'mm' }, 'gauge_first')).toEqual({ kind: 'dims', a: 0.25, b: 40, unit: 'mm' });
  });
});

describe('extractPack', () => {
  it('reads a count with its word, a pack phrase, or a bare trailing number', () => {
    expect(extractPack("מחטי דיקור 100 יח'")).toMatchObject({ pack: 100, rest: 'מחטי דיקור' });
    expect(extractPack('מוקסה אריזה של 50')).toMatchObject({ pack: 50, rest: 'מוקסה' });
    expect(extractPack('כוסות רוח חד פעמיות במארז 200 יח')).toMatchObject({ pack: 200 });
    expect(extractPack('asp 80', { allowBare: true })).toMatchObject({ pack: 80, rest: 'asp' });
    expect(extractPack('premio 10')).toMatchObject({ pack: null, rest: 'premio 10' });
  });

  it('keeps a small size number apart from the pack', () => {
    expect(extractPack("כוס רוח זכוכית עבה מס' 2")).toMatchObject({ pack: null, sizeNumber: 2, rest: 'כוס רוח זכוכית עבה' });
    expect(extractPack('כוסות רוח זכוכית 3', { allowBare: true })).toMatchObject({ pack: null, sizeNumber: 3 });
  });
});

describe('normaliseGtin', () => {
  it('accepts a valid EAN-13 or UPC-A as 14 digits and rejects the rest', () => {
    expect(normaliseGtin('4006381333931')).toBe('04006381333931');
    expect(normaliseGtin('036000291452')).toBe('00036000291452');
    expect(normaliseGtin('4006381333932')).toBeNull();
    expect(normaliseGtin('123456')).toBeNull();
    expect(normaliseGtin('0000000000000')).toBeNull();
    expect(normaliseGtin('')).toBeNull();
    expect(normaliseGtin(null)).toBeNull();
  });
});

describe('detectBrand', () => {
  it('finds a brand in either script, at a word boundary, and removes it', () => {
    expect(detectBrand('מחטי seirin 0.20x30')).toMatchObject({ brand: { key: 'seirin' }, rest: 'מחטי 0.20x30' });
    expect(detectBrand('מחטי סירין')?.brand.key).toBe('seirin');
    expect(detectBrand('dong bang 100 מחטים')?.brand.key).toBe('dongbang');
    expect(detectBrand('מחטים עם מוליך golden')?.brand.key).toBe('goldenneedle');
    expect(detectBrand('goldenrod tea')).toBeNull();
    expect(detectBrand('נעצי אוזן pyonex')?.brand.key).toBe('seirin');
  });
});

describe('classify', () => {
  const cases: [string, string[], string, ShopCategory | null][] = [
    ['מחטי Seirin – מחטים יפניות מקוריות', ['מחטי Seirin יפניות מקוריות'], 'medicinebom', 'needles'],
    ['Dong Bang 100 – מחטים קוריאניות', ['מחטים קוראניות Dong Bang'], 'medicinebom', 'needles'],
    ['פדים אלכוהוליים 200 יח', ['ציוד נלווה לטיפולי דיקור'], 'medicinebom', 'consumables'],
    ['פח מחטים', ['מחטים לדיקור'], 'dryang', 'consumables'],
    ['דלי להשמדת מחטים 2 ליטר', ['קליניקה'], 'rosamix', 'consumables'],
    ['מד חום אינפרא אדום', ['ציוד רפואי '], 'dryang', 'accessories'],
    ['מד לחץ דם אלקטרוני', ['ציוד רפואי '], 'dryang', 'accessories'],
    ['פינצטה למחטים 12', ['ציוד למטפלים', 'ציוד לספא ועיסוי'], 'tevadirect', 'accessories'],
    ['מנורת חימום TDP דגם CQ-27', ['מנורת חימום'], 'medicinebom', 'tdp_lamps'],
    ['מנורת מוקסה – מנורת TDP', ['אבנים חמות ומוצרי חימום'], 'dryang', 'tdp_lamps'],
    ["גרנולות זהב 300 יח'", ['גרנולות'], 'medicinebom', 'ear_seeds'],
    ["מגנט 9000 גאוס יפני ציפוי זהב-12 יח'", ['מגנטים'], 'medicinebom', 'ear_seeds'],
    ['נעצי אוזן פיונקס', ['מחטים לדיקור'], 'dryang', 'ear_seeds'],
    ['ASP 80', ['מחטים לאוזן Sedatelec - ASP'], 'tevadirect', 'ear_seeds'],
    ['מוקסה על מחט 200 יח\' DB', ['מוקסות על מחט'], 'medicinebom', 'moxa'],
    ['אקדח כוסות רוח חד פעמיות', ['רפואה סינית'], 'rosamix', 'cupping'],
    ['גוושה – Guasha', ['אביזרים ומכשור לעיסוי'], 'dryang', 'guasha'],
    ['גוואשה', ['מאתרים ומוצרים לטיפול מרידאני'], 'medicinebom', 'guasha'],
    ['אלקטרו אקופנצר ES-160', ['מכשור חשמלי'], 'tevadirect', 'electro'],
    ['אלכוהול 70%', ['חומרי גלם'], 'tevadirect', 'consumables'],
    ['גליל סדין למיטת טיפולים 75 מטר לבן', ['קליניקה'], 'rosamix', 'consumables'],
    ['סדין אל בד חד פעמי', ['מוצרי נייר, בד ואל בד'], 'tevadirect', 'consumables'],
    ['כפפות ניטריל חד פעמיות', ['ציוד למטפלים', 'ציוד לספא ועיסוי'], 'tevadirect', 'consumables'],
    ['מחטי דיקור', [], 'a-shop-without-a-map', 'needles'],
    // Out of scope, whatever the shop's category.
    ['שמן כוסברה 9 מ"ל- TISSERAND', ['TISSERAND - שמנים אתרים טהורים ואיכותיים'], 'medicinebom', null],
    ['מיטת טיפולים מעץ', ['מיטות טיפול מעץ'], 'dryang', null],
    ['רגלית איכותית רחבה לפדיקור לבן', ['ספא', 'קליניקה'], 'rosamix', null],
    ['שטיח דיקור 44*73', ['ציוד למטפלים', 'שטיח דיקור'], 'tevadirect', null],
    ['מודל גוף האדם', ['מחטים לדיקור'], 'dryang', null],
    ['צטיל אלכוהול', ['חומרי גלם'], 'tevadirect', null],
    ['סדין בד עם גומי', ['מוצרי נייר, בד ואל בד'], 'tevadirect', null],
    ['9+1 סדין מיקרו עם גומי', ['באנדלים- מכירה בכמויות'], 'dryang', null],
    ['פדים לניקוי רעלים זהב', ['ציוד למטפלים', 'ציוד לספא ועיסוי'], 'tevadirect', null],
    ['דרמה רולר – 0.5 מ"מ', ['מאתרים ומוצרים לטיפול מרידאני'], 'medicinebom', null],
    ['ערכה להכנת נרות טבעיים', ['ערכות'], 'tevadirect', null],
    ['Chinese Medicine in Contemporary China – Volker Scheid', ['ספרות מקצועית'], 'medicinebom', null],
    ['גליל יוגה', [], 'dryang', null],
    ['מוצר בלי שום רמז', ['ציוד למטפלים'], 'tevadirect', null],
  ];

  it.each(cases)('%s → %s', (name, categories, store, expected) => {
    expect(classify({ name, categories }, store)).toBe(expected);
  });

  const fixtures: [string, { name: string; categories: string[] }[], number, number][] = [
    ['medicinebom', medicinebom, 80, 100],
    ['tevadirect', tevadirect, 200, 240],
    ['dryang', dryang, 75, 95],
    ['rosamix', rosamix, 40, 50],
  ];

  it.each(fixtures)('keeps a stable share of %s (real names of 2026-09-11)', (store, names, min, max) => {
    const kept = names.filter((entry) => classify(entry, store) !== null);
    expect(kept.length).toBeGreaterThanOrEqual(min);
    expect(kept.length).toBeLessThanOrEqual(max);
    // A paper roll "for the treatment table" is a consumable; the table is not.
    const forbidden = /יוגה|שמן אתרי|פרחי באך|ויטמין|פדיקור|שטיח|(^|\s)מיטת טיפולים?(\s|$)(?!.*(נייר|אל בד|אלבד|ניילון|חד פעמי))/;
    expect(kept.filter((entry) => forbidden.test(entry.name)).map((e) => e.name)).toEqual([]);
  });
});

describe('identify', () => {
  it('unifies two spellings of one branded product', () => {
    const a = identify("מחטי Seirin 0.20x30 100 יח'", { category: 'needles' });
    const b = identify('SEIRIN מחטים יפניות מקוריות 0.20X30MM אריזה של 100', { category: 'needles' });
    expect(a.fingerprint).toBe('seirin|needles:|dims:0.2x30mm|100');
    expect(b.fingerprint).toBe(a.fingerprint);
    expect(a.canonicalName).toBe("Seirin · מחטי דיקור · 0.2×30 מ\"מ (100 יח')");
    expect(a).toMatchObject({ brand: 'seirin', sizeKind: 'dims', sizeA: 0.2, sizeB: 30, sizeUnit: 'mm', packCount: 100 });
  });

  it('keeps apart what differs in size, pack or a known feature', () => {
    const base = identify('Seirin מחטים 0.20x30 100 יח', { category: 'needles' }).fingerprint;
    expect(identify('Seirin מחטים 0.25x30 100 יח', { category: 'needles' }).fingerprint).not.toBe(base);
    expect(identify('Seirin מחטים 0.20x30 500 יח', { category: 'needles' }).fingerprint).not.toBe(base);
    expect(identify('Seirin מחטים עם מוליך 0.20x30 100 יח', { category: 'needles' }).fingerprint).not.toBe(base);
    const withTube = identify('Seirin מחטים עם מוליך 0.20x30 100 יח', { category: 'needles' });
    const without = identify('Seirin מחטים ללא מוליך 0.20x30 100 יח', { category: 'needles' });
    expect(withTube.fingerprint).not.toBe(without.fingerprint);
    expect(withTube.canonicalName).toContain('עם מוליך');
    expect(without.canonicalName).toContain('ללא מוליך');
  });

  it('never merges unbranded listings on size alone', () => {
    const chinese = identify('מחטים לדיקור סיני 0.16*15', { category: 'needles' });
    const silicone = identify('מחט סיליקון 15*16 100', { category: 'needles', dimsOrder: 'length_first' });
    expect(chinese.fingerprint).toBe('-|needles:סיני|dims:0.16x15mm|-');
    expect(silicone.fingerprint).toBe('-|needles:סיליקון|dims:0.16x15mm|100');
    expect(silicone.canonicalName).toBe("סיליקון · 0.16×15 מ\"מ (100 יח')");
  });

  it('merges the same unbranded consumable across shops when the words agree', () => {
    const shops = ['אלכוהול 70% – 1 ליטר', 'אלכוהול לחיטוי 70% 1 ליטר', 'אלכוהול 70% 1 ליטר'];
    const prints = new Set(shops.map((name) => identify(name, { category: 'consumables' }).fingerprint));
    expect([...prints]).toEqual(['-|consumables:אלכוהול|vol:1000ml,pct:70%|-']);
    expect(identify('אלכוהול 99% – 100 מ"ל', { category: 'consumables' }).canonicalName).toBe('אלכוהול · 100 מ"ל, 99%');
  });

  it('treats a model number as identity, not as a pack', () => {
    expect(identify('premio 10', { category: 'electro' }).fingerprint).not.toBe(identify('premio 32', { category: 'electro' }).fingerprint);
    expect(identify('premio 10', { category: 'electro' }).packCount).toBeNull();
    const lamp = identify('מנורת חימום TDP דגם CQ-27', { category: 'tdp_lamps' });
    expect(lamp.fingerprint).toBe('-|tdp_lamps:cq-27|-|-');
    expect(lamp.canonicalName).toBe('מנורת TDP CQ-27');
  });

  it('reads a cup size number as a size and a trailing count as a pack', () => {
    const cup = identify("כוס רוח זכוכית עבה מס' 2", { category: 'cupping' });
    expect(cup.fingerprint).toBe('-|cupping:זכוכית.עבה.no=2|-|-');
    expect(cup.packCount).toBeNull();
    expect(identify('ASP 80', { category: 'ear_seeds' })).toMatchObject({ packCount: 80, fingerprint: '-|ear_seeds:asp|-|80' });
  });

  it('shows the material or the plant of a herb name in Latin with capitals', () => {
    expect(identify('bai zhu granules 100g', { category: 'granules' }).canonicalName).toBe('Bai Zhu · 100 גרם');
  });
});

describe('html helpers', () => {
  const page = `<html><head><title>Ignored | Shop</title>
    <script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"WebPage"},{"@type":"Product","name":"מחטי דיקור &quot;X&quot;","offers":{"@type":"Offer","price":"120.00","priceCurrency":"ILS"}}]}</script>
    </head><body><h1>מחטי דיקור</h1><span itemprop="price" content="999">999</span></body></html>`;

  it('reads a product from JSON-LD first, then from meta tags, then from the page', () => {
    expect(jsonLdProduct(page)?.name).toBe('מחטי דיקור &quot;X&quot;');
    expect(nameFromPage(page)).toBe('מחטי דיקור "X"');
    expect(priceFromPage(page)).toEqual({ price: 120, currency: 'ILS' });

    const meta = `<meta property="og:title" content="מוקסה &#8211; 200"><meta property="product:price:amount" content="49.90"><meta property="product:price:currency" content="ILS">`;
    expect(nameFromPage(meta)).toBe('מוקסה – 200');
    expect(priceFromPage(meta)).toEqual({ price: 49.9, currency: 'ILS' });

    expect(nameFromPage('<h1 class="x">  כוסות <b>רוח</b> </h1>')).toBe('כוסות רוח');
    expect(priceFromPage('<p>no price</p>')).toBeNull();
  });

  it('decodes entities and reads sitemap locations', () => {
    expect(decodeEntities('a &amp; b &#8211; &#x5D0; &quot;')).toBe('a & b – א "');
    expect(sitemapLocations('<urlset><url><loc> https://x/p/1 </loc></url><url><loc>https://x/p/2&amp;a=1</loc></url></urlset>')).toEqual([
      'https://x/p/1',
      'https://x/p/2&a=1',
    ]);
  });
});
