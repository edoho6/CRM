// From the words a source uses to the keys the catalogue stores: the herb
// and formula categories, the temperature scale, tastes, channels, doses
// and point codes. Every rule is a plain pattern, so an unmapped value is a
// line in the report and a new rule here, never a guess at import time.
//
// The keys mirror packages/domain/src/enums.ts; a test there checks the two
// lists still agree, because this file cannot import the domain package
// (it must run under Node's type stripping without a bundler).

export const HERB_CATEGORIES = [
  'release_exterior_warm',
  'release_exterior_cool',
  'clear_heat_drain_fire',
  'clear_heat_cool_blood',
  'clear_heat_dry_dampness',
  'clear_heat_relieve_toxicity',
  'clear_deficient_heat',
  'clear_summer_heat',
  'downward_draining',
  'moist_laxative',
  'harsh_expellant',
  'drain_dampness',
  'dispel_wind_dampness',
  'aromatic_transform_dampness',
  'transform_phlegm_cold',
  'transform_phlegm_heat',
  'relieve_cough_wheezing',
  'relieve_food_stagnation',
  'regulate_qi',
  'stop_bleeding',
  'invigorate_blood',
  'warm_interior',
  'tonify_qi',
  'tonify_blood',
  'tonify_yang',
  'tonify_yin',
  'stabilize_bind',
  'calm_spirit_anchor',
  'calm_spirit_nourish',
  'aromatic_open_orifices',
  'extinguish_wind',
  'expel_parasites',
  'external_application',
  'western',
  'other',
] as const;
export type HerbCategory = (typeof HERB_CATEGORIES)[number];

export const FORMULA_CATEGORIES = [
  'release_exterior',
  'clear_heat',
  'purge',
  'harmonize',
  'treat_dryness',
  'expel_dampness',
  'warm_interior',
  'tonify',
  'regulate_qi',
  'invigorate_blood',
  'stop_bleeding',
  'stabilize_bind',
  'calm_spirit',
  'open_orifices',
  'extinguish_wind',
  'treat_phlegm',
  'reduce_food_stagnation',
  'expel_parasites',
  'other',
] as const;
export type FormulaCategory = (typeof FORMULA_CATEGORIES)[number];

export const TEMPERATURES = [
  'hot',
  'warm',
  'slightly_warm',
  'neutral',
  'cool',
  'slightly_cold',
  'cold',
  'very_cold',
] as const;
export type Temperature = (typeof TEMPERATURES)[number];

export const TASTES = [
  'sweet',
  'bitter',
  'acrid',
  'sour',
  'salty',
  'bland',
  'astringent',
  'aromatic',
] as const;
export type Taste = (typeof TASTES)[number];

export const CHANNELS = [
  'lung',
  'large_intestine',
  'stomach',
  'spleen',
  'heart',
  'small_intestine',
  'bladder',
  'kidney',
  'pericardium',
  'san_jiao',
  'gallbladder',
  'liver',
] as const;
export type Channel = (typeof CHANNELS)[number];

const FINAL_LETTERS: Record<string, string> = { ם: 'מ', ן: 'נ', ץ: 'צ', ף: 'פ', ך: 'כ' };

/**
 * Hebrew as Bara writes it, folded so a stray apostrophe, a dash or a final
 * letter does not matter: "מחממי פנים" and "מחמם פנים" must meet the same
 * rule, so final letters become their plain form and the patterns below are
 * written with plain forms only.
 */
