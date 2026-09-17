// The canon books cut by their own structure: one entry per herb, formula and
// point, split into the sections every monograph of that book carries, and
// the books that are read as prose (the pattern and treatment books) cut into
// passages under their nearest headings. A question about a dose goes to the
// dosage section of that herb, not to whichever slice of pages happens to
// mention the number.
//
// Nothing here names a book to a reader: entries and passages carry the id of
// the book they came from for loading and checking only.

const CJK = /[\u3400-\u9fff]/;

/** Letters without tone marks, lower case, with the look-alikes OCR prints for pinyin vowels (zł = zǐ, đ = d, ð = ǒ). */
export function fold(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[łıř]/g, 'i')
    .replace(/đ/g, 'd')
    .replace(/ð/g, 'o')
    .toLowerCase();
}

/** A name as a lookup key: folded, letters and digits only ("Xiāo Yáo Sǎn" and "xiao yao san" meet). */
export const nameKey = (text) => fold(text).replace(/[^a-z0-9]/g, '');

const CHANNEL_CODES = {
  lu: 'LU',
  li: 'LI',
  st: 'ST',
  sp: 'SP',
  he: 'HE',
  ht: 'HE',
  h: 'HE',
  si: 'SI',
  bl: 'BL',
  ub: 'BL',
  b: 'BL',
  kid: 'KID',
  ki: 'KID',
  k: 'KID',
  kd: 'KID',
  p: 'P',
  pc: 'P',
  sj: 'SJ',
  tb: 'SJ',
  te: 'SJ',
  tw: 'SJ',
  gb: 'GB',
  liv: 'LIV',
  lr: 'LIV',
  le: 'LIV',
  ren: 'REN',
  cv: 'REN',
  du: 'DU',
  gv: 'DU',
};

/** A point code as the canon writes it ("sp6", "Sp-6", "CV 4", "TE5" → SP-6, SP-6, REN-4, SJ-5), or null. */
export function pointCode(text) {
  const m = fold(text)
    .trim()
    .match(
      /^(lu|li|st|sp|he|ht|si|bl|ub|kid|kd|ki|pc|sj|tb|te|tw|gb|liv|lr|le|ren|cv|du|gv|h|k|b|p)\s*[-.]?\s*(\d{1,2})$/,
    );
  return m ? `${CHANNEL_CODES[m[1]]}-${Number(m[2])}` : null;
}

/** Words broken across a line end are joined, and the lines of a paragraph run together. */
export function flow(lines) {
  return lines
    .join('\n')
    .replace(/([a-z])-\n([a-z])/g, '$1$2')
    .replace(/ \t /g, ' — ')
    .replace(/[ \t]*\n[ \t]*(?![•⚫▪>]|-\s|\d+\.\s)/g, ' ')
    .replace(/[ \t]*\n[ \t]*/g, '\n')
    .replace(/[ ]{2,}/g, ' ')
    .trim();
}

// ---------------------------------------------------------------------------
// Herbs: one monograph per PHARMACEUTICAL NAME box.

