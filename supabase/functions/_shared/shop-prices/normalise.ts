// Turning a shop's product name into something two shops can agree on.
//
// The shops write the same thing many ways: "0.25X40", "0.25*40 מ״מ",
// "0,25 x 40mm"; "100 יח'", "אריזה של 100", "100pcs"; "מ"ל" with a quotation
// mark or with a gershayim. Everything here maps those to one form, pulls the
// measurements and the pack size out, and leaves the words that describe the
// item. Hebrew word boundaries are handled by hand throughout: JavaScript's
// `\b` only knows Latin letters and digits.

import { decodeEntities } from './html.ts';
import type { SizeKind } from './types.ts';

export interface Measure {
  kind: SizeKind;
  a: number;
  b: number | null;
  unit: string;
}

const KIND_ORDER: SizeKind[] = ['dims', 'mass', 'vol', 'len', 'pct'];

/** Lower-case, entities decoded, quotes unified, decimal commas fixed, `×`/`*`/`על` between numbers → `x`. */
export function normaliseText(raw: string): string {
  let s = decodeEntities(raw).normalize('NFKC').toLowerCase();
  s = s.replace(/[\u0591-\u05C7]/g, '');
  s = s.replace(/[״“”]/g, '"').replace(/[׳‘’`´]/g, "'");
  s = s.replace(/(\d),(\d)/g, '$1.$2');
  s = s.replace(/(\d)\s*[×x*]\s*(?=\d)/g, '$1x');
  s = s.replace(/(\d)\s+על\s+(?=\d)/g, '$1x');
  // Punctuation that only separates. The dot stays for decimals, the quote for
  // Hebrew abbreviations (מ"מ), the percent sign and the hyphen for models.
  s = s.replace(/[|/\\,;:()[\]{}!?#+_=<>~^@&]+/g, ' ');
  s = s.replace(/\s+[-–—]+\s+/g, ' ');
  s = s.replace(/[–—]/g, '-');
  // A hyphen between Hebrew letters joins two words (חד-פעמי), and one between
  // a Hebrew letter and a digit or a Latin word is a dash the shop typed
  // without spaces (ב-150, מוליך-golden); between Latin letters and digits it
  // is part of a model number (cq-27) and is kept.
  s = s.replace(/([א-ת])-(?=[א-ת\da-z])/g, '$1 ');
  s = s.replace(/([\da-z])-(?=[א-ת])/g, '$1 ');
  s = s.replace(/(^|\s)-+|-+(?=\s|$)/g, '$1');
  s = s.replace(/\.(?=\s|$)/g, ' ');
  return s.replace(/\s+/g, ' ').trim();
}

const NUM = '(\\d+(?:\\.\\d+)?)';
const NOT_LETTER_AFTER = "(?![\\p{L}\\p{N}])";
const NOT_DIGIT_BEFORE = '(?<![\\d.])';

const MM = '(?:mm|מ"מ|ממ|מילימטר|millimet(?:er|re)s?)';
const CM = '(?:cm|ס"מ|סמ|סנטימטר|centimet(?:er|re)s?)';
const M = '(?:m|מטר|met(?:er|re)s?)';
const G = '(?:g|gr|grams?|גרם|גר)';
const KG = '(?:kg|ק"ג|קג|קילו|kilograms?)';
const ML = '(?:ml|מ"ל|מל|מיליליטר|millilit(?:er|re)s?)';
const L = '(?:l|lt|liters?|litres?|ליטר)';

function re(source: string): RegExp {
  return new RegExp(source, 'iu');
}

const DIMS = re(`${NOT_DIGIT_BEFORE}${NUM}\\s*(${MM}|${CM})?\\s*x\\s*${NUM}\\s*(${MM}|${CM})?${NOT_LETTER_AFTER}`);
const MASS_KG = re(`${NOT_DIGIT_BEFORE}${NUM}\\s*${KG}${NOT_LETTER_AFTER}`);
const MASS_G = re(`${NOT_DIGIT_BEFORE}${NUM}\\s*${G}${NOT_LETTER_AFTER}`);
const VOL_L = re(`${NOT_DIGIT_BEFORE}${NUM}\\s*${L}${NOT_LETTER_AFTER}`);
const VOL_ML = re(`${NOT_DIGIT_BEFORE}${NUM}\\s*${ML}${NOT_LETTER_AFTER}`);
const PCT = re(`${NOT_DIGIT_BEFORE}${NUM}\\s*%`);
const LEN_MM = re(`${NOT_DIGIT_BEFORE}${NUM}\\s*${MM}${NOT_LETTER_AFTER}`);
const LEN_CM = re(`${NOT_DIGIT_BEFORE}${NUM}\\s*${CM}${NOT_LETTER_AFTER}`);
const LEN_M = re(`${NOT_DIGIT_BEFORE}${NUM}\\s*${M}${NOT_LETTER_AFTER}`);

function unitOf(token: string | undefined, fallback: string): string {
  if (!token) return fallback;
  if (re(`^${CM}$`).test(token)) return 'cm';
  return 'mm';
}

function num(text: string): number {
  return Number(text);
}

/**
 * The measurements in a normalised name, in a fixed order, and the name with
 * them blanked out. Dimensions first so "0.25x40mm" is one measure, not a
 * dimension and a length.
 */
export function extractMeasures(text: string): { measures: Measure[]; rest: string } {
  const measures: Measure[] = [];
  let rest = text;
  const take = (pattern: RegExp, make: (m: RegExpMatchArray) => Measure | null): void => {
    for (let guard = 0; guard < 6; guard++) {
      const m = rest.match(pattern);
      if (!m || m.index === undefined) return;
      const made = make(m);
      rest = rest.slice(0, m.index) + ' ' + rest.slice(m.index + m[0].length);
      if (made) measures.push(made);
    }
  };
  take(DIMS, (m) => ({ kind: 'dims', a: num(m[1]), b: num(m[3]), unit: unitOf(m[4] ?? m[2], 'mm') }));
  take(MASS_KG, (m) => ({ kind: 'mass', a: num(m[1]) * 1000, b: null, unit: 'g' }));
  take(MASS_G, (m) => ({ kind: 'mass', a: num(m[1]), b: null, unit: 'g' }));
  take(VOL_L, (m) => ({ kind: 'vol', a: num(m[1]) * 1000, b: null, unit: 'ml' }));
  take(VOL_ML, (m) => ({ kind: 'vol', a: num(m[1]), b: null, unit: 'ml' }));
  take(PCT, (m) => ({ kind: 'pct', a: num(m[1]), b: null, unit: '%' }));
  take(LEN_MM, (m) => ({ kind: 'len', a: num(m[1]), b: null, unit: 'mm' }));
  take(LEN_CM, (m) => ({ kind: 'len', a: num(m[1]), b: null, unit: 'cm' }));
  take(LEN_M, (m) => ({ kind: 'len', a: num(m[1]), b: null, unit: 'm' }));
  measures.sort((x, y) => KIND_ORDER.indexOf(x.kind) - KIND_ORDER.indexOf(y.kind) || x.a - y.a);
  return { measures, rest: rest.replace(/\s+/g, ' ').trim() };
}

/**
 * A needle's size is written gauge × length by most shops ("0.25x40") and
 * length × gauge by some ("40*25", "15*16"); a gauge is sometimes given in
 * hundredths of a millimetre ("30*16" for 0.30 × 16 mm). This puts every
 * needle at gauge-in-millimetres × length-in-millimetres.
 */
export function needleDims(measure: Measure, order: 'gauge_first' | 'length_first'): Measure {
  if (measure.kind !== 'dims' || measure.b === null || measure.unit !== 'mm') return measure;
  let gauge = order === 'length_first' ? measure.b : measure.a;
  const length = order === 'length_first' ? measure.a : measure.b;
  if (gauge >= 10) gauge = gauge / 100;
  return { kind: 'dims', a: gauge, b: length, unit: 'mm' };
}

const COUNT_WORDS =
  "(?:יח'?|יחידות|יחי'?|pcs?|pieces?|units?|מחטים|needles?|שקיות|כוסות|מקלות|sticks?|cups?|pairs?|זוגות|קפסולות|caps(?:ules)?|טבליות|tablets?|כדורים|pills?|בקבוקים|bottles?|גלילים|rolls?|סדינים|sheets?|מדבקות|patches|זרעים|seeds?|נעצים|פדים|pads)";

const PACK_PATTERNS: RegExp[] = [
  re(`${NOT_DIGIT_BEFORE}(\\d{1,4})\\s*${COUNT_WORDS}${NOT_LETTER_AFTER}`),
  re(`(?:אריזה של|אריזת|קופסה של|קופסת|מארז של|מארז|חבילה של|חבילת|pack of|box of|set of)\\s*(\\d{1,4})${NOT_LETTER_AFTER}`),
  re(`${NOT_DIGIT_BEFORE}(\\d{1,4})\\s*(?:באריזה|בקופסה|בקופסא|במארז|בחבילה|per box|per pack|in a box)`),
  re(`${NOT_DIGIT_BEFORE}x\\s*(\\d{1,4})\\s*$`),
];

/** "מס' 3", "גודל 2", "size 4", "#5": the size number of a cup or a gauge, not a pack. */
const SIZE_NUMBER = re(`(?:מס'|מספר|גודל|size|no\\.?|#)\\s*(\\d{1,2})${NOT_LETTER_AFTER}`);

export interface PackResult {
  pack: number | null;
  /** A small size number found beside a size word, kept apart from the pack. */
  sizeNumber: number | null;
  rest: string;
}

function cut(text: string, index: number, length: number): string {
  return (text.slice(0, index) + ' ' + text.slice(index + length)).replace(/\s+/g, ' ').trim();
}

/**
 * The pack size named in a normalised name (after the measures are gone),
 * and the name without it. With `allowBare`, a number at the very end of a
 * name that has no other digit counts too ("כוסות רוח סיליקון 12", "ASP 80")
 * — when it is ten or more; a smaller one is a size number.
 */
export function extractPack(text: string, options: { allowBare?: boolean } = {}): PackResult {
  let rest = text;
  let sizeNumber: number | null = null;
  const sized = rest.match(SIZE_NUMBER);
  if (sized && sized.index !== undefined) {
    sizeNumber = Number(sized[1]);
    rest = cut(rest, sized.index, sized[0].length);
  }
  for (const pattern of PACK_PATTERNS) {
    const m = rest.match(pattern);
    if (m && m.index !== undefined) {
      const pack = Number(m[1]);
      if (pack > 0 && pack <= 5000) return { pack, sizeNumber, rest: cut(rest, m.index, m[0].length) };
    }
  }
  const tail = rest.match(/\s(\d{1,4})\s*$/);
  if (tail && tail.index !== undefined && !/\d/.test(rest.slice(0, tail.index))) {
    const value = Number(tail[1]);
    const before = rest.slice(0, tail.index).trim();
    if (options.allowBare && value >= 10) return { pack: value, sizeNumber, rest: before };
    if (value < 10 && sizeNumber === null) return { pack: null, sizeNumber: value, rest: before };
  }
  return { pack: null, sizeNumber, rest };
}

/**
 * Words that describe the offer, not the thing: sales talk, quality claims,
 * "original", "for therapists". Dropped before the words are compared.
 * "עם" and "ללא" are not here: with or without a guide tube is the product.
 */
const NOISE = [
  'מבצע',
  'מבצעים',
  'חדש',
  'חדשה',
  'new',
  'sale',
  'הנחה',
  'במלאי',
  'מקורי',
  'מקורית',
  'מקוריות',
  'מקוריים',
  'original',
  'איכותי',
  'איכותית',
  'איכותיות',
  'איכותיים',
  'איכות',
  'מומלץ',
  'מומלצת',
  'מומלצות',
  'premium',
  'פרימיום',
  'מקצועי',
  'מקצועית',
  'מקצועיות',
  'מקצועיים',
  'professional',
  'למטפלים',
  'למטפל',
  'למטפלת',
  'לקליניקה',
  'לקליניקות',
  'best',
  'seller',
  'bestseller',
  'יבוא',
  'יבואן',
  'ישיר',
  'משלוח',
  'חינם',
  'מיוחד',
  'מיוחדת',
  'מעולה',
  'מעולים',
  'הכי',
  'נמכר',
  'טופ',
  'top',
  'quality',
  'high',
  'the',
  'of',
  'and',
  'for',
  'של',
  'לפי',
  'עבור',
  'מגוון',
  'סוגים',
  'דגם',
  'model',
  'type',
  'סוג',
  'מארז',
  'במארז',
  'אריזה',
  'אריזת',
  'באריזה',
  'קופסה',
  'קופסת',
  'בקופסה',
  'בקופסא',
  'חבילה',
  'בחבילה',
  'pack',
  'box',
  'יחידות',
  "יח'",
  'יח',
  'pcs',
  'pc',
  'units',
  'unit',
  'ש"ח',
  'שח',
  'בלבד',
  'רק',
  'only',
  'תוצרת',
  'made',
  'in',
  // "for disinfection", "medical": what alcohol is for, not which alcohol.
  'לחיטוי',
  'רפואי',
  'רפואית',
  'medical',
  'לשימוש',
];
const NOISE_SET = new Set(NOISE);

/** The words of a normalised name, without the noise. Numbers stay: "premio 10" and "premio 32" are two devices. */
export function contentTokens(text: string): string[] {
  return text
    .split(/\s+/)
    .map((token) => token.replace(/^['".]+|['".]+$/g, ''))
    .filter((token) => token.length > 0 && !NOISE_SET.has(token));
}

/** A model number: letters then digits, "cq-27", "kwd808", "es-160", "sdz-ii". */
export function isModelToken(token: string): boolean {
  return /^[a-z]{1,5}-?\d{1,4}[a-z]?$/u.test(token) || /^[a-z]{1,5}-(?:i|ii|iii|iv|v)$/u.test(token);
}

/** "Bai Zhu Granules", not "bai zhu granules": Latin words get an initial capital, Hebrew is left alone. */
export function titleCaseLatin(text: string): string {
  return text.replace(/(^|\s)([a-z])/g, (_, before: string, letter: string) => before + letter.toUpperCase());
}

/** A number as the fingerprint writes it: no trailing zeros, no exponent. */
export function numberKey(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(4)));
}

/** The measurements as one string for the fingerprint: `dims:0.25x40mm,vol:1000ml`. */
export function sizeKey(measures: Measure[]): string {
  return measures
    .map((m) => `${m.kind}:${numberKey(m.a)}${m.b !== null ? 'x' + numberKey(m.b) : ''}${m.unit === '%' ? '%' : m.unit}`)
    .join(',');
}

/** The measurements as the unified name shows them: 0.25×40 מ"מ · 1 ליטר · 70%. */
export function sizeLabel(measures: Measure[]): string {
  return measures.map(measureLabel).join(', ');
}

function measureLabel(m: Measure): string {
  switch (m.kind) {
    case 'dims':
      return `${numberKey(m.a)}×${numberKey(m.b ?? 0)} ${m.unit === 'cm' ? 'ס"מ' : 'מ"מ'}`;
    case 'mass':
      return m.a >= 1000 && Number.isInteger(m.a / 100) ? `${numberKey(m.a / 1000)} ק"ג` : `${numberKey(m.a)} גרם`;
    case 'vol':
      return m.a >= 1000 && Number.isInteger(m.a / 100) ? `${numberKey(m.a / 1000)} ליטר` : `${numberKey(m.a)} מ"ל`;
    case 'len':
      return `${numberKey(m.a)} ${m.unit === 'cm' ? 'ס"מ' : m.unit === 'm' ? 'מטר' : 'מ"מ'}`;
    case 'pct':
      return `${numberKey(m.a)}%`;
  }
}
