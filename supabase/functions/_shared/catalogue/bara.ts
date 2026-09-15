// Bara's professional indexes (barapro.co.il), read as facts from the
// records scripts/pull/bara.mjs saved. A herb monograph there is a run of
// "label: value" blocks in Hebrew; a formula is an ingredient table and
// three prose sections with labels inside them. Only the facts are taken —
// a group, a taste, a dose, an action and what it is used for, a caution —
// and the writer later says them in our own words.
import { hasCjk, hasHebrew, isToxic, parseDoseRange, titleCasePinyin } from './map.ts';
import type {
  ActionFact,
  DoseFact,
  Fact,
  FormulaSource,
  HerbSource,
  IngredientFact,
} from './types.ts';

const SOURCE = 'bara' as const;

/** What scripts/pull/bara.mjs writes for one herb. */
export interface BaraHerbRecord {
  url: string;
  listName: string;
  title?: string;
  hebrew?: string;
  latin?: string;
  names?: string[];
  modes?: string[];
  text?: string;
  fields?: Record<string, string>;
  image?: string | null;
}

/** What it writes for one formula. */
export interface BaraFormulaRecord {
  url: string;
  name: string;
  listName?: string;
  sections?: Record<string, { text: string; html?: string }>;
  ingredients?: Array<{ name: string; href?: string; form?: string; dose?: string }>;
  shelfProduct?: string | null;
}

function fact(text: string): Fact {
  return { text, lang: 'he', source: SOURCE };
}

/** The labels that open a block in a Bara monograph; anything else with a colon is content. */
const HERB_LABELS: Array<[RegExp, string]> = [
  [/^קליגרפיה( סינית)?$/, 'chinese'],
  [/^שם בוטני$/, 'botanical'],
  [/^שם עברי$/, 'hebrew'],
  [/^שמות? (נוספים|נוסף)$/, 'hebrew'],
  [/^שם עממי$/, 'english'],
  [/^שמות משלימים$/, 'english'],
  [/^משמעות השם$/, 'nameMeaning'],
  [/^חלק בשימוש$/, 'part'],
  [/^מקור בספרות הקל(א)?סית$/, 'classical'],
  [/^(קבוצה|קטגוריה) טיפולית$/, 'category'],
  [/^טעמים?$/, 'tastes'],
  [/^טמפרטורה$/, 'temperature'],
  [/^איברים$/, 'channels'],
  [/^תפקודים( עיקריים)?$/, 'actions'],
  [/^אנקדוטות$/, 'notes'],
  [/^סממנים לזיהוי צמח איכותי$/, 'quality'],
  [/^מינון(ים)?( יומי)?( מומלץ| מומלצים)?( ואופן השימוש)?$/, 'dose'],
  [/^המלצות השימוש$/, 'dose'],
  [/^התוויות נגד( ואזהרות)?$/, 'contraindications'],
  [/^אזהרות$/, 'contraindications'],
  [/^אינטראקציות( עם תרופות)?$/, 'interactions'],
  [/^ה(י)?ריון$/, 'pregnancy'],
  [/^הנקה$/, 'lactation'],
  [/^G6PD$/i, 'contraindications'],
  [/^תחליפים( אפשריים)?$/, 'substitutes'],
  [/^משתתף בפורמולות$/, 'formulas'],
  [/^משפחה$/, 'family'],
  [/^רכיבים עיקריים$/, 'constituents'],
  [/^רקע כללי( ושימוש מסורתי)?$/, 'background'],
  [/^תכונות רפואיות עיקריות$/, 'westernActions'],
  [/^התוויות ושימושים( רפואיים)? עיקריים$/, 'westernIndications'],
  [/^בשימוש חיצוני$/, 'externalUse'],
  [/^אנרגטיקה$/, 'energetics'],
  [/^איכויות$/, 'energetics'],
  [/^צמח יבש$/, 'doseDry'],
  [/^טינקטורה.*$/, 'doseTincture'],
  [/^הערה$/, 'notes'],
  [/^הערת איכות$/, 'quality'],
];

function labelOf(line: string): { key: string; rest: string } | null {
  const match = line.match(/^([^:•]{2,50}?):\s*(.*)$/);
  if (!match) return null;
  const label = match[1].trim();
  for (const [pattern, key] of HERB_LABELS)
    if (pattern.test(label)) return { key, rest: match[2].trim() };
  return null;
}

