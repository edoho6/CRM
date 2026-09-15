import { describe, expect, it } from 'vitest';
import {
  CHANNELS as DOMAIN_CHANNELS,
  FORMULA_TCM_CATEGORIES,
  TASTES as DOMAIN_TASTES,
  TCM_CATEGORIES,
  TEMPERATURES as DOMAIN_TEMPERATURES,
} from '@clinic/domain';
import {
  CHANNELS,
  FORMULA_CATEGORIES,
  HERB_CATEGORIES,
  TASTES,
  TEMPERATURES,
  channelOfCode,
  inferFormulaCategory,
  mapChannels,
  mapFormulaCategory,
  mapHerbCategory,
  mapTastes,
  mapTemperature,
  normalizePinyin,
  parseDoseRange,
  pointCode,
  titleCasePinyin,
} from '@catalogue/map.ts';

describe('the catalogue keys mirror the domain enums', () => {
  it('herb categories are the domain list, Western herbs included', () => {
    expect([...HERB_CATEGORIES]).toEqual([...TCM_CATEGORIES]);
    expect(HERB_CATEGORIES).toContain('western');
  });
  it('formula categories, temperatures, tastes and channels are the domain lists', () => {
    expect([...FORMULA_CATEGORIES]).toEqual([...FORMULA_TCM_CATEGORIES]);
    expect([...TEMPERATURES]).toEqual([...DOMAIN_TEMPERATURES]);
    expect([...TASTES]).toEqual([...DOMAIN_TASTES]);
    expect([...CHANNELS]).toEqual([...DOMAIN_CHANNELS]);
  });
});

describe("Bara's Hebrew groups", () => {
  it.each([
    ['מפסיקי דימום', 'stop_bleeding'],
    ['מחממי פנים', 'warm_interior'],
    ['מסלקי ליחה חמה', 'transform_phlegm_heat'],
    ['מסלקי ליחה קרה', 'transform_phlegm_cold'],
    ['מסלקי אש ורעילות', 'clear_heat_relieve_toxicity'],
    ['מסלקי אש', 'clear_heat_drain_fire'],
    ['מקררי דם', 'clear_heat_cool_blood'],
    ['מטהרי חום מחוסר', 'clear_deficient_heat'],
    ['מטהרי חום ומסלקי לחות', 'clear_heat_dry_dampness'],
    ['מנקזי לחות (משתנים)', 'drain_dampness'],
    ['מסלקי רוח-לחות', 'dispel_wind_dampness'],
    ['ארומטיים מתמירי ליחה', 'aromatic_transform_dampness'],
    ['משחררי חיצון חמימים חריפים', 'release_exterior_warm'],
    ['משחררי חיצון חריפים קרירים', 'release_exterior_cool'],
    ["מניעי צ'י", 'regulate_qi'],
    ['מניעי דם', 'invigorate_blood'],
    ["מחזקי צ'י", 'tonify_qi'],
    ['מחזקי Yang', 'tonify_yang'],
    ['מחזקי יין', 'tonify_yin'],
    ['סופחים', 'stabilize_bind'],
    ['מכווצים', 'stabilize_bind'],
    ['מרגיעי נפש (מכבידים)', 'calm_spirit_anchor'],
    ['מרגיעי נפש', 'calm_spirit_nourish'],
    ['ארומטיים פותחי פתחים', 'aromatic_open_orifices'],
    ['מפסיקי רוח ורעידות', 'extinguish_wind'],
    ['מסלקי פרזיטים', 'expel_parasites'],
    ['מרוקנים מטה', 'downward_draining'],
    ['מרוקנים מטה מלחלחים', 'moist_laxative'],
    ['משלשלים בעצמה (HARSH EXPELLANTS)', 'harsh_expellant'],
    ['מסלקי תקיעות מזון', 'relieve_food_stagnation'],
    ['מפסיקי שיעול וצפצופים', 'relieve_cough_wheezing'],
  ])('%s → %s', (raw, key) => {
    expect(mapHerbCategory(raw, 'he')).toBe(key);
  });
  it('says null for a group it does not know, never a guess', () => {
    expect(mapHerbCategory('קבוצה חדשה לגמרי', 'he')).toBeNull();
  });
});

