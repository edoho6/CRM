// American Dragon (Dr Joel Penner), read as facts. Every page is the same
// accordion: a name box, then titled sections holding a table or a list.
// What is read is what the table says — a taste, a dose, an action paired
// with the pattern it is used for, a caution — never the surrounding prose
// as prose; the writer later says these things in its own words.
import {
  accordionSections,
  linesOf,
  listItems,
  pageTitle,
  paragraphs,
  tables,
  textOf,
  type Section,
} from './html.ts';
import { hasCjk, parseDoseRange, pointCode, titleCasePinyin } from './map.ts';
import type {
  ActionFact,
  DoseFact,
  Fact,
  FormulaSource,
  HerbSource,
  IngredientFact,
  PointSource,
} from './types.ts';

const SOURCE = 'americandragon' as const;

function fact(text: string): Fact {
  return { text, lang: 'en', source: SOURCE };
}

function sectionNamed(sections: Section[], pattern: RegExp): Section | null {
  return sections.find((section) => pattern.test(section.title)) ?? null;
}

/** "NAME: JIE GENG - 桔梗 - RADIX PLATYCODI" → ["JIE GENG", "桔梗", "RADIX PLATYCODI"]. */
function nameParts(title: string): string[] {
  return title
    .replace(/^NAME:\s*/i, '')
    .split(/\s+-\s+|\s+–\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

/** The "label: value" rows of the small table under a name (English, Also Known As, Pharmaceutical Latin). */
function labelledRows(html: string): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const table of tables(html)) {
    for (const row of table) {
      if (row.length < 2) continue;
      const label = textOf(row[0]).replace(/:$/, '').trim().toLowerCase();
      const values = linesOf(row[1]);
      if (label && values.length) out[label] = values;
    }
  }
  return out;
}

/** The rows of a table whose first row is a header; header cells give the column names. */
function tableWithHeader(html: string): { headers: string[]; rows: string[][] } | null {
  const [first] = tables(html);
  if (!first || first.length === 0) return null;
  const headers = first[0].map((cell) => textOf(cell).toLowerCase());
  return { headers, rows: first.slice(1) };
}

/**
 * The contraindications box: single-cell rows alternate between an
 * upper-case label (CONTRAINDICATIONS, INCOMPATIBILITIES, HERB/DRUG
 * INTERACTIONS) and a list under it.
 */
function labelledLists(html: string): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  let current = 'contraindications';
  for (const table of tables(html)) {
    for (const row of table) {
      const cell = row[0] ?? '';
      const text = textOf(cell);
      if (
        row.length === 1 &&
        text &&
        text === text.toUpperCase() &&
        text.length < 60 &&
        !/<li/i.test(cell)
      ) {
        current = text.toLowerCase();
        continue;
      }
      const items = listItems(cell).length ? listItems(cell) : paragraphs(cell);
      out[current] = [...(out[current] ?? []), ...items.filter((item) => item.length > 1)];
    }
  }
  return out;
}

const LATIN_ABBREVIATION =
  /^(rx|rz|rm|sm|fr|hb|fl|cx|per|caul|bul|tub|scl|spica|lig|res|conch|os|plum|stig|exoc|med|thal|nid|colla|faex|massa|plac|gel|squama|testa|arillus|pollen|calyx|pet|cac|nod|fib|corium|carapax|plastrum|ootheca|periostracum|cornu|folium|radix|rhizoma|herba|flos|fructus|semen|cortex|ramulus|caulis|pericarpium|bulbus|tuber|sclerotium|lignum|resina|concha|plumula|stigma|exocarpium|medulla|thallus|nidus|gelatinum|ramus|stamen|stylus|receptaculum|spina|succus|oleum|pulvis)\b/i;

