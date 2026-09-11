// From one shop's name to the product it is an offer for.
//
// Two listings are the same product when their fingerprints agree:
//
//     brand | item key | size key | pack
//
// The brand comes from the list in brands.ts; the size and the pack from the
// numbers in the name; the item key from the words that remain. For the
// categories where products differ by a handful of known features (a needle
// with or without a guide tube, a silicone or a glass cup), the item key is
// the category plus those features, so "מחטי Seirin יפניות" and "Seirin
// needles original" agree once the brand and the size do. For herbs, formulas
// and the rest, and for anything without a recognised brand, the item key is
// every content word — only listings that say the same thing merge. The user
// chose no manual review, so the rule errs towards two rows for one product,
// never one row for two.

import { detectBrand } from './brands.ts';
import {
  contentTokens,
  extractMeasures,
  extractPack,
  isModelToken,
  needleDims,
  normaliseText,
  sizeKey,
  sizeLabel,
  titleCaseLatin,
} from './normalise.ts';
import type { Measure } from './normalise.ts';
import type { ProductIdentity, ShopCategory } from './types.ts';

interface Feature {
  token: string;
  label: string;
  pattern: RegExp;
  categories: ShopCategory[];
}

const NEEDLE: ShopCategory[] = ['needles'];
const MOXA: ShopCategory[] = ['moxa'];
const CUP: ShopCategory[] = ['cupping'];
const GUASHA: ShopCategory[] = ['guasha'];
const EAR: ShopCategory[] = ['ear_seeds'];
const LAMP: ShopCategory[] = ['tdp_lamps', 'electro'];
const CONSUMABLE: ShopCategory[] = ['consumables'];
/** The categories whose products differ by known features; the others compare every word. */
const FEATURE_CATEGORIES: ShopCategory[] = ['needles', 'moxa', 'cupping', 'guasha', 'ear_seeds', 'tdp_lamps', 'electro', 'consumables'];
/** Where a bare number at the end of a name is a count ("ASP 80") rather than a model ("Premio 10"). */
const BARE_PACK_CATEGORIES: ShopCategory[] = ['needles', 'moxa', 'cupping', 'guasha', 'ear_seeds', 'consumables'];

/**
 * The features that make two listings of one brand different products.
 * Order matters where one pattern contains another: "ללא מוליך" before "מוליך".
 */