describe("American Dragon's English categories", () => {
  it.each([
    [
      'Herbs that Transform Phlegm and Stop Coughing: Warm Herbs that Transform Cold Phlegm',
      'transform_phlegm_cold',
    ],
    [
      'Herbs that Transform Phlegm and Stop Coughing: Cool Herbs that Transform Phlegm-Heat',
      'transform_phlegm_heat',
    ],
    [
      'Herbs that Transform Phlegm and Stop Coughing: Herbs that Relieve Coughing and Wheezing',
      'relieve_cough_wheezing',
    ],
    ['Herbs that Tonify Qi', 'tonify_qi'],
    ['Herbs that Tonify the Blood', 'tonify_blood'],
    [
      'Herbs that Release the Exterior: Warm, Acrid Herbs that Release the Exterior',
      'release_exterior_warm',
    ],
    [
      'Herbs that Release the Exterior: Cool, Acrid Herbs that Release the Exterior',
      'release_exterior_cool',
    ],
    // The parenthetical names the pattern the herb is aimed at, not its own nature.
    [
      'Herbs that Release the Exterior: Warm, Acrid Herbs that Release the Exterior (Wind-Cold Diaphoretics)',
      'release_exterior_warm',
    ],
    [
      'Herbs that Release the Exterior: Cool, Acrid Herbs that Release the Exterior (Wind-Heat Diaphoretics)',
      'release_exterior_cool',
    ],
    [
      'Herbs that Clear Heat: Herbs that Clear Heat and Relieve Toxicity',
      'clear_heat_relieve_toxicity',
    ],
    ['Herbs that Clear Heat: Herbs that Clear Heat and Cool the Blood', 'clear_heat_cool_blood'],
    ['Herbs that Clear Heat: Herbs that Clear Heat and Drain Fire', 'clear_heat_drain_fire'],
    ['Herbs that Regulate Qi', 'regulate_qi'],
    ['Herbs that Stop Bleeding', 'stop_bleeding'],
    ['Herbs that Invigorate the Blood', 'invigorate_blood'],
    ['Herbs that Warm the Interior and Expel Cold', 'warm_interior'],
    [
      'Herbs that Calm the Spirit: Herbs that Anchor, Settle and Calm the Spirit',
      'calm_spirit_anchor',
    ],
    [
      'Herbs that Calm the Spirit: Herbs that Nourish the Heart and Calm the Spirit',
      'calm_spirit_nourish',
    ],
    ['Herbs that Extinguish Wind and Stop Tremors', 'extinguish_wind'],
    ['Aromatic Herbs that Transform Dampness', 'aromatic_transform_dampness'],
    ['Herbs that Drain Dampness', 'drain_dampness'],
    ['Herbs that Dispel Wind-Dampness', 'dispel_wind_dampness'],
  ])('%s → %s', (raw, key) => {
    expect(mapHerbCategory(raw, 'en')).toBe(key);
  });
});

describe('temperature, tastes, channels', () => {
  it('reads the Hebrew scale Bara uses', () => {
    expect(mapTemperature('חם', 'he')).toBe('hot');
    expect(mapTemperature('חמים', 'he')).toBe('warm');
    expect(mapTemperature('מעט חמים', 'he')).toBe('slightly_warm');
    expect(mapTemperature('ניטרלי', 'he')).toBe('neutral');
    expect(mapTemperature('נייטראלי', 'he')).toBe('neutral');
    expect(mapTemperature('קריר', 'he')).toBe('cool');
    expect(mapTemperature('קר', 'he')).toBe('cold');
    expect(mapTemperature('קר מאוד', 'he')).toBe('very_cold');
    expect(mapTemperature('חם, רעיל', 'he')).toBe('hot');
  });
  it('reads the English scale', () => {
    expect(mapTemperature('Slightly Warm (Lukewarm)', 'en')).toBe('slightly_warm');
    expect(mapTemperature('Neutral', 'en')).toBe('neutral');
    expect(mapTemperature('Very Cold', 'en')).toBe('very_cold');
    expect(mapTemperature('Cool', 'en')).toBe('cool');
  });
  it('collects every taste named, in the order of the enum', () => {
    expect(mapTastes('מתוק, מר, חריף', 'he')).toEqual(['sweet', 'bitter', 'acrid']);
    expect(mapTastes('מתוק, חסר טעם', 'he')).toEqual(['sweet', 'bland']);
    expect(mapTastes('מעט מר, מכווץ, מתוק, מקרר ומייבש.', 'he')).toEqual([
      'sweet',
      'bitter',
      'astringent',
    ]);
    expect(mapTastes(['Bitter', 'Acrid'], 'en')).toEqual(['bitter', 'acrid']);
    expect(mapTastes('Sweet, Slightly Pungent', 'en')).toEqual(['sweet', 'acrid']);
  });
  it('reads channels as abbreviations, English names and Hebrew names', () => {
    expect(mapChannels('SP/LIV/KID')).toEqual(['spleen', 'kidney', 'liver']);
    expect(mapChannels(['Heart', 'Liver', 'Spleen'])).toEqual(['spleen', 'heart', 'liver']);
    expect(mapChannels('UB, San Jiao')).toEqual(['bladder', 'san_jiao']);
    expect(mapChannels('ריאות, קיבה')).toEqual(['lung', 'stomach']);
    expect(mapChannels('הצמח אינו מאושר בארץ')).toEqual([]);
  });
});