/** A combination box: rows alternate — the herbs of each column, then what each column is for. */
function combinations(html: string): Array<{ with: string[]; for: string }> {
  const out: Array<{ with: string[]; for: string }> = [];
  for (const table of tables(html)) {
    for (let i = 0; i + 1 < table.length; i += 2) {
      const heads = table[i];
      const uses = table[i + 1];
      heads.forEach((cell, column) => {
        const names = linesOf(cell)
          .map((line) => line.replace(/^\(|\)$/g, '').trim())
          .filter(
            (line) => line && !LATIN_ABBREVIATION.test(line) && /^[A-Za-z' ]{2,40}$/.test(line),
          );
        const use = textOf(uses[column] ?? '');
        if (names.length && use) out.push({ with: names.map(titleCasePinyin), for: use });
      });
    }
  }
  return out;
}

export function parseDragonHerb(html: string, url: string): HerbSource | null {
  const sections = accordionSections(html);
  const name = sections.find((section) => /^NAME:/i.test(section.title));
  if (!name) return null;
  const parts = nameParts(name.title);
  const pinyin = parts[0] ? titleCasePinyin(parts[0].replace(/\s*\(.*\)\s*$/, '')) : null;
  const chinese = parts.find((part) => hasCjk(part)) ?? null;
  const rows = labelledRows(name.html);
  const pharmaceutical =
    rows['pharmaceutical latin']?.[0] ??
    (parts.length >= 3 ? titleCasePinyin(parts[parts.length - 1]) : null);
  const english = rows['common english'] ?? rows['english'] ?? [];

  const category = sectionNamed(sections, /^CATEGORY/i);
  const properties = sectionNamed(sections, /^PROPERTIES/i);
  let temperatureRaw: string | null = null;
  const tastesRaw: string[] = [];
  const channelsRaw: string[] = [];
  const doses: DoseFact[] = [];
  if (properties) {
    const table = tableWithHeader(properties.html);
    const data = table?.rows[0];
    if (table && data) {
      table.headers.forEach((header, column) => {
        const cell = data[column] ?? '';
        if (/taste/.test(header)) tastesRaw.push(...linesOf(cell));
        else if (/temperature/.test(header)) temperatureRaw = textOf(cell) || null;
        else if (/meridian|channel/.test(header)) channelsRaw.push(...linesOf(cell));
        else if (/dos/.test(header)) {
          for (const line of linesOf(cell)) {
            const range = parseDoseRange(line);
            if (range) doses.push({ ...range, raw: line, source: SOURCE });
          }
        }
      });
    }
  }

  const actions: ActionFact[] = [];
  const actionBox = sectionNamed(sections, /^ACTIONS AND INDICATIONS/i);
  if (actionBox) {
    const table = tableWithHeader(actionBox.html);
    for (const row of table?.rows ?? []) {
      const action = textOf(row[0] ?? '');
      const indications = paragraphs(row[1] ?? '').filter((p) => p.length > 1);
      if (!action && indications.length === 0) continue;
      if (action) actions.push({ text: action, lang: 'en', source: SOURCE, indications });
      else if (actions.length) actions[actions.length - 1].indications!.push(...indications);
    }
  }

  const cautionBox = sectionNamed(sections, /^CONTRAINDICATIONS/i);
  const lists = cautionBox ? labelledLists(cautionBox.html) : {};
  const notesBox = sectionNamed(sections, /^NOTES/i);
  const comboBox = sectionNamed(sections, /^MAJOR COMBINATIONS/i);

  return {
    source: SOURCE,
    url,
    title: pageTitle(html),
    pinyin,
    chinese,
    botanical: null,
    pharmaceutical,
    english,
    hebrew: [],
    kind: 'chinese',
    categoryRaw: category ? textOf(category.html) || null : null,
    temperatureRaw,
    tastesRaw,
    channelsRaw,
    doses,
    partUsed: null,
    family: null,
    classicalSource: null,
    actions,
    indications: [],
    contraindications: (lists['contraindications'] ?? []).map(fact),
    interactions: (lists['herb/drug interactions'] ?? []).map(fact),
    incompatibilities: (lists['incompatibilities'] ?? []).map(fact),
    pregnancy: null,
    lactation: null,
    combinations: comboBox ? combinations(comboBox.html) : [],
    substitutes: [],
    notes: notesBox ? listItems(notesBox.html).map(fact) : [],
    restrictedInIsrael: false,
    toxic:
      /toxic/i.test(temperatureRaw ?? '') ||
      /\btoxic\b/i.test(category ? textOf(category.html) : ''),
  };
}

/** Does a formula page name a formula in pinyin (the catalogue's key), rather than a protocol ("Acute Laryngitis Gargle #1")? */
function looksLikePinyinName(name: string): boolean {
  const words = name.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > 9) return false;
  return words.every((word) => /^[a-z]{1,7}$/.test(word) && !NON_PINYIN.has(word));
}