/** Blocks that hold one value: a stray line after it is a remark, not a second value. */
const SCALAR_KEYS = new Set([
  'chinese',
  'botanical',
  'hebrew',
  'english',
  'part',
  'classical',
  'category',
  'tastes',
  'temperature',
  'channels',
  'family',
  'energetics',
]);

/**
 * Site furniture that is not a fact about the herb, and the source's own
 * regulatory remark. The practitioner's decision of 15.9 is that the
 * catalogue does not carry "not approved for use in Israel": the source's
 * regulatory position is not ours to republish, and it goes stale. The
 * `restrictedInIsrael` flag below still records that the source said it, for
 * whoever reads the fact sheets; nothing downstream reads it.
 */
const NOISE =
  /לחץ כאן|לקריאת המונוגרף|לקריאה של המונוגרף|קיימת כמוצר מדף|חברת ברא צמחים|בתמונה מימין|אינו מאושר בארץ|לא מאושר בארץ/;

/** The monograph text as blocks keyed by what they are; a key that appears twice keeps both. */
export function blocksOf(text: string): Record<string, string[]> {
  const blocks: Record<string, string[]> = {};
  let current: string | null = null;
  for (const rawLine of text.split('\n')) {
    const line = rawLine.replace(/\s+/g, ' ').trim();
    if (!line || NOISE.test(line)) continue;
    const label = labelOf(line);
    if (label) {
      current = label.key;
      blocks[current] = blocks[current] ?? [];
      if (label.rest) blocks[current].push(label.rest);
      continue;
    }
    if (!current) continue;
    if (SCALAR_KEYS.has(current) && blocks[current].length > 0) {
      // "הצמח אינו מאושר בארץ…" under the channels line: a remark that belongs with the notes.
      blocks.remarks = [...(blocks.remarks ?? []), line];
      continue;
    }
    blocks[current].push(line);
  }
  return blocks;
}

const PHARMACEUTICAL_WORD =
  /\b(radix|rhizoma|herba|folium|flos|fructus|semen|cortex|ramulus|caulis|pericarpium|bulbus|tuber|sclerotium|spica|lignum|resina|concha|plumula|stigma|exocarpium|medulla|thallus|nidus|colla|faex|massa|placenta|gelatinum|squama|testa|endothelium|arillus|pollen|calyx|petiolus|cacumen|nodus|fibra|corium|carapax|plastrum|ootheca|periostracum|cornu|ramus|stamen|receptaculum|spina|succus|oleum|pulvis|corpus|os|carbonisata|praeparata)\b/i;

const BINOMIAL = /^[A-Z][a-z]+ [a-z]+/;

