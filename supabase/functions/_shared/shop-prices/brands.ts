// Brands the Israeli clinic-supply shops carry, with the spellings they use.
//
// The brand is the first part of a product's fingerprint. A listing whose
// brand cannot be recognised is never merged with another shop's listing on
// size alone: two unbranded "0.25×40 needles, 100" are more likely two
// factories than one. Adding a spelling here is how a missed merge is fixed.

export interface Brand {
  key: string;
  /** How the unified name shows it. */
  label: string;
  /** Lower-case, as they appear after normaliseText(); the longest match wins. */
  names: string[];
}

export const BRANDS: Brand[] = [
  // Needles
  { key: 'seirin', label: 'Seirin', names: ['seirin', 'סירין', 'סיירין', 'סרין', 'pyonex', 'פיונקס', 'spinex', 'ספיינקס'] },
  { key: 'sedatelec', label: 'Sedatelec', names: ['sedatelec', 'seadatlec', 'סדטלק', 'סדאטלק'] },
  { key: 'epos', label: 'Epos', names: ['epos tape', 'epos'] },
  { key: 'chosei', label: 'Chosei', names: ['chosei', "צ'וסיי"] },
  { key: 'dongbang', label: 'DongBang', names: ['dongbang', 'dong bang', 'dong-bang', 'דונג בנג', 'דונגבנג', 'דונג-בנג', 'דונג באנג'] },
  { key: 'hwato', label: 'Hwato', names: ['hwato', 'hua tuo', 'huatuo', 'הואטו', 'הוואטו', 'חואטו'] },
  { key: 'tewa', label: 'Tewa', names: ['tewa', 'טווה', 'טאווה', 'טיווה'] },
  { key: 'goldenneedle', label: 'Golden Needle', names: ['golden needle', 'goldenneedle', 'גולדן נידל', 'גולדן', 'golden'] },
  { key: 'tony', label: 'Tony', names: ['tony', 'טוני'] },
  { key: 'asiamed', label: 'asia-med', names: ['asia-med', 'asiamed', 'asia med', 'אסיה מד'] },
  { key: 'acuglide', label: 'AcuGlide', names: ['acuglide', 'acu-glide', 'אקוגלייד'] },
  { key: 'zhongyan', label: 'Zhongyan Taihe', names: ['zhongyan taihe', 'zhongyan', "ז'ונגיאן", 'זונגיאן'] },
  { key: 'cloudbreeze', label: 'Cloud & Dragon', names: ['cloud & dragon', 'cloud and dragon', 'cloud dragon'] },
  { key: 'shinlin', label: 'Shinlin', names: ['shinlin', 'שינלין'] },
  { key: 'kingli', label: 'Kingli', names: ['kingli', 'קינגלי'] },
  { key: 'carbo', label: 'Carbo', names: ['carbo', 'קרבו'] },
  { key: 'suzhou', label: 'Suzhou', names: ['suzhou', "סוג'ואו", 'סוזו'] },
  { key: 'yuguang', label: 'Yu Guang', names: ['yu guang', 'yuguang'] },
  { key: 'vinco', label: 'Vinco', names: ['vinco', 'וינקו'] },
  { key: 'serin', label: 'SeRin', names: ['serin'] },
  // Moxa and cupping
  { key: 'kangzhu', label: 'Kangzhu', names: ['kangzhu', 'kang zhu', "קאנג ג'ו", 'קנגזו', "קאנגז'ו"] },
  { key: 'hansol', label: 'Hansol', names: ['hansol', 'הנסול', 'האנסול'] },
  { key: 'haci', label: 'Haci', names: ['haci', 'האצי'] },
  { key: 'nanyang', label: 'Nanyang', names: ['nanyang', 'nan yang', 'נאניאנג'] },
  { key: 'ibuki', label: 'Ibuki', names: ['ibuki', 'איבוקי'] },
  { key: 'kamaya', label: 'Kamaya', names: ['kamaya', 'קמאיה'] },
  // Lamps and devices
  { key: 'ito', label: 'ITO', names: ['ito ', 'איטו'] },
  { key: 'kwd', label: 'KWD', names: ['kwd'] },
  { key: 'pointer', label: 'Pointer', names: ['pointer plus', 'pointer excel', 'פוינטר'] },
  { key: 'es160', label: 'ES-160', names: ['es-160', 'es 160'] },
  // Granules and patents
  { key: 'sunten', label: 'Sun Ten', names: ['sun ten', 'sunten', 'סאן טן', 'סאנטן'] },
  { key: 'kpc', label: 'KPC', names: ['kpc', 'קייפיסי'] },
  { key: 'efong', label: 'E-Fong', names: ['e-fong', 'efong', 'e fong', 'אי פונג', 'אי-פונג'] },
  { key: 'tianjiang', label: 'Tianjiang', names: ['tianjiang', 'tian jiang', "טיאנג'יאנג", 'טיאנגיאנג'] },
  { key: 'evergreen', label: 'Evergreen', names: ['evergreen', 'אוורגרין'] },
  { key: 'treasure', label: 'Treasure of the East', names: ['treasure of the east', 'treasures of the east'] },
  { key: 'kaiser', label: 'Kaiser', names: ['kaiser pharmaceutical', 'kaiser', 'קייזר'] },
  { key: 'plumflower', label: 'Plum Flower', names: ['plum flower', 'plumflower', 'פלאם פלאוור'] },
  { key: 'minshan', label: 'Min Shan', names: ['min shan', 'minshan'] },
  { key: 'guangci', label: 'Guang Ci Tang', names: ['guang ci tang', 'guangci'] },
  { key: 'lanzhou', label: 'Lanzhou', names: ['lanzhou', 'לנזו'] },
  { key: 'herbalist', label: 'Herbalist', names: ['herbalist'] },
];

const byLength = [...BRANDS]
  .flatMap((brand) => brand.names.map((name) => ({ brand, name })))
  .sort((a, b) => b.name.length - a.name.length);

/**
 * The brand named in a normalised product name, and the text without it.
 * Word boundaries are checked by hand because `\b` knows nothing of Hebrew.
 */
export function detectBrand(text: string): { brand: Brand; rest: string } | null {
  for (const { brand, name } of byLength) {
    const needle = name.trim();
    let from = 0;
    while (from <= text.length) {
      const at = text.indexOf(needle, from);
      if (at < 0) break;
      const before = at === 0 ? ' ' : text[at - 1];
      const afterIndex = at + needle.length;
      const after = afterIndex >= text.length ? ' ' : text[afterIndex];
      if (!isWordChar(before) && !isWordChar(after)) {
        const rest = (text.slice(0, at) + ' ' + text.slice(afterIndex)).replace(/\s+/g, ' ').trim();
        return { brand, rest };
      }
      from = at + 1;
    }
  }
  return null;
}

function isWordChar(ch: string): boolean {
  return /[\p{L}\p{N}]/u.test(ch);
}