const HERB_BOX = [
  ['family', /^family\b\s*(.*)$/i],
  ['species', /^standard\s+species\b\s*(.*)$/i],
  ['english', /^english\b\s*(.*)$/i],
  ['japanese', /^japanese\b\s*(.*)$/i],
  ['korean', /^korean\b\s*(.*)$/i],
  ['first_text', /^text in which first appeared\b\s*(.*)$/i],
  ['properties', /^properties\b\s*(.*)$/i],
  ['channels', /^channels?\s+entered\b\s*(.*)$/i],
  ['key', /^key\s+characteristics\b\s*(.*)$/i],
  ['dosage', /^dosage\b\s*(.*)$/i],
  ['cautions', /^cautions\s*&\s*contraindications\b\s*(.*)$/i],
];
const HERB_SECTIONS = [
  ['actions', /^actions\s*&\s*indications$/i],
  ['combinations', /^mechanisms of selected combinations$/i],
  ['comparisons', /^comparisons$/i],
  ['commentary', /^commentary$/i],
  ['traditional_contraindications', /^traditional contraindications$/i],
  ['toxicity', /^toxicity$/i],
  ['preparation', /^nomenclature\s*&\s*preparation$/i],
  ['quality', /^quality criteria$/i],
  ['chemistry', /^(?:major known chemical constituents|other constituents)$/i],
  ['variants', /^alternate species\s*&\s*local variants$/i],
  ['names', /^alternate names$/i],
  ['product', /^additional product information$/i],
  ['adulterants', /^adulterants$/i],
  ['addendum', /^addendum$/i],
];
const HERB_RUNNING_HEAD = [
  /^\d{1,4}$/,
  /^\d{1,2}\s*\/\s*[A-Z][^.]{3,70}$/,
  /^\d{1,2}\s+(?:Herbs|Substances)\b[^.]{0,70}$/,
  /^(?:Herbs|Substances)\b[^.]{0,70}\s\/?\s*\d{1,2}$/,
];
/** The running head glued into a line of text by the OCR ("for blood 12 / Tonifying Herbs deficiency"). */
const HERB_INLINE_HEAD =
  /\s?\b\d{1,2} \/ (?:[A-Z][a-z]+ )*(?:Herbs|Substances)(?: (?:that|for|to|and) (?:[A-Z]?[a-z]+ ?){1,6}(?=[a-z]))?/g;
const HERB_BREAK = [/^chapter\s+\d+\b/i, /^section\s+\d+\b/i, /^summary table of herb actions/i];

const pinyinOf = (headerLines) =>
  headerLines
    .filter((l) => !CJK.test(l.line) && !/^addendum$/i.test(l.line))
    .map((l) => l.line)
    .join(' ')
    .trim();

/**
 * @param {{page: number, text: string}[]} pages
 * @returns {{entries: object[], loose: {page: number, text: string}[]}}
 */
export function parseHerbs(pages, book) {
  const lines = [];
  for (const { page, text } of pages) {
    for (const raw of text.split('\n')) {
      const line = raw.trim();
      if (!line || HERB_RUNNING_HEAD.some((re) => re.test(line))) continue;
      lines.push({ page, line: line.replace(HERB_INLINE_HEAD, '').trim() || line });
    }
  }
  const anchors = [];
  lines.forEach(({ line }, i) => {
    if (/^pharmaceutical\s+name\b/i.test(line)) anchors.push(i);
  });
  const starts = anchors.map((a) => {
    for (let back = 1; back <= 4 && a - back >= 0; back += 1)
      if (CJK.test(lines[a - back].line)) return a - back;
    return Math.max(0, a - 1);
  });
  const entries = [];
  const used = new Set();
  anchors.forEach((anchor, k) => {
    const start = starts[k];
    let end = k + 1 < anchors.length ? starts[k + 1] : lines.length;
    for (let i = anchor + 1; i < end; i += 1) {
      if (HERB_BREAK.some((re) => re.test(lines[i].line))) {
        end = i;
        break;
      }
    }
    for (let i = start; i < end; i += 1) used.add(i);
    const chinese = lines
      .slice(start, anchor)
      .filter((l) => CJK.test(l.line))
      .map((l) => l.line)
      .join(' ');
    const pinyin = pinyinOf(lines.slice(start, anchor));
    let latin = lines[anchor].line.replace(/^pharmaceutical\s+name\b[:\s]*/i, '').trim();
    let cursor = anchor + 1;
    if (!latin && cursor < end && !HERB_BOX.some(([, re]) => re.test(lines[cursor].line)))
      latin = lines[cursor++].line;
    if (!latin) {
      // The box's name line went elsewhere in the reading; the text names the herb
      // as "Latin (pinyin)" many times, and the commonest such name is taken.
      const key = nameKey(pinyinOf(lines.slice(start, anchor)));
      const counts = new Map();
      for (let i = anchor; i < end; i += 1) {
        for (const m of lines[i].line.matchAll(
          /((?:[A-Z][a-z]+ )(?:[a-z]+ )*(?:[A-Z][a-z]+|[a-z]+)(?: [a-z]+)*) \(([^)]{2,30})\)/g,
        )) {
          if (HERB_NAME.test(m[1]) && nameKey(m[2]) === key)
            counts.set(m[1], (counts.get(m[1]) ?? 0) + 1);
        }
      }
      latin = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
    }
    const sections = {};
    let current = null;
    const push = (key, text) => {
      sections[key] = sections[key] ?? [];
      if (text) sections[key].push(text);
      current = key;
    };
    for (let i = cursor; i < end; i += 1) {
      const { line } = lines[i];
      const offset = i - anchor;
      const box = offset <= 90 ? HERB_BOX.find(([, re]) => re.test(line)) : null;
      if (box) {
        push(box[0], line.match(box[1])[1].trim());
        continue;
      }
      const section = HERB_SECTIONS.find(([, re]) => re.test(line));
      if (section) {
        push(section[0], '');
        continue;
      }
      if (current) sections[current].push(line);
    }
    const flowed = Object.fromEntries(
      Object.entries(sections)
        .map(([key, value]) => [key, flow(value)])
        .filter(([, v]) => v),
    );
    entries.push({
      id: `${book}:${nameKey(latin) || k}`,
      book,
      kind: 'herb',
      page: lines[start].page,
      names: { pinyin, chinese, latin, english: flowed.english ?? '' },
      sections: flowed,
    });
  });
  const loose = looseText(lines, used);
  return { entries: dedupeIds(entries), loose };
}