const FEATURES: Feature[] = [
  { token: 'notube', label: 'ללא מוליך', pattern: /ללא\s*מוליך|בלי\s*מוליך|without\s*(guide\s*)?tube|no\s*tube/u, categories: NEEDLE },
  { token: 'tube', label: 'עם מוליך', pattern: /מוליך|guide\s*tube|with\s*tube/u, categories: NEEDLE },
  { token: 'intradermal', label: 'תת-עוריות', pattern: /תת[\s-]*עור|intradermal/u, categories: NEEDLE },
  { token: 'press', label: 'נעצים', pattern: /נעצ|press\s*(needle|pin)/u, categories: [...NEEDLE, ...EAR] },
  { token: 'lancet', label: 'להקזה', pattern: /הקזה|lancet/u, categories: NEEDLE },
  { token: 'copper', label: 'ידית נחושת', pattern: /נחושת|copper/u, categories: NEEDLE },
  { token: 'silver', label: 'ידית כסף', pattern: /(\s|^)כסף(\s|$)|silver/u, categories: NEEDLE },
  { token: 'spring', label: 'ידית קפיץ', pattern: /קפיץ|spring/u, categories: NEEDLE },
  { token: 'plum', label: 'פטיש פרח השזיף', pattern: /פטיש|plum\s*blossom|seven\s*star|סבן\s*סטאר/u, categories: NEEDLE },
  { token: 'threeedge', label: 'תלת-קצוות', pattern: /תלת|three[\s-]*edge/u, categories: NEEDLE },
  { token: 'sujok', label: "סוג'וק", pattern: /סוג'וק|סוזוק|סו\s*ז'וק|sujok|su\s*jok/u, categories: NEEDLE },
  { token: 'silicone', label: 'סיליקון', pattern: /סיליקו[ןנ]|silicon/u, categories: [...NEEDLE, ...CUP, ...GUASHA] },
  { token: 'stick', label: 'מקלות', pattern: /מקל|stick|גליל|roll(\s|$)|סיגר|cigar/u, categories: MOXA },
  { token: 'smokeless', label: 'ללא עשן', pattern: /ללא\s*עשן|נטול\s*עשן|smokeless|smoke\s*free|סמוקלס/u, categories: MOXA },
  { token: 'mini', label: 'מיני', pattern: /(\s|^)מיני(\s|$)|(\s|^)mini(\s|$)/u, categories: MOXA },
  { token: 'cone', label: 'חרוטים', pattern: /חרוט|cone|קונוס/u, categories: MOXA },
  { token: 'loose', label: 'בתפזורת', pattern: /תפזורת|תפזרות|loose|(\s|^)pure(\s|$)|טהור/u, categories: MOXA },
  { token: 'fine', label: 'עדינה', pattern: /עדינ|fine|gold|גולד/u, categories: MOXA },
  { token: 'coarse', label: 'גסה', pattern: /גס(ה|ות)|coarse/u, categories: MOXA },
  { token: 'hive', label: 'כוורת', pattern: /כוורת|honeycomb/u, categories: MOXA },
  { token: 'stickon', label: 'מדבקות', pattern: /מדבק|self[\s-]*adhesive|stick[\s-]*on/u, categories: [...MOXA, ...EAR] },
  { token: 'onneedle', label: 'על מחט', pattern: /על\s*מחט|needle\s*moxa|למחטים/u, categories: MOXA },
  { token: 'burner', label: 'מבער', pattern: /מבער|burner|קופס(ה|ת|את)\s*מוקסה|moxa\s*box|בוקס/u, categories: MOXA },
  { token: 'tiger', label: 'מחמם נמר', pattern: /מחמם\s*נמר|tiger\s*warmer|טייגר|טאייגר|ליון/u, categories: MOXA },
  { token: 'glass', label: 'זכוכית', pattern: /זכוכית|glass/u, categories: CUP },
  { token: 'plastic', label: 'פלסטיק', pattern: /פלסטיק|plastic/u, categories: [...CUP, ...GUASHA] },
  { token: 'pump', label: 'עם משאבה', pattern: /משאב|pump|ואקום|vacuum/u, categories: CUP },
  { token: 'bamboo', label: 'במבוק', pattern: /במבוק|bamboo/u, categories: CUP },
  { token: 'magnetic', label: 'מגנטי', pattern: /מגנט|magnet/u, categories: [...CUP, ...EAR] },
  { token: 'gun', label: 'אקדח', pattern: /אקדח|(\s|^)gun(\s|$)/u, categories: CUP },
  { token: 'facial', label: 'לפנים', pattern: /לפנים|(\s|^)פנים(\s|$)|facial/u, categories: [...CUP, ...GUASHA] },
  { token: 'jade', label: "ג'ייד", pattern: /ג'ייד|ג'אד|jade|ירק[ןנ]/u, categories: GUASHA },
  { token: 'horn', label: 'קרן', pattern: /קר[ןנ](\s|$)|horn|buffalo/u, categories: GUASHA },
  { token: 'steel', label: 'נירוסטה', pattern: /נירוסטה|stainless|(\s|^)steel|מתכת|metal/u, categories: [...GUASHA, ...EAR] },
  { token: 'rose', label: 'רוז קוורץ', pattern: /רוז\s*קוורץ|rose\s*quartz/u, categories: GUASHA },
  { token: 'bian', label: 'אבן ביאן', pattern: /ביאן|bian/u, categories: GUASHA },
  { token: 'vaccaria', label: 'ואקריה', pattern: /ואקריה|vaccaria|זרעי/u, categories: EAR },
  { token: 'ball', label: 'כדוריות', pattern: /כדורי|(\s|^)balls?(\s|$)|pellet|גרנול/u, categories: EAR },
  { token: 'gold', label: 'זהב', pattern: /(\s|^)זהב(\s|$)|gold/u, categories: EAR },
  { token: 'silverear', label: 'כסף', pattern: /(\s|^)כסף(\s|$)|silver/u, categories: EAR },
  { token: 'crystal', label: 'קריסטל', pattern: /קריסטל|crystal|swarovski/u, categories: EAR },
  { token: 'double', label: 'ראש כפול', pattern: /שני\s*ראשים|ראש\s*כפול|כפול|double|two\s*heads?|dual/u, categories: LAMP },
  { token: 'floor', label: 'על עמוד', pattern: /רצפתי|רצפה|עמוד|floor|(\s|^)stand(\s|$)/u, categories: LAMP },
  { token: 'desk', label: 'שולחני', pattern: /שולחני|desk|table[\s-]*top/u, categories: LAMP },
  { token: 'laser', label: 'לייזר', pattern: /לייזר|laser/u, categories: LAMP },
  { token: 'alcohol', label: 'אלכוהול', pattern: /אלכוהול|alcohol/u, categories: CONSUMABLE },
  { token: 'pad', label: 'פדים', pattern: /(\s|^)פד(ים)?(\s|$)|pads?(\s|$)|swab/u, categories: CONSUMABLE },
  { token: 'sheet', label: 'סדינים', pattern: /סדי[ןנ]|sheet/u, categories: CONSUMABLE },
  { token: 'roll', label: 'גליל', pattern: /גליל|(\s|^)rolls?(\s|$)/u, categories: CONSUMABLE },
  { token: 'paper', label: 'נייר', pattern: /נייר|paper/u, categories: CONSUMABLE },
  { token: 'nonwoven', label: 'אל-בד', pattern: /אל[\s-]*בד|אלבד|non[\s-]*woven/u, categories: CONSUMABLE },
  { token: 'glove', label: 'כפפות', pattern: /כפפ|glove/u, categories: CONSUMABLE },
  { token: 'nitrile', label: 'ניטריל', pattern: /ניטריל|nitrile/u, categories: CONSUMABLE },
  { token: 'latex', label: 'לטקס', pattern: /לטקס|latex/u, categories: CONSUMABLE },
  { token: 'vinyl', label: 'ויניל', pattern: /ויניל|vinyl/u, categories: CONSUMABLE },
  { token: 'cotton', label: 'כותנה', pattern: /צמר\s*גפ[ןנ]|כותנה|cotton/u, categories: CONSUMABLE },
  { token: 'sharps', label: 'פח מחטים', pattern: /(פח|דלי|מיכל|קונטיינר).{0,25}מחטים|sharps/u, categories: CONSUMABLE },
  { token: 'tape', label: 'טייפ', pattern: /טייפ|(\s|^)tape(\s|$)|פלסטר|plaster/u, categories: CONSUMABLE },
  { token: 'mask', label: 'מסכות', pattern: /מסכ(ה|ות)|(\s|^)masks?(\s|$)/u, categories: CONSUMABLE },
  { token: 'pillowcase', label: 'ציפיות', pattern: /ציפית|ציפיות|pillow\s*case/u, categories: CONSUMABLE },
  { token: 'headrest', label: 'כיסוי לראש', pattern: /כיסוי\s*(ראש|לראש|פנים|לפנים|בייגלה|לבייגלה)|face\s*(cradle|rest)|headrest|בייגלה/u, categories: CONSUMABLE },
  { token: 'underwear', label: 'תחתונים', pattern: /תחתו[ןנ]|underwear|briefs|thong/u, categories: CONSUMABLE },
  { token: 'powderfree', label: 'ללא אבקה', pattern: /ללא\s*אבקה|powder[\s-]*free/u, categories: CONSUMABLE },
  { token: 'disposable', label: 'חד-פעמי', pattern: /חד[\s-]*פעמי|disposable/u, categories: [...CUP, ...CONSUMABLE] },
  { token: 'set', label: 'סט', pattern: /(\s|^)(סט|ערכה|ערכת|set|kit)(\s|$)/u, categories: FEATURE_CATEGORIES },
];

