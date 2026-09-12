// A Wikipedia article's plain text, cut at its headings and folded into the
// entry's sections. Pure, so it is tested without a network.
//
// Headings are matched by meaning in either language; a heading that means
// nothing to the entry (history, epidemiology, culture) is left out, and a
// dosage heading is left out on purpose — a dose is quoted from a label,
// never from an encyclopedia.

const CONDITION_HEADINGS = [
  ['symptoms', /תסמינ|סימנים|תמונה קלינית|signs? and symptoms|symptoms|presentation|clinical features/i],
  ['causes', /גורמ|סיבות|אטיולוגי|פתופיזיולוגי|מנגנון|cause|etiology|aetiology|risk factors|pathophysiology|mechanism/i],
  ['diagnosis', /אבחו|אבחנה|diagnos/i],
  ['treatment', /טיפול|תרופות|ניהול|טיפולים|treatment|management|therapy/i],
  ['self_care', /מניעה|אורח חיים|prevention|lifestyle|self[- ]care/i],
];

const SYMPTOM_HEADINGS = [
  ['possible_causes', /גורמ|סיבות|אטיולוגי|cause|etiology|aetiology|differential/i],
  ['self_care', /טיפול|מניעה|treatment|management|prevention/i],
];

const DRUG_HEADINGS = [
  ['what_for', /שימוש|התווי|יישום|medical use|indication|uses/i],
  ['side_effects', /תופעות לוואי|adverse|side effect/i],
  ['who_cannot', /התוויות נגד|אזהר|contraindication|warning|precaution/i],
  ['interactions', /אינטראקצ|interaction/i],
  ['pregnancy', /הריון|הנקה|pregnan|lactation|breastfeed/i],
];

/** Never taken from an encyclopedia. */
const FORBIDDEN = /מינון|dosage|dose|dosing/i;

const HEADINGS = { condition: CONDITION_HEADINGS, symptom: SYMPTOM_HEADINGS, drug: DRUG_HEADINGS };

/**
 * `== Heading ==` blocks of a TextExtracts plain-text article.
 * @param {string} text
 * @returns {{ intro: string, sections: Array<{ title: string, level: number, text: string }> }}
 */
export function splitArticle(text) {
  const lines = String(text ?? '').split('\n');
  const parsed = { intro: '', sections: [] };
  let current = null;
  let buffer = [];
  const flush = () => {
    const body = buffer.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    if (current === null) parsed.intro = body;
    else if (body) parsed.sections.push({ title: current, level: currentLevel, text: body });
    buffer = [];
  };
  let currentLevel = 0;
  for (const line of lines) {
    const heading = line.match(/^(={2,6})\s*(.+?)\s*\1\s*$/);
    if (heading) {
      flush();
      current = heading[2].trim();
      currentLevel = heading[1].length;
    } else buffer.push(line);
  }
  flush();
  return parsed;
}

/**
 * The article folded into the entry's sections for its kind. The intro is
 * the overview; a subsection is folded under the heading that matched its
 * parent when it matches nothing itself.
 * @param {'condition' | 'symptom' | 'drug'} kind
 * @param {string} text
 * @param {number} [maxChars]
 * @returns {{ sections: Record<string, string>, used: Array<{ key: string, title: string | null }>, intro: string }}
 */
export function foldArticle(kind, text, maxChars = 2500) {
  const parsed = splitArticle(text);
  const rules = HEADINGS[kind] ?? CONDITION_HEADINGS;
  const out = {};
  const used = [];
  const add = (key, body, title) => {
    if (!body) return;
    out[key] = out[key] ? `${out[key]}\n\n${body}` : body;
    used.push({ key, title });
  };
  if (parsed.intro) add('overview', parsed.intro, null);
  let inherited = null;
  let inheritedLevel = 0;
  for (const section of parsed.sections) {
    if (FORBIDDEN.test(section.title)) {
      inherited = null;
      continue;
    }
    const rule = rules.find(([, pattern]) => pattern.test(section.title));
    if (rule) {
      add(rule[0], section.text, section.title);
      inherited = rule[0];
      inheritedLevel = section.level;
    } else if (inherited && section.level > inheritedLevel) {
      add(inherited, section.text, section.title);
    } else {
      inherited = null;
    }
  }
  for (const key of Object.keys(out)) {
    if (out[key].length > maxChars) out[key] = `${out[key].slice(0, maxChars).trimEnd()} […]`;
  }
  return { sections: out, used, intro: parsed.intro };
}