// ---------------------------------------------------------------------------
// Formulas: a Chinese title, an English name and a pinyin name, then a Source.

const FORMULA_TAIL = new Set([
  'tang',
  'san',
  'wan',
  'yin',
  'dan',
  'gao',
  'zi',
  'fang',
  'jiu',
  'pian',
  'ji',
  'lu',
  'cha',
  'zhou',
  'bing',
  'yi',
  'ding',
  'jian',
  'shui',
  'mo',
  'xiang',
]);
const FORMULA_SECTIONS = [
  ['preparation', /^Method of Preparation\b\s*(.*)$/],
  ['actions', /^Actions\b\s*(.*)$/],
  ['indications', /^Indications\b\s*(.*)$/],
  ['analysis', /^Analysis of Formula\b\s*(.*)$/],
  ['cautions', /^Cautions and Contraindications\b\s*(.*)$/],
  ['commentary', /^Commentary\b\s*(.*)$/],
  ['comparisons', /^Comparisons?\b\s*(.*)$/],
  ['biomedical', /^Biomedical Indications\b\s*(.*)$/],
  ['modifications', /^Modifications\b\s*(.*)$/],
  ['associated', /^Associated Formulas?\b\s*(.*)$/],
  ['alternate_names', /^Alternate [Nn]ames?\b\s*(.*)$/],
];
const DOSE_AT_END = /\d(?:\.\d+)?\s?(?:g|pieces?|pc|cun|ml|liters?|L|fen|qian)\b[^a-z]*$/i;
const HERB_NAME =
  /\b(?:Radix|Rhizoma|Herba|Fructus|Semen|Cortex|Flos|Folium|Ramulus|Caulis|Pericarpium|Concha|Os|Squama|Gypsum|Borneolum|Resina|Calculus|Spica|Bulbus|Tuber|Cornu|Plastrum|Carapax|Poria|Massa|Colla|Mel|Succinum|Talcum|Natrii|Sulfur|Cinnabaris|Magnetitum|Haematitum|Fluoritum|Halloysitum|Terra|Periostracum|Scorpio|Scolopendra|Bombyx|Lumbricus|Hirudo|Eupolyphaga|Moschus|Secretio|Placenta|Ootheca|Endothelium|Nidus|Stamen|Stigma|Receptaculum|Thallus|Lignum|Sclerotium|Medulla|Exocarpium|Petiolus|Styrax|Sal|Alumen|Mirabilitum|Crinis|Glycine|Oryza|Hordei|Tritici|Setariae|Vinum|Acetum|Saccharum|Syzygii)\b/;