/** A glove or a sheet in size S/M/L is a different item from the same in XL. */
const SIZE_LETTER = /(?:מידה|size|גודל)\s*(xs|s|m|l|xl|xxl)(?![\p{L}])/u;

const ITEM_LABELS: Record<ShopCategory, string> = {
  needles: 'מחטי דיקור',
  moxa: 'מוקסה',
  cupping: 'כוסות רוח',
  guasha: 'גואה שה',
  ear_seeds: 'זרעי אוזן',
  tdp_lamps: 'מנורת TDP',
  electro: 'מכשיר',
  granules: 'גרנולות',
  formulas: 'פורמולה',
  raw_herbs: 'צמח מרפא',
  consumables: 'מתכלים',
  accessories: 'אביזר',
};

/** Words that are the category itself, dropped from a full-token key so "granules bai zhu" equals "bai zhu". */
const CATEGORY_WORDS: Record<ShopCategory, RegExp> = {
  needles: /^(מחט|מחטים|מחטי|needle|needles|דיקור|לדיקור|acupuncture)$/u,
  moxa: /^(מוקסה|מוקסות|moxa)$/u,
  cupping: /^(כוס|כוסות|רוח|cup|cups|cupping)$/u,
  guasha: /^(גואה|שה|גואשה|גוושה|גוואשה|גווא|gua|sha|guasha)$/u,
  ear_seeds: /^(זרעי|זרע|אוזן|לאוזן|ear|seeds|seed)$/u,
  tdp_lamps: /^(מנורה|מנורת|lamp|tdp|חימום)$/u,
  electro: /^(מכשיר|device)$/u,
  granules: /^(גרנולות|גרנולה|granules|granule|אבקה|powder)$/u,
  formulas: /^(פורמולה|פורמולת|formula|טבליות|tablets|כדורים|pills|קפסולות|capsules)$/u,
  raw_herbs: /^(צמח|צמחי|צמחים|herb|herbs|מרפא|סיני|סיניים|dried|raw)$/u,
  consumables: /^(מתכלים|consumable|consumables)$/u,
  accessories: /^(אביזר|אביזרים|accessory|accessories)$/u,
};