describe('doses', () => {
  it("reads Bara's backwards range as a range", () => {
    expect(parseDoseRange("9-3 גר'")).toEqual({ min: 3, max: 9, unit: 'g' });
    expect(parseDoseRange("9-4.5 גר'")).toEqual({ min: 4.5, max: 9, unit: 'g' });
  });
  it('reads English ranges, single doses, caps and tinctures', () => {
    expect(parseDoseRange('3-10g')).toEqual({ min: 3, max: 10, unit: 'g' });
    expect(parseDoseRange('0.5–1.5 g')).toEqual({ min: 0.5, max: 1.5, unit: 'g' });
    expect(parseDoseRange('1.5g')).toEqual({ min: 1.5, max: 1.5, unit: 'g' });
    expect(parseDoseRange('up to 15g')).toEqual({ min: null, max: 15, unit: 'g' });
    expect(parseDoseRange('Tincture: 2-4ml')).toEqual({ min: 2, max: 4, unit: 'ml' });
    expect(parseDoseRange('טינקטורה (1:3): 4-9 מ"ל ליום')).toEqual({ min: 4, max: 9, unit: 'ml' });
    expect(parseDoseRange('none')).toBeNull();
  });
});

describe('names and codes', () => {
  it('normalizes pinyin so the two sources meet', () => {
    expect(normalizePinyin('HUANG QI')).toBe('huangqi');
    expect(normalizePinyin('Huáng Qí')).toBe('huangqi');
    expect(normalizePinyin('Zhi Gan Cao')).toBe('zhigancao');
  });
  it('title-cases pinyin', () => {
    expect(titleCasePinyin('BA ZHEN TANG')).toBe('Ba Zhen Tang');
    expect(titleCasePinyin('zhi gan cao')).toBe('Zhi Gan Cao');
  });
  it("turns American Dragon's point codes into ours", () => {
    expect(pointCode('ST-36')).toBe('ST36');
    expect(pointCode('UB-40')).toBe('BL40');
    expect(pointCode('LIV-3')).toBe('LR3');
    expect(pointCode('REN-12')).toBe('REN12');
    expect(pointCode('DU-20')).toBe('DU20');
    expect(pointCode('N-HN-54')).toBeNull();
    expect(channelOfCode('BL40')).toBe('bladder');
    expect(channelOfCode('REN12')).toBe('ren');
  });
});

describe('formula categories', () => {
  it("reads Bara's groups", () => {
    expect(mapFormulaCategory("מחזקות צ'י ודם.")).toBe('tonify');
    expect(mapFormulaCategory('משחררות חיצון – רוח-קור')).toBe('release_exterior');
    expect(mapFormulaCategory('מסלקות לחות')).toBe('expel_dampness');
    expect(mapFormulaCategory('מטהרות חום')).toBe('clear_heat');
    expect(mapFormulaCategory('מייצבות')).toBe('stabilize_bind');
    expect(mapFormulaCategory('פיזור רוח פנימית')).toBe('extinguish_wind');
    expect(mapFormulaCategory('מרוקנות מעיים')).toBe('purge');
    expect(mapFormulaCategory('מאזנות קיבה ומעיים')).toBe('harmonize');
    expect(mapFormulaCategory('הפסקת דימום')).toBe('stop_bleeding');
  });
  it('infers a category from stated actions, first action weighing most', () => {
    expect(
      inferFormulaCategory([
        'Harmonizes the Liver and Spleen',
        'Spreads Liver Qi',
        'Strengthens the Spleen',
      ]),
    ).toBe('harmonize');
    expect(
      inferFormulaCategory([
        'Spreads Liver Qi',
        'Strengthens the Spleen',
        'Harmonizes the Liver and Spleen',
      ]),
    ).toBe('regulate_qi');
    expect(
      inferFormulaCategory(['Releases the Exterior', 'Disperses Cold', 'Calms wheezing']),
    ).toBe('release_exterior');
    expect(inferFormulaCategory(['Tonifies Qi', 'Nourishes Blood'])).toBe('tonify');
    expect(inferFormulaCategory([])).toBeNull();
  });
});