export function foldHebrew(text: string): string {
  return text
    .replace(/[֑-ׇ]/g, '')
    .replace(/['"״׳`]/g, '')
    .replace(/[םןץףך]/g, (letter) => FINAL_LETTERS[letter] ?? letter)
    .replace(/[-–—/,.()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

type Rule<K> = [RegExp, K];

// Patterns are written with plain (non-final) Hebrew letters: see foldHebrew.
const HERB_CATEGORY_HE: Rule<HerbCategory>[] = [
  [/משחרר.*חיצונ.*(קריר|קר)/, 'release_exterior_cool'],
  [/משחרר.*חיצונ/, 'release_exterior_warm'],
  [/אש ורעילות|רעילות/, 'clear_heat_relieve_toxicity'],
  [/מקרר.*דמ|קירור דמ/, 'clear_heat_cool_blood'],
  [/חומ.*(מחוסר|חוסר)/, 'clear_deficient_heat'],
  [/חומ קיצ/, 'clear_summer_heat'],
  [/(חומ|אש).*(לחות|לח )/, 'clear_heat_dry_dampness'],
  [/מסלק.*אש|מטהר.*אש|מנקז.*אש|מקרר.*(חומ|אש)/, 'clear_heat_drain_fire'],
  [/משלשל|בעצמה|harsh/, 'harsh_expellant'],
  [/מרוקנ.*מלחלח|מלחלח.*מעי/, 'moist_laxative'],
  [/מרוקנ/, 'downward_draining'],
  [/רוח.*לחות|רוח לחות/, 'dispel_wind_dampness'],
  [/מנקז.*לחות|משתנ/, 'drain_dampness'],
  [/ארומט.*(לחות|ליחה)/, 'aromatic_transform_dampness'],
  [/ליחה.*(קר|קור)|ליחה קרה/, 'transform_phlegm_cold'],
  [/ליחה.*(חמ|חומ)|ליחת חומ/, 'transform_phlegm_heat'],
  [/שיעול|צפצופ/, 'relieve_cough_wheezing'],
  [/תקיעות מזונ|תקיעות|מזונ/, 'relieve_food_stagnation'],
  [/(מניע|מווסת).*צי/, 'regulate_qi'],
  [/מפסיק.*דימומ|עוצר.*דימומ|דימומ/, 'stop_bleeding'],
  [/מניע.*דמ/, 'invigorate_blood'],
  [/מחממ.*פנימ/, 'warm_interior'],
  [/מחזק.*צי/, 'tonify_qi'],
  [/מחזק.*דמ/, 'tonify_blood'],
  [/מחזק.*(יאנג|yang)/, 'tonify_yang'],
  [/מחזק.*(יינ|yin)/, 'tonify_yin'],
  [/סופח|מכווצ|מייצב/, 'stabilize_bind'],
  [/מרג(י|)ע.*נפש.*מכביד/, 'calm_spirit_anchor'],
  [/מרג(י|)ע.*נפש/, 'calm_spirit_nourish'],
  [/פותח.*פתח/, 'aromatic_open_orifices'],
  [/רוח.*רעיד|רעידות|רוח פנימית/, 'extinguish_wind'],
  [/פרזיט|תולע/, 'expel_parasites'],
  [/חיצוני|שימוש חיצוני/, 'external_application'],
  [/צמחי מערב|מערבי/, 'western'],
];

const HERB_CATEGORY_EN: Rule<HerbCategory>[] = [
  // "Warm, Acrid Herbs that Release the Exterior (Wind-Cold Diaphoretics)" —
  // the nature is the word before "acrid"; the parenthetical names what the
  // herb is aimed at, so a bare search for "cold" reads it backwards.
  [/(cool|cold),?\s+acrid|acrid,?\s+(cool|cold)/, 'release_exterior_cool'],
  [/(warm|hot),?\s+acrid|acrid,?\s+(warm|hot)/, 'release_exterior_warm'],
  [/release.*exterior.*wind.?heat/, 'release_exterior_cool'],
  [/release.*exterior/, 'release_exterior_warm'],
  [/summer.?heat/, 'clear_summer_heat'],
  [/(clear|reduce).*heat.*(deficien)|deficien.*heat|deficiency fire/, 'clear_deficient_heat'],
  [/(relieve|resolve|remove|clear).*toxic|toxin/, 'clear_heat_relieve_toxicity'],
  [/cool.*blood|blood.*heat/, 'clear_heat_cool_blood'],
  [/dry.*damp|heat.*damp/, 'clear_heat_dry_dampness'],
  [/drain.*fire|clear.*heat|purge.*fire/, 'clear_heat_drain_fire'],
  [/harsh|cathartic|drastic/, 'harsh_expellant'],
  [/moist.*laxat|lubricat.*intestin|moisten/, 'moist_laxative'],
  [/downward|purgativ|laxativ/, 'downward_draining'],
  [/wind.?damp|wind and damp/, 'dispel_wind_dampness'],
  [/aromatic.*damp|transform.*damp/, 'aromatic_transform_dampness'],
  [/drain.*damp|regulate.*water|urination|diuretic|leach/, 'drain_dampness'],
  [/(cool|cold|heat|hot).*phlegm.*heat|phlegm.?heat|cool.*phlegm/, 'transform_phlegm_heat'],
  [/cold.*phlegm|warm.*phlegm|phlegm.*cold/, 'transform_phlegm_cold'],
  [/cough|wheez/, 'relieve_cough_wheezing'],
  [/food.*stagnation|digest/, 'relieve_food_stagnation'],
  [/regulate.*qi|move.*qi|qi.*regulat/, 'regulate_qi'],
  [/stop.*bleed|hemostat|haemostat|bleeding/, 'stop_bleeding'],
  [
    /invigorat.*blood|blood.*stasis|move.*blood|activate.*blood|regulate.*blood/,
    'invigorate_blood',
  ],
  [/warm.*interior|expel.*cold|interior.*cold/, 'warm_interior'],
  [/tonif.*qi|qi.*tonic|supplement.*qi/, 'tonify_qi'],
  [/tonif.*blood|blood.*tonic|nourish.*blood/, 'tonify_blood'],
  [/tonif.*yang|yang.*tonic/, 'tonify_yang'],
  [/tonif.*yin|yin.*tonic|nourish.*yin/, 'tonify_yin'],
  [/astringent|stabiliz|bind|secure|consolidat/, 'stabilize_bind'],
  [
    /(anchor|settle|heavy|sedat|weigh).*(spirit|shen)|(spirit|shen).*(anchor|settle|heavy)/,
    'calm_spirit_anchor',
  ],
  [/(nourish).*(spirit|shen|heart)|calm.*(spirit|shen)/, 'calm_spirit_nourish'],
  [/orifice/, 'aromatic_open_orifices'],
  [/extinguish.*wind|internal.*wind|liver.*wind|tremor|spasm/, 'extinguish_wind'],
  [/parasit|anthelmint|worm/, 'expel_parasites'],
  [/external|topical/, 'external_application'],
];

export function mapHerbCategory(
  raw: string | null | undefined,
  lang: 'he' | 'en',
): HerbCategory | null {
  if (!raw) return null;
  const rules = lang === 'he' ? HERB_CATEGORY_HE : HERB_CATEGORY_EN;
  const text = lang === 'he' ? foldHebrew(raw) : raw.toLowerCase().replace(/\s+/g, ' ');
  for (const [pattern, key] of rules) if (pattern.test(text)) return key;
  return null;
}

const FORMULA_CATEGORY_HE: Rule<FormulaCategory>[] = [
  [/משחרר.*חיצונ|חיצונ/, 'release_exterior'],
  [/מטהר.*חומ|מסלק.*חומ|חומ/, 'clear_heat'],
  [/מרוקנ.*מעי|מלחלח.*מעי|מרוקנ|משלשל/, 'purge'],
  [/מאזנ|הרמוני/, 'harmonize'],
  [/יובש/, 'treat_dryness'],
  [/לחות/, 'expel_dampness'],
  [/רוח פנימית/, 'extinguish_wind'],
  [/מחממ.*פנימ|(^| )פנימ( |$)/, 'warm_interior'],
  [/מחזק|חיזוק/, 'tonify'],
  [/(מניע|מווסת).*צי/, 'regulate_qi'],
  [/מניע.*דמ/, 'invigorate_blood'],
  [/דימומ/, 'stop_bleeding'],
  [/מייצב|סופח|מכווצ/, 'stabilize_bind'],
  [/נפש/, 'calm_spirit'],
  [/פתח/, 'open_orifices'],
  [/רוח פנימית|רוח/, 'extinguish_wind'],
  [/ליחה/, 'treat_phlegm'],
  [/תקיעות מזונ|מזונ/, 'reduce_food_stagnation'],
  [/פרזיט|תולע/, 'expel_parasites'],
];

export function mapFormulaCategory(raw: string | null | undefined): FormulaCategory | null {
  if (!raw) return null;
  const text = foldHebrew(raw);
  for (const [pattern, key] of FORMULA_CATEGORY_HE) if (pattern.test(text)) return key;
  return null;
}

/**
 * A formula category read off its stated actions, when no source names
 * one. The chief action is usually listed first, so earlier lines weigh
 * more. The caller marks the result as inferred.
 */
const FORMULA_ACTION_RULES: Rule<FormulaCategory>[] = [
  [
    /releases? the exterior|release.*exterior|induces? sweat|expel.*wind.?cold|expel.*wind.?heat|disperse.*wind/,
    'release_exterior',
  ],
  [
    /clears? heat|drains? fire|clear.*fire|resolves? toxi|cools? the blood|clears? summer/,
    'clear_heat',
  ],
  [/purge|drains? downward|unblock.*bowel|moisten.*intestin|laxat/, 'purge'],
  [/harmoniz|shao ?yang|liver and spleen|liver and stomach|stomach and intestines/, 'harmonize'],
  [/moisten.*dry|dryness|generate.*fluid|nourish.*lung.*yin/, 'treat_dryness'],
  [/damp|promotes? urination|leach|resolves? water|edema/, 'expel_dampness'],
  [
    /warms? the (interior|middle|channels|kidney|spleen)|expel.*cold|rescues? .*yang|warms? yang/,
    'warm_interior',
  ],
  [/tonif|nourish|supplement|augment|strengthen|fortif|replenish/, 'tonify'],
  [
    /regulates? qi|moves? qi|spreads? .*qi|descends? .*qi|qi stagnation|relieve.*stagnation/,
    'regulate_qi',
  ],
  [
    /invigorat.*blood|blood stasis|blood stagnation|dispel.*stasis|moves? .*blood/,
    'invigorate_blood',
  ],
  [/stops? bleeding|bleeding/, 'stop_bleeding'],
  [
    /astringe|stabiliz|secure|bind|restrain|consolidat|stop.*(diarrhea|sweating|leakage)/,
    'stabilize_bind',
  ],
  [/calms? the (spirit|shen|mind|heart)|calm.*spirit|sedat|spirit/, 'calm_spirit'],
  [/open.*orifice|revive.*conscious|restore.*conscious/, 'open_orifices'],
  [/extinguish.*wind|internal wind|liver wind|stops? (tremor|spasm|convulsion)/, 'extinguish_wind'],
  [/phlegm|cough|wheez/, 'treat_phlegm'],
  [/food stagnation|food retention|digest|reduce.*accumulation/, 'reduce_food_stagnation'],
  [/parasit|worm/, 'expel_parasites'],
];

export function inferFormulaCategory(actions: string[]): FormulaCategory | null {
  const scores = new Map<FormulaCategory, number>();
  actions.forEach((action, index) => {
    const text = action.toLowerCase();
    const weight = 1 / (index + 1);
    for (const [pattern, key] of FORMULA_ACTION_RULES) {
      if (pattern.test(text)) {
        scores.set(key, (scores.get(key) ?? 0) + weight);
        break;
      }
    }
  });
  let best: FormulaCategory | null = null;
  let bestScore = 0;
  for (const [key, score] of scores) {
    if (score > bestScore) {
      best = key;
      bestScore = score;
    }
  }
  return best;
}

const TEMPERATURE_HE: Rule<Temperature>[] = [
  [/קר מאוד|קר ביותר/, 'very_cold'],
  [/מעט קר(?!יר)/, 'slightly_cold'],
  [/מעט קריר|קריר/, 'cool'],
  [/(^| )קר( |$)/, 'cold'],
  [/ניטרל|נייטרל|נייטראל|פושר/, 'neutral'],
  [/מעט חמימ|מעט חמ( |$)/, 'slightly_warm'],
  [/חמימ/, 'warm'],
  [/חמ מאוד|חמ ביותר/, 'hot'],
  [/(^| )חמ( |$)/, 'hot'],
  [/מקרר/, 'cool'],
  [/מחממ/, 'warm'],
];

const TEMPERATURE_EN: Rule<Temperature>[] = [
  [/very cold|extremely cold/, 'very_cold'],
  [/slightly cold|mildly cold/, 'slightly_cold'],
  [/slightly cool|cool/, 'cool'],
  [/cold/, 'cold'],
  [/neutral|mild/, 'neutral'],
  [/slightly warm|mildly warm/, 'slightly_warm'],
  [/very hot|extremely hot|hot/, 'hot'],
  [/warm/, 'warm'],
];

export function mapTemperature(
  raw: string | null | undefined,
  lang: 'he' | 'en',
): Temperature | null {
  if (!raw) return null;
  const rules = lang === 'he' ? TEMPERATURE_HE : TEMPERATURE_EN;
  const text =
    lang === 'he' ? ` ${foldHebrew(raw)} ` : ` ${raw.toLowerCase().replace(/\s+/g, ' ')} `;
  for (const [pattern, key] of rules) if (pattern.test(text)) return key;
  return null;
}

export function isToxic(raw: string | null | undefined): boolean {
  return Boolean(raw && /רעיל|toxic|poison/i.test(raw));
}

const TASTE_HE: Rule<Taste>[] = [
  [/מתוק/, 'sweet'],
  [/(^| )מר( |$)|מריר/, 'bitter'],
  [/חריפ/, 'acrid'],
  [/חמוצ/, 'sour'],
  [/מלוח/, 'salty'],
  [/חסר טעמ|תפל|נטול טעמ/, 'bland'],
  [/מכווצ|עפיצ|עוצר/, 'astringent'],
  [/ארומט|ריחני/, 'aromatic'],
];

const TASTE_EN: Rule<Taste>[] = [
  [/sweet/, 'sweet'],
  [/bitter/, 'bitter'],
  [/acrid|pungent|spicy|hot/, 'acrid'],
  [/sour/, 'sour'],
  [/salty|salt/, 'salty'],
  [/bland|tasteless|insipid/, 'bland'],
  [/astringent/, 'astringent'],
  [/aromatic|fragrant/, 'aromatic'],
];

/** Every taste named anywhere in the text, in the order of the enum. */
export function mapTastes(raw: string | string[] | null | undefined, lang: 'he' | 'en'): Taste[] {
  if (!raw) return [];
  const parts = (Array.isArray(raw) ? raw : [raw]).flatMap((part) => part.split(/[,،;/\n]+|\bו-?/));
  const found = new Set<Taste>();
  for (const part of parts) {
    const text = lang === 'he' ? ` ${foldHebrew(part)} ` : ` ${part.toLowerCase()} `;
    for (const [pattern, key] of lang === 'he' ? TASTE_HE : TASTE_EN)
      if (pattern.test(text)) found.add(key);
  }
  return TASTES.filter((taste) => found.has(taste));
}

const CHANNEL_TOKENS: Record<string, Channel> = {
  lu: 'lung',
  lung: 'lung',
  lungs: 'lung',
  li: 'large_intestine',
  'large intestine': 'large_intestine',
  st: 'stomach',
  stomach: 'stomach',
  sp: 'spleen',
  spleen: 'spleen',
  ht: 'heart',
  he: 'heart',
  h: 'heart',
  heart: 'heart',
  si: 'small_intestine',
  'small intestine': 'small_intestine',
  bl: 'bladder',
  ub: 'bladder',
  bladder: 'bladder',
  'urinary bladder': 'bladder',
  ki: 'kidney',
  kid: 'kidney',
  kd: 'kidney',
  kidney: 'kidney',
  kidneys: 'kidney',
  pc: 'pericardium',
  p: 'pericardium',
  per: 'pericardium',
  pericardium: 'pericardium',
  sj: 'san_jiao',
  tb: 'san_jiao',
  te: 'san_jiao',
  tw: 'san_jiao',
  'san jiao': 'san_jiao',
  'triple burner': 'san_jiao',
  'triple warmer': 'san_jiao',
  'triple heater': 'san_jiao',
  gb: 'gallbladder',
  gallbladder: 'gallbladder',
  'gall bladder': 'gallbladder',
  liv: 'liver',
  lr: 'liver',
  lv: 'liver',
  liver: 'liver',
  ריאות: 'lung',
  ריאה: 'lung',
  'מעי גס': 'large_intestine',
  קיבה: 'stomach',
  טחול: 'spleen',
  לב: 'heart',
  'מעי דק': 'small_intestine',
  שלפוחית: 'bladder',
  'שלפוחית השתן': 'bladder',
  כליות: 'kidney',
  כליה: 'kidney',
  'קרום הלב': 'pericardium',
  'סאן גיאו': 'san_jiao',
  'סן גיאו': 'san_jiao',
  'המחמם המשולש': 'san_jiao',
  'כיס מרה': 'gallbladder',
  'כיס המרה': 'gallbladder',
  כבד: 'liver',
};

/** Channels from "SP/LU", "Lung, Stomach", "טחול, כבד" — unknown tokens are ignored. */
export function mapChannels(raw: string | string[] | null | undefined): Channel[] {
  if (!raw) return [];
  const found = new Set<Channel>();
  const parts = (Array.isArray(raw) ? raw : [raw]).flatMap((part) =>
    part.split(/[\/,;&+\n]| and | ו-|\bו(?=[א-ת])/),
  );
  for (const part of parts) {
    const token = part
      .replace(/[().'"״׳]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
    if (!token) continue;
    const hit = CHANNEL_TOKENS[token] ?? CHANNEL_TOKENS[token.replace(/^the /, '')];
    if (hit) found.add(hit);
  }
  return CHANNELS.filter((channel) => found.has(channel));
}

export interface DoseRange {
  min: number | null;
  max: number | null;
  unit: 'g' | 'ml';
}

/**
 * "9-3 גר'" (Bara writes the range backwards, right to left), "3-10g",
 * "0.5–1.5 g", "up to 15g", "Tincture: 2-4ml" → a range in grams or ml.
 */
export function parseDoseRange(raw: string | null | undefined): DoseRange | null {
  if (!raw) return null;
  const text = raw.replace(/[–—−]/g, '-').replace(/\s+/g, ' ');
  const unit: 'g' | 'ml' = /ml\b|מ"ל|מ״ל|מל\b|מיליליטר/i.test(text) ? 'ml' : 'g';
  const numbers = [...text.matchAll(/\d+(?:[.,]\d+)?/g)]
    .map((m) => Number(m[0].replace(',', '.')))
    .filter((n) => Number.isFinite(n));
  if (numbers.length === 0) return null;
  const range = text.match(/(\d+(?:[.,]\d+)?)\s*-\s*(\d+(?:[.,]\d+)?)/);
  if (range) {
    const a = Number(range[1].replace(',', '.'));
    const b = Number(range[2].replace(',', '.'));
    return { min: Math.min(a, b), max: Math.max(a, b), unit };
  }
  if (/up to|עד/i.test(text)) return { min: null, max: numbers[0], unit };
  return { min: numbers[0], max: numbers[0], unit };
}

/** "HUANG QI" / "huang qi" / "Huáng Qí" → "huangqi": the key two sources meet on. */
export function normalizePinyin(name: string | null | undefined): string {
  return String(name ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ü/g, 'v')
    .toLowerCase()
    .replace(/[^a-z]/g, '');
}

/** "HUANG QI" → "Huang Qi"; "zhi gan cao" → "Zhi Gan Cao". */
export function titleCasePinyin(name: string | null | undefined): string {
  return String(name ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1).toLowerCase() : word))
    .join(' ');
}

export function hasCjk(text: string | null | undefined): boolean {
  return /[㐀-䶿一-鿿]/.test(String(text ?? ''));
}

export function hasHebrew(text: string | null | undefined): boolean {
  return /[֐-׿]/.test(String(text ?? ''));
}

/** Our point-code prefixes, and what American Dragon calls the same channels. */
const POINT_PREFIXES: Record<string, string> = {
  LU: 'LU',
  LI: 'LI',
  ST: 'ST',
  SP: 'SP',
  HT: 'HT',
  HE: 'HT',
  SI: 'SI',
  BL: 'BL',
  UB: 'BL',
  KI: 'KI',
  KID: 'KI',
  KD: 'KI',
  PC: 'PC',
  P: 'PC',
  SJ: 'SJ',
  TB: 'SJ',
  TE: 'SJ',
  TW: 'SJ',
  GB: 'GB',
  LR: 'LR',
  LIV: 'LR',
  LV: 'LR',
  REN: 'REN',
  CV: 'REN',
  DU: 'DU',
  GV: 'DU',
};

const CHANNEL_OF_PREFIX: Record<string, string> = {
  LU: 'lung',
  LI: 'large_intestine',
  ST: 'stomach',
  SP: 'spleen',
  HT: 'heart',
  SI: 'small_intestine',
  BL: 'bladder',
  KI: 'kidney',
  PC: 'pericardium',
  SJ: 'san_jiao',
  GB: 'gallbladder',
  LR: 'liver',
  REN: 'ren',
  DU: 'du',
};

/** "ST-36" / "UB 40" / "Liv3" → "ST36" / "BL40" / "LR3"; an extra point ("N-HN-54") → null. */
export function pointCode(raw: string | null | undefined): string | null {
  const match = String(raw ?? '')
    .trim()
    .toUpperCase()
    .match(/^([A-Z]+)\s*-?\s*(\d+)$/);
  if (!match) return null;
  const prefix = POINT_PREFIXES[match[1]];
  if (!prefix) return null;
  return `${prefix}${Number(match[2])}`;
}

export function channelOfCode(code: string): string | null {
  const match = code.match(/^([A-Z]+)(\d+)$/);
  return match ? (CHANNEL_OF_PREFIX[match[1]] ?? null) : null;
}

export function pointNumberOfCode(code: string): number | null {
  const match = code.match(/^[A-Z]+(\d+)$/);
  return match ? Number(match[1]) : null;
}