export interface IdentifyOptions {
  category: ShopCategory;
  /** How this shop writes a needle's size; see needleDims(). */
  dimsOrder?: 'gauge_first' | 'length_first';
}

export function identify(rawName: string, options: IdentifyOptions): ProductIdentity {
  const category = options.category;
  const normalised = normaliseText(rawName);
  const brandHit = detectBrand(normalised);
  const withoutBrand = brandHit ? brandHit.rest : normalised;
  const extracted = extractMeasures(withoutBrand);
  const measures =
    category === 'needles'
      ? extracted.measures.map((m) => needleDims(m, options.dimsOrder ?? 'gauge_first'))
      : extracted.measures;
  const { pack, sizeNumber, rest: afterPack } = extractPack(extracted.rest, {
    allowBare: BARE_PACK_CATEGORIES.includes(category),
  });
  const sizeLetter = afterPack.match(SIZE_LETTER);
  const remainder = sizeLetter ? afterPack.replace(sizeLetter[0], ' ') : afterPack;
  const tokens = contentTokens(remainder);
  const models = dedupe(tokens.filter(isModelToken)).sort();
  const sizeParts: string[] = [];
  if (sizeLetter) sizeParts.push('size=' + sizeLetter[1]);
  if (sizeNumber !== null) sizeParts.push('no=' + sizeNumber);
  const sizeText = [sizeLetter ? `מידה ${sizeLetter[1].toUpperCase()}` : '', sizeNumber !== null ? `מס' ${sizeNumber}` : '']
    .filter(Boolean)
    .join(' ');

  const featureBased = brandHit !== null && FEATURE_CATEGORIES.includes(category);
  let itemKey: string;
  let displayItem: string;

  if (featureBased) {
    const hits = FEATURES.filter((f) => f.categories.includes(category) && f.pattern.test(remainder));
    const featureTokens = dedupe(hits.map((f) => f.token)).sort();
    const numbers = dedupe(tokens.filter((t) => /^\d+$/.test(t))).sort();
    const keyParts = [...featureTokens, ...models.map((m) => 'm=' + m), ...numbers.map((n) => 'n=' + n), ...sizeParts];
    itemKey = `${category}:${keyParts.join('.')}`;
    const labels = dedupe(hits.map((f) => f.label));
    const modelLabel = [...models.map((m) => m.toUpperCase()), ...numbers].join(' ');
    displayItem = [ITEM_LABELS[category], ...labels, modelLabel, sizeText].filter(Boolean).join(' ');
  } else {
    const words = dedupe(tokens.filter((t) => !CATEGORY_WORDS[category].test(t)));
    const keyWords = [...words].sort();
    itemKey = `${category}:${[...keyWords, ...sizeParts].join('.')}`;
    // A name that is only a model number ("CQ-27") keeps the category's label
    // in front of it; model numbers are shown upper-case.
    const described = words.some((w) => !isModelToken(w) && !/^\d+$/.test(w));
    const shownWords = words.map((w) => (isModelToken(w) ? w.toUpperCase() : w)).join(' ');
    const shown = words.length === 0 ? ITEM_LABELS[category] : described ? titleCaseLatin(shownWords) : `${ITEM_LABELS[category]} ${shownWords}`;
    displayItem = [shown, sizeText].filter(Boolean).join(' ');
  }

  const primary: Measure | null = measures[0] ?? null;
  const size = sizeKey(measures);
  const fingerprint = `${brandHit ? brandHit.brand.key : '-'}|${itemKey}|${size || '-'}|${pack ?? '-'}`;
  const canonicalName =
    [brandHit ? brandHit.brand.label : null, displayItem, measures.length ? sizeLabel(measures) : null]
      .filter((part): part is string => !!part)
      .join(' · ') + (pack ? ` (${pack} יח')` : '');

  return {
    brand: brandHit ? brandHit.brand.key : null,
    brandLabel: brandHit ? brandHit.brand.label : null,
    displayItem,
    itemKey,
    sizeKind: primary ? primary.kind : null,
    sizeA: primary ? primary.a : null,
    sizeB: primary ? primary.b : null,
    sizeUnit: primary ? primary.unit : null,
    packCount: pack,
    canonicalName,
    fingerprint,
    category,
  };
}

function dedupe<T>(values: T[]): T[] {
  return [...new Set(values)];
}