const NON_PINYIN = new Set([
  'and',
  'the',
  'for',
  'with',
  'formula',
  'decoction',
  'powder',
  'pill',
  'pills',
  'gargle',
  'wash',
  'plaster',
  'tea',
  'syrup',
  'ointment',
  'paste',
  'tincture',
  'of',
  'acute',
  'chronic',
  'compress',
  'soak',
  'drink',
  'combination',
]);

export function parseDragonFormula(html: string, url: string): FormulaSource | null {
  const sections = accordionSections(html);
  const name = sections[0];
  if (!name) return null;
  const parts = nameParts(name.title.replace(/^NAME:\s*/i, ''));
  // "GONG JING WAN (TOPICAL)", "BA WU TANG #2": the name is what is left without the aside.
  const first = (parts[0] ?? '')
    .replace(/\s*\(.*?\)\s*/g, ' ')
    .replace(/\s*#\d+$/, '')
    .trim();
  const chinese = parts.find((part) => hasCjk(part)) ?? null;
  const pinyin = first && (chinese || looksLikePinyinName(first)) ? titleCasePinyin(first) : null;
  const rows = labelledRows(name.html);
  const english = [
    ...parts
      .slice(1)
      .filter((part) => !hasCjk(part))
      .map((part) => titleCasePinyin(part.toLowerCase())),
    ...(rows['english'] ?? []),
    ...(rows['also known as'] ?? []),
  ].filter(
    (value, index, all) =>
      value && all.findIndex((other) => other.toLowerCase() === value.toLowerCase()) === index,
  );

  const ingredients: IngredientFact[] = [];
  const herbsBox = sectionNamed(sections, /^HERBS AND ACTIONS/i);
  if (herbsBox) {
    const table = tableWithHeader(herbsBox.html);
    if (table) {
      const latinColumn = table.headers.findIndex((h) => /latin/.test(h));
      const pinyinColumn = table.headers.findIndex((h) => /pin ?yin/.test(h));
      const doseColumn = table.headers.findIndex((h) => /dos/.test(h));
      const actionsColumn = table.headers.findIndex((h) => /action/.test(h));
      for (const row of table.rows) {
        const pinyinText = textOf(row[pinyinColumn] ?? '');
        if (!pinyinText || !/^[A-Za-z' ()-]+$/.test(pinyinText)) continue;
        const doseText = textOf(row[doseColumn] ?? '');
        const range = parseDoseRange(doseText);
        ingredients.push({
          pinyin: titleCasePinyin(pinyinText.replace(/\s*\(.*\)\s*$/, '')),
          latin: textOf(row[latinColumn] ?? '') || null,
          doseMin: range?.min ?? null,
          doseMax: range?.max ?? null,
          note: range ? null : doseText || null,
          actions: paragraphs(row[actionsColumn] ?? '').join(' ') || null,
          source: SOURCE,
        });
      }
    }
  }

  const actionsBox = sectionNamed(sections, /^FORMULA ACTIONS/i);
  const syndromesBox = sectionNamed(sections, /^SYNDROMES/i);
  const manifestationsBox = sectionNamed(sections, /^CLINICAL MANIFESTATIONS/i);
  const treatsBox = sectionNamed(sections, /^TREATS/i);
  const cautionBox = sectionNamed(sections, /^CONTRAINDICATIONS/i);
  const notesBox = sectionNamed(sections, /^NOTES/i);
  const lists = cautionBox ? labelledLists(cautionBox.html) : {};

  const indications: Fact[] = [];
  let tongue: string[] = [];
  let pulse: string[] = [];
  for (const item of manifestationsBox ? listItems(manifestationsBox.html) : []) {
    const tongueMatch = item.match(/^(T|Tongue|C|Coat|Coating):\s*(.+)$/i);
    const pulseMatch = item.match(/^(P|Pulse):\s*(.+)$/i);
    if (tongueMatch)
      tongue = [
        ...tongue,
        `${/^c/i.test(tongueMatch[1]) ? 'coating' : 'tongue'}: ${tongueMatch[2]}`,
      ];
    else if (pulseMatch) pulse = [...pulse, pulseMatch[2]];
    else indications.push(fact(item));
  }

  return {
    source: SOURCE,
    url,
    title: pageTitle(html),
    pinyin,
    chinese,
    english,
    categoryRaw: null,
    classicalSource: null,
    ingredients,
    actions: actionsBox ? listItems(actionsBox.html).map(fact) : [],
    syndromes: syndromesBox ? listItems(syndromesBox.html).map(fact) : [],
    indications,
    tongue: tongue.length ? fact(tongue.join('; ')) : null,
    pulse: pulse.length ? fact(pulse.join('; ')) : null,
    treats: treatsBox ? listItems(treatsBox.html) : [],
    contraindications: (lists['contraindications'] ?? []).map(fact),
    interactions: (lists['herb/drug interactions'] ?? []).map(fact),
    notes: notesBox ? listItems(notesBox.html).map(fact) : [],
    nameMeaning: null,
  };
}

export function parseDragonPoint(html: string, url: string): PointSource | null {
  const heading = textOf(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? '');
  const codeMatch = heading.match(/POINT:\s*([A-Za-z]+\s*-?\s*\d+|[A-Za-z0-9-]+)/i);
  if (!codeMatch) return null;
  const codeRaw = codeMatch[1].replace(/\s+/g, '').toUpperCase();
  const sections = accordionSections(html);
  const name = sections.find((section) => /^NAME:/i.test(section.title));
  const pinyinRaw = name ? name.title.replace(/^NAME:\s*/i, '').trim() : '';
  const rows = name ? labelledRows(name.html) : {};
  const english = [...(rows['english'] ?? []), ...(rows['also known as'] ?? [])].filter(Boolean);
  const list = (pattern: RegExp): Fact[] => {
    const section = sectionNamed(sections, pattern);
    return section ? listItems(section.html).map(fact) : [];
  };
  const comboBox = sectionNamed(sections, /^COMBINATIONS/i);

  return {
    source: SOURCE,
    url,
    title: pageTitle(html),
    code: pointCode(codeRaw),
    codeRaw,
    pinyin: pinyinRaw ? titleCasePinyin(pinyinRaw.toLowerCase()) : null,
    chinese: null,
    english,
    location: list(/^LOCATION/i),
    needling: list(/^NEEDLING/i),
    commandFunctions: list(/^COMMAND FUNCTIONS/i),
    actions: list(/^ACTIONS/i),
    indications: list(/^INDICATIONS/i),
    combinations: comboBox ? pointCombinations(comboBox.html) : [],
    contraindications: list(/^CONTRAINDICATIONS/i),
    notes: list(/^NOTES/i),
  };
}

/** Point combinations: the first row names points (code and name on separate lines), the next says what for. */
function pointCombinations(html: string): Array<{ with: string[]; for: string }> {
  const out: Array<{ with: string[]; for: string }> = [];
  for (const table of tables(html)) {
    for (let i = 0; i + 1 < table.length; i += 2) {
      const heads = table[i];
      const uses = table[i + 1];
      heads.forEach((cell, column) => {
        const codes = linesOf(cell)
          .map((line) => pointCode(line))
          .filter((code): code is string => Boolean(code));
        const use = textOf(uses[column] ?? '');
        if (codes.length && use) out.push({ with: codes, for: use });
      });
    }
  }
  return out;
}