function clean(line: string): string {
  return line
    .replace(/^[•·\-–*]\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitList(value: string): string[] {
  return value
    .split(/[,;،]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function parseBaraHerb(record: BaraHerbRecord): HerbSource | null {
  const text = record.text ?? '';
  if (!text.trim()) return null;
  const blocks = blocksOf(text);
  const chineseKind =
    (record.modes ?? []).includes('pinYanName') || Boolean(blocks.chinese || blocks.category);
  const restricted =
    /אסור לשימוש/.test(record.listName) || /אינו מאושר בארץ|לא מאושר בארץ|אסור לשימוש/.test(text);

  // "Bai Ji Li, Tribulus terrestris (bai ji li), קוטב מצוי" — the list name carries the three names at once.
  const segments = record.listName
    .replace(/\(אסור לשימוש\)/g, '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  const pinyin =
    chineseKind && segments[0] && !BINOMIAL.test(segments[0]) && !hasHebrew(segments[0])
      ? titleCasePinyin(segments[0].replace(/\s*\(.*?\)\s*/g, ' ').trim())
      : null;
  const hebrewNames = [
    ...segments.filter((part) => hasHebrew(part)),
    ...(blocks.hebrew ?? []).flatMap(splitList),
    record.hebrew ?? '',
  ]
    .map((name) => name.trim())
    .filter((name) => name && hasHebrew(name) && !/אסור לשימוש/.test(name));
  const englishNames = [
    ...(blocks.english ?? []).flatMap(splitList),
    ...segments.filter(
      (part) =>
        /^[A-Z][a-z]+( [a-z]+)? (leaf|root|bark|seed|flower|fruit|herb)$/i.test(part) &&
        !BINOMIAL.test(part),
    ),
  ].filter(Boolean);

  let botanical: string | null = null;
  let pharmaceutical: string | null = null;
  for (const candidate of [
    ...(blocks.botanical ?? []),
    ...segments.filter((part) => BINOMIAL.test(part)),
  ]) {
    const value = candidate.replace(/\s*\(.*?\)\s*/g, ' ').trim();
    if (!value) continue;
    if (PHARMACEUTICAL_WORD.test(value)) pharmaceutical = pharmaceutical ?? value;
    else if (BINOMIAL.test(value)) botanical = botanical ?? value;
  }
  if (
    !botanical &&
    record.latin &&
    BINOMIAL.test(record.latin) &&
    !PHARMACEUTICAL_WORD.test(record.latin)
  )
    botanical = record.latin;

  const doses: DoseFact[] = [];
  for (const [key, unitHint] of [
    ['dose', null],
    ['doseDry', 'dry'],
    ['doseTincture', 'tincture'],
  ] as const) {
    for (const line of blocks[key] ?? []) {
      const range = parseDoseRange(line);
      if (range)
        doses.push({ ...range, raw: unitHint ? `${unitHint}: ${line}` : line, source: SOURCE });
    }
  }

  const actions: ActionFact[] = [];
  for (const line of (blocks.actions ?? []).map(clean)) {
    if (!line) continue;
    const split = line.match(/^([^:]{3,120}):\s*(.+)$/);
    if (split)
      actions.push({
        text: split[1].trim(),
        lang: 'he',
        source: SOURCE,
        indications: splitList(split[2]),
      });
    else actions.push({ text: line, lang: 'he', source: SOURCE, indications: [] });
  }
  for (const line of (blocks.westernActions ?? []).map(clean))
    if (line) actions.push({ text: line, lang: 'he', source: SOURCE, indications: [] });

  const indications: Fact[] = [
    ...(blocks.westernIndications ?? []),
    ...(blocks.externalUse ?? []).map((line) => `בשימוש חיצוני: ${line}`),
  ]
    .map(clean)
    .filter(Boolean)
    .map(fact);

  const contraindications = (blocks.contraindications ?? []).map(clean).filter(Boolean);
  const interactions = (blocks.interactions ?? []).map(clean).filter(Boolean);
  const energetics = (blocks.energetics ?? []).join(', ');
  const temperatureRaw = blocks.temperature?.[0] ?? (energetics || null);
  const tastesRaw = [...(blocks.tastes ?? []), ...(energetics ? [energetics] : [])];

  return {
    source: SOURCE,
    url: record.url,
    title: record.listName,
    pinyin,
    chinese: blocks.chinese?.find((value) => hasCjk(value))?.match(/[㐀-鿿]+/)?.[0] ?? null,
    botanical,
    pharmaceutical,
    english: englishNames,
    hebrew: [...new Set(hebrewNames)],
    kind: chineseKind ? 'chinese' : 'western',
    categoryRaw: blocks.category?.[0] ?? null,
    temperatureRaw,
    tastesRaw,
    channelsRaw: blocks.channels ?? [],
    doses,
    partUsed: blocks.part?.[0] ?? null,
    family: blocks.family?.[0] ?? null,
    classicalSource: blocks.classical?.[0] ?? null,
    actions,
    indications,
    contraindications: contraindications.map(fact),
    interactions: interactions.map(fact),
    incompatibilities: [],
    pregnancy: blocks.pregnancy?.length ? fact(blocks.pregnancy.map(clean).join(' ')) : null,
    lactation: blocks.lactation?.length ? fact(blocks.lactation.map(clean).join(' ')) : null,
    combinations: [],
    // A Western monograph follows each substitute with an essay about it; the name line is the fact.
    substitutes: (blocks.substitutes ?? [])
      .map(clean)
      .filter((line) => line && (line.includes('|') || line.length <= 90)),
    notes: [...(blocks.notes ?? []), ...(blocks.background ?? []), ...(blocks.remarks ?? [])]
      .map(clean)
      .filter(Boolean)
      .map(fact),
    restrictedInIsrael: restricted,
    toxic: isToxic(temperatureRaw),
  };
}

/** The labels inside a formula's prose sections. */
const FORMULA_LABELS: Array<[RegExp, string]> = [
  [/^(פירוש|פרוש|משמעות) השם$/, 'nameMeaning'],
  [/^קבוצה טיפולית$/, 'category'],
  [/^דיון בפורמולה$/, 'discussion'],
  [/^תמונה קלינית$/, 'indications'],
  [/^לשון$/, 'tongue'],
  [/^דופק$/, 'pulse'],
  [/^שם נוסף$/, 'alias'],
  [/^קליגרפיה( סינית)?$/, 'chinese'],
  [/^פעילות$/, 'actions'],
  [/^הערת מינון$/, 'notes'],
  [/^התוויות נגד( ואזהרות)?$/, 'contraindications'],
  [/^אזהרות$/, 'contraindications'],
  [/^אבחנה סינית$/, 'syndromes'],
  [/^הנחיות שימוש$/, 'notes'],
  [/^מקור$/, 'classical'],
];

function formulaBlocks(text: string): Record<string, string[]> {
  const blocks: Record<string, string[]> = {};
  let current: string | null = null;
  for (const rawLine of text.split('\n')) {
    const line = rawLine.replace(/\s+/g, ' ').trim();
    if (!line || /^קיימת כמוצר מדף/.test(line) || /לחץ כאן/.test(line)) continue;
    const match = line.match(/^([^:•]{2,40}?):\s*(.*)$/);
    const key = match
      ? FORMULA_LABELS.find(([pattern]) => pattern.test(match[1].trim()))?.[1]
      : undefined;
    if (match && key) {
      current = key;
      blocks[current] = blocks[current] ?? [];
      if (match[2].trim()) blocks[current].push(match[2].trim());
      continue;
    }
    if (current) blocks[current].push(line);
  }
  return blocks;
}

export function parseBaraFormula(record: BaraFormulaRecord): FormulaSource | null {
  const [namePart, chinesePart] = record.name.split('|').map((part) => part.trim());
  if (!namePart) return null;
  const pinyin = titleCasePinyin(namePart.toLowerCase());
  const merged: Record<string, string[]> = {};
  for (const section of Object.values(record.sections ?? {})) {
    for (const [key, lines] of Object.entries(formulaBlocks(section.text ?? '')))
      merged[key] = [...(merged[key] ?? []), ...lines];
  }

  const ingredients: IngredientFact[] = (record.ingredients ?? [])
    .filter((item) => item.name && item.name.trim())
    .map((item) => {
      const dose = item.dose ? Number(String(item.dose).replace(',', '.')) : NaN;
      return {
        pinyin: titleCasePinyin(item.name.trim().toLowerCase()),
        latin: null,
        doseMin: Number.isFinite(dose) ? dose : null,
        doseMax: Number.isFinite(dose) ? dose : null,
        note: item.form ? item.form : null,
        actions: null,
        source: SOURCE,
      };
    });

  // "באבחנה מתאימה אפשר להשתמש במחלות כגון: …" inside the clinical picture is the list of conditions treated.
  const indications: Fact[] = [];
  const treats: string[] = [];
  for (const line of merged.indications ?? []) {
    const split = line.split(/באבחנה מתאימה[^:]*:\s*/);
    if (split[0].trim()) indications.push(fact(split[0].trim()));
    if (split[1]) treats.push(...splitList(split[1].replace(/\.$/, '')));
  }

  return {
    source: SOURCE,
    url: record.url,
    title: record.name,
    pinyin,
    chinese:
      chinesePart && hasCjk(chinesePart)
        ? chinesePart
        : (merged.chinese?.find((v) => hasCjk(v))?.match(/[㐀-鿿]+/)?.[0] ?? null),
    english: (merged.alias ?? []).map((alias) => titleCasePinyin(alias.toLowerCase())),
    categoryRaw: merged.category?.[0] ?? null,
    classicalSource: merged.classical?.[0] ?? null,
    ingredients,
    actions: (merged.actions ?? []).map(clean).filter(Boolean).map(fact),
    syndromes: (merged.syndromes ?? []).map(clean).filter(Boolean).map(fact),
    indications,
    tongue: merged.tongue?.length ? fact(merged.tongue.join(' ')) : null,
    pulse: merged.pulse?.length ? fact(merged.pulse.join(' ')) : null,
    treats,
    contraindications: (merged.contraindications ?? []).map(clean).filter(Boolean).map(fact),
    interactions: [],
    notes: [...(merged.notes ?? []), ...(merged.discussion ?? [])]
      .map(clean)
      .filter(Boolean)
      .map(fact),
    nameMeaning: merged.nameMeaning?.length ? fact(merged.nameMeaning.join(' ')) : null,
  };
}