function isPinyinName(line) {
  if (line.length > 70 || /^[A-Z]/.test(line.trim())) return false;
  const tokens = fold(line)
    .replace(/[[\]()'’`.,;:-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length < 2 || tokens.length > 9) return false;
  if (!tokens.every((t) => /^[a-z]{1,6}$/.test(t))) return false;
  return FORMULA_TAIL.has(tokens.at(-1));
}

/**
 * @param {{page: number, text: string}[]} pages pages in reading order (vision-layout.mjs)
 */
export function parseFormulas(pages, book) {
  const lines = [];
  for (const { page, text } of pages)
    for (const raw of text.split('\n')) if (raw.trim()) lines.push({ page, line: raw.trim() });
  const heads = [];
  for (let i = 1; i < lines.length; i += 1) {
    if (!isPinyinName(lines[i].line)) continue;
    const english = lines[i - 1].line;
    // A long English name wraps: "Emperor of Heaven's Special Pill" / "to Tonify the Heart".
    const wrapped =
      i >= 3 &&
      /^[a-z]/.test(english) &&
      /^[A-Z]/.test(lines[i - 2].line) &&
      !CJK.test(lines[i - 2].line) &&
      english.length < 60;
    if (
      CJK.test(english) ||
      (!/^[A-Z[]/.test(english) && !wrapped) ||
      english.length > 100 ||
      /[.;:]$/.test(english)
    )
      continue;
    let cjk = -1;
    for (let back = 2; back <= 4 && i - back >= 0; back += 1)
      if (CJK.test(lines[i - back].line)) cjk = i - back;
    if (cjk < 0) continue;
    let source = -1;
    for (let j = i + 1; j < Math.min(lines.length, i + 40); j += 1) {
      if (/^(?:Source|SOURCE)\b/.test(lines[j].line)) {
        source = j;
        break;
      }
      if (isPinyinName(lines[j].line) && j > i + 1) break;
    }
    if (source < 0) continue;
    // The English name may have wrapped onto the line above it.
    let englishStart = i - 1;
    if (cjk < i - 2 && !CJK.test(lines[i - 2].line)) englishStart = i - 2;
    heads.push({
      start: cjk,
      pinyin: i,
      englishStart,
      source,
      associated: /^SOURCE\b/.test(lines[source].line),
    });
  }
  const entries = [];
  const used = new Set();
  let parent = null;
  heads.forEach((head, k) => {
    const end = k + 1 < heads.length ? heads[k + 1].start : lines.length;
    for (let i = head.start; i < end; i += 1) used.add(i);
    const names = {
      chinese: lines
        .slice(head.start, head.englishStart)
        .map((l) => l.line)
        .join(' '),
      english: lines
        .slice(head.englishStart, head.pinyin)
        .map((l) => l.line)
        .join(' '),
      pinyin: lines[head.pinyin].line,
    };
    const sections = {};
    const intro = lines.slice(head.pinyin + 1, head.source).map((l) => l.line);
    if (intro.length) sections.intro = intro;
    // The source may run onto a second line; the composition follows it.
    const sourceLines = [lines[head.source].line.replace(/^(?:Source|SOURCE)\b\s*/, '')];
    let i = head.source + 1;
    while (
      i < end &&
      !DOSE_AT_END.test(lines[i].line) &&
      !HERB_NAME.test(lines[i].line) &&
      !FORMULA_SECTIONS.some(([, re]) => re.test(lines[i].line)) &&
      sourceLines.length < 3 &&
      !/[.]$/.test(sourceLines.at(-1)) &&
      !/\(\S*\d{3,4}\S*\)$/.test(sourceLines.at(-1))
    ) {
      sourceLines.push(lines[i].line);
      i += 1;
    }
    sections.source = sourceLines;
    const composition = [];
    for (; i < end; i += 1) {
      const { line } = lines[i];
      if (FORMULA_SECTIONS.some(([, re]) => re.test(line))) break;
      const herbLine =
        line.includes('\t') ||
        DOSE_AT_END.test(line) ||
        (HERB_NAME.test(line) &&
          line.length < 80 &&
          !/[.]$/.test(line) &&
          !/\b(?:the|and|with|for|to|is|are|of)\b/.test(line.replace(/\(.*?\)/g, '')));
      if (!herbLine) break;
      composition.push(line);
    }
    sections.composition = composition;
    let current = head.associated ? 'text' : null;
    for (; i < end; i += 1) {
      const { line } = lines[i];
      const section = head.associated ? null : FORMULA_SECTIONS.find(([, re]) => re.test(line));
      if (section) {
        current = section[0];
        sections[current] = sections[current] ?? [];
        const rest = line.match(section[1])[1].trim();
        if (rest) sections[current].push(rest);
        continue;
      }
      if (!current) current = 'text';
      sections[current] = sections[current] ?? [];
      sections[current].push(line);
    }
    const flowed = {};
    for (const [key, value] of Object.entries(sections)) {
      const text =
        key === 'composition'
          ? value.map((l) => l.replace(/\s*\t\s*/g, ' — ')).join('\n')
          : flow(value);
      if (text) flowed[key] = text;
    }
    if (!head.associated) parent = names.pinyin;
    entries.push({
      id: `${book}:${nameKey(names.pinyin)}`,
      book,
      kind: 'formula',
      page: lines[head.start].page,
      associatedWith: head.associated ? parent : null,
      names,
      sections: flowed,
    });
  });
  return { entries: dedupeIds(entries), loose: looseText(lines, used) };
}

// ---------------------------------------------------------------------------
// Points: a pinyin name and a code in capitals, then LOCATION.

const POINT_SECTIONS = [
  ['location_note', /^LOCATION NOTE\b\s*[il]?\s*(.*)$/],
  ['location', /^LOCATION\b\s*(.*)$/],
  ['needling', /^NEEDLING\b\s*[il]?\s*(.*)$/],
  ['actions', /^ACTIONS\b\s*(.*)$/],
  ['indications', /^INDICATIONS\b\s*(.*)$/],
  ['commentary', /^COMMENTARY\b\s*(.*)$/],
  ['combinations', /^COMBINATIONS\b\s*(.*)$/],
];
const POINT_HEAD =
  /^([A-Z][A-Z' ]{2,28}?)\s*\(?\s*((?:LU|LI|ST|SP|HE|SI|BL|KID|P|SJ|GB|LIV|REN|DU)-\d{1,2}|[MN]-[A-Z]{2}-\d{1,2})\)?$/;

/** The scan's reading of the codes: "L.1.-4" is LI-4, "SJ-I 0" is SJ-10. */
export function fixPointCodes(text) {
  return String(text ?? '')
    .replace(/\bL\.\s?[1Il]\.?\s?-\s?([0-9Il]{1,2})\b/g, (m, n) => `LI-${n.replace(/[Il]/g, '1')}`)
    .replace(
      /\b(LU|LI|ST|SP|HE|SI|BL|KID|P|SJ|GB|LIV|REN|DU)\s?-\s?([Il][0-9Il]?|[0-9][Il])(?:\s([0-9]))?\b/g,
      (m, ch, a, b) => `${ch}-${a.replace(/[Il]/g, '1')}${b ?? ''}`,
    );
}

const POINT_RUNNING_HEAD =
  /^(?:\d{1,3}\s+)?(?:Lung|Large Intestine|Stomach|Spleen|Heart|Small Intestine|Bladder|Kidney|Pericardium|Sanjiao|Gall Bladder|Liver|Conception Vessel|Governing Vessel|Extra)\s+(?:Channel|Vessel|Points|points)(?:\s+\d{1,3})?(?=\s|$)\s*/;

export function parsePoints(pages, book) {
  const lines = [];
  for (const { page, text } of pages) {
    const cleaned = fixPointCodes(text).replace(POINT_RUNNING_HEAD, '');
    for (const raw of cleaned.split('\n')) if (raw.trim()) lines.push({ page, line: raw.trim() });
  }
  const heads = [];
  lines.forEach(({ line }, i) => {
    // The Chinese name printed beside the header comes after a wide gap ("TAICHONG LIV-3 \t 太").
    const m = line.replace(/\s*\t.*$/, '').match(POINT_HEAD);
    if (!m) return;
    for (let j = i + 1; j < Math.min(lines.length, i + 14); j += 1) {
      if (/^LOCATION\b/.test(lines[j].line)) {
        heads.push({ at: i, pinyin: m[1].trim(), code: m[2], location: j });
        return;
      }
    }
  });
  const entries = [];
  const used = new Set();
  heads.forEach((head, k) => {
    const end = k + 1 < heads.length ? heads[k + 1].at : lines.length;
    for (let i = head.at; i < end; i += 1) used.add(i);
    const header = lines.slice(head.at + 1, head.location).map((l) => l.line);
    // The Chinese name is printed beside the header one character to a line; those lines are not categories.
    const sections = { categories: header.slice(1).filter((l) => !CJK.test(l) && l.length > 3) };
    let current = null;
    for (let i = head.location; i < end; i += 1) {
      const { line } = lines[i];
      const section = POINT_SECTIONS.find(([, re]) => re.test(line));
      if (section) {
        current = section[0];
        sections[current] = sections[current] ?? [];
        const rest = line.match(section[1])[1].trim();
        if (rest) sections[current].push(rest);
        continue;
      }
      if (current) sections[current].push(line);
    }
    const flowed = Object.fromEntries(
      Object.entries(sections)
        .map(([key, value]) => [key, flow(value)])
        .filter(([, v]) => v),
    );
    const pinyin = head.pinyin.charAt(0) + head.pinyin.slice(1).toLowerCase();
    entries.push({
      id: `${book}:${head.code}`,
      book,
      kind: 'point',
      page: lines[head.at].page,
      names: {
        pinyin,
        code: head.code,
        english:
          CJK.test(header[0] ?? '') && !/[A-Za-z]{3}/.test(header[0])
            ? ''
            : (header[0] ?? '')
                .split('\t')[0]
                .replace(/[\u3400-\u9fff]/g, '')
                .trim(),
      },
      sections: flowed,
    });
  });
  return { entries: dedupeIds(entries), loose: looseText(lines, used) };
}

// ---------------------------------------------------------------------------
// Prose: passages under their nearest headings.

/**
 * The sub-headings the pattern books repeat under every pattern. A passage
 * that starts at "Clinical manifestations" is useless without the pattern
 * above it, so the pattern's own line — the short line just before its
 * "Clinical manifestations" — is kept as the passage's heading.
 */
const SUBHEADINGS =
  /^(?:Clinical manifestations|Treatment principle|Acupuncture|Points|Explanation|Herbal therapy|Herbal treatment|Prescriptions?|Modifications|Variations|Three Treasures remedy|Women's Treasure remedy|Case history|Case study|Prognosis|Prevention|Diet|Summary|Aetiology|Pathology|Diagnosis|Tongue|Pulse|Symptoms)$/i;

/** A line that says which book it is: a running head ("424 The Practice of Chinese Medicine") or a copyright line. */
const BOOK_LINE =
  /(?:^\d{1,4}\s+.*Chinese Medicine$|^.*Chinese Medicine\s+\d{1,4}$|^ISBN\b|©|Elsevier|Churchill Livingstone|All rights reserved)/i;

const isShortLabel = (text) =>
  text.length <= 70 &&
  !/[.!?,;:]$/.test(text) &&
  !/\d{3,}/.test(text) &&
  text.split(/\s+/).length <= 9 &&
  /^[A-Z(“"]/.test(text);
const isCaps = (text) => text === text.toUpperCase() && /[A-Z]{3}/.test(text) && !/\d/.test(text);

/** A page of a contents list or an index: most lines end in a page number. */
function isListPage(lines) {
  if (lines.length < 8) return false;
  return lines.filter((l) => /\s\d{1,4}(?:[-–,]\s?\d{1,4})*$/.test(l)).length / lines.length > 0.35;
}

/**
 * Passages of about maxChars, whole sentences, each opened with the headings
 * above it: the chapter, the pattern (or the section in capitals), and the
 * sub-heading. Running heads that name the book are dropped with the page numbers.
 * @param {{page: number, text: string}[]} pages
 */
export function prosePassages(pages, book, { maxChars = 1600, skipPages = () => false } = {}) {
  const all = [];
  for (const { page, text } of pages) {
    if (skipPages(page)) continue;
    const lines = String(text ?? '')
      .replace(
        /Licensed (?:digital )?edition prepared exclusively for[\s\S]*?(?:may not be redistributed\.?|$)/gi,
        '',
      )
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !/^\d{1,4}$/.test(l) && !BOOK_LINE.test(l));
    if (isListPage(lines)) continue;
    for (const line of lines) all.push({ page, line });
  }
  const passages = [];
  const trail = { chapter: '', section: '', pattern: '', sub: '' };
  let buffer = [];
  let bufferPage = null;
  let size = 0;
  const heading = () =>
    [trail.chapter, trail.pattern || trail.section, trail.sub].filter(Boolean).join(' › ');
  let bufferHeading = '';
  const flush = () => {
    const text = flow(buffer);
    if (text.length > 120) passages.push({ book, page: bufferPage, heading: bufferHeading, text });
    buffer = [];
    size = 0;
    bufferPage = null;
  };
  for (let i = 0; i < all.length; i += 1) {
    const { page, line } = all[i];
    const next = all[i + 1]?.line ?? '';
    const afterNext = all[i + 2]?.line ?? '';
    let kind = null;
    if (/^CHAPTER\s+\d+$/i.test(line)) kind = 'chapter-mark';
    else if (all[i - 1] && /^CHAPTER\s+\d+$/i.test(all[i - 1].line) && isShortLabel(line))
      kind = 'chapter';
    else if (SUBHEADINGS.test(line)) kind = 'sub';
    else if (
      isShortLabel(line) &&
      (/^Clinical manifestations$/i.test(next) ||
        (/^Clinical manifestations$/i.test(afterNext) && isShortLabel(next)))
    )
      kind = 'pattern';
    else if (isCaps(line) && isShortLabel(line)) kind = 'section';
    if (kind) {
      if (size > 300 && kind !== 'chapter-mark') flush();
      if (kind === 'chapter')
        Object.assign(trail, { chapter: line, section: '', pattern: '', sub: '' });
      if (kind === 'section') Object.assign(trail, { section: line, pattern: '', sub: '' });
      if (kind === 'pattern')
        Object.assign(trail, {
          pattern:
            /^Clinical manifestations$/i.test(next) || !trail.pattern
              ? line
              : `${trail.pattern} ${line}`,
          sub: '',
        });
      if (kind === 'sub') trail.sub = line;
      if (!buffer.length) bufferHeading = heading();
      continue;
    }
    if (bufferPage === null) {
      bufferPage = page;
      bufferHeading = heading();
    }
    buffer.push(line);
    size += line.length + 1;
    if (size >= maxChars && /[.!?:)]$/.test(line)) flush();
  }
  flush();
  return passages;
}

// ---------------------------------------------------------------------------

/** Lines no entry claimed (chapter and section introductions), grouped by page. */
function looseText(lines, used) {
  const byPage = new Map();
  lines.forEach(({ page, line }, i) => {
    if (used.has(i)) return;
    if (!byPage.has(page)) byPage.set(page, []);
    byPage.get(page).push(line);
  });
  return [...byPage.entries()].map(([page, pageLines]) => ({ page, text: pageLines.join('\n') }));
}

function dedupeIds(entries) {
  const seen = new Map();
  for (const entry of entries) {
    const n = seen.get(entry.id) ?? 0;
    seen.set(entry.id, n + 1);
    if (n > 0) entry.id = `${entry.id}~${n + 1}`;
  }
  return entries;
}
