// The two readers, on pages and records shaped like the real ones but with
// invented content — the sources' own text is theirs and stays out of the
// repository. What is tested is the structure: where each fact is read from.
import { describe, expect, it } from 'vitest';
import {
  parseDragonFormula,
  parseDragonHerb,
  parseDragonPoint,
} from '@catalogue/americandragon.ts';
import { blocksOf, parseBaraFormula, parseBaraHerb } from '@catalogue/bara.ts';
import { accordionSections, linesOf, tables, textOf } from '@catalogue/html.ts';
import { mergeFormula, mergeHerb } from '@catalogue/merge.ts';

const trig = (title: string, content: string, wrap = false) =>
  `<div class="p7ABtrig"><h3>${wrap ? '<strong>' : ''}<a href="javascript:;" id="x">${title}</a>${wrap ? '</strong>' : ''}</h3></div><div id="w"><div id="c" class="p7ABcontent">${content}</div></div>`;

const HERB_PAGE = `<html><head><title>Ce Shi Cao - Test Herb</title></head><body><h1>INDIVIDUAL HERBS</h1><div id="maincontent"><div class="p7AB">
${trig('NAME: <em>CE SHI CAO - </em>&#27979;&#35797;&#33609; - HERBA PROBATIONIS', '<table><tr><td class="leftcollevel3"><strong>Pharmaceutical Latin:</strong></td><td>Herba Probationis</td></tr><tr><td><strong>Common English:</strong></td><td>Test Grass <br> Trial Herb</td></tr></table>')}
${trig('<strong>CATEGORY</strong>', '<strong>Herbs that Tonify Qi</strong>')}
${trig('<strong>PROPERTIES</strong>', '<table><tr><td><strong>Taste</strong></td><td><strong>Temperature</strong></td><td><strong>Entering Meridians </strong></td><td><strong>Dosage</strong></td></tr><tr><td><div align="center">Sweet<br> Bitter</div></td><td><div>Slightly Warm</div></td><td><div>Spleen<br>Lung</div></td><td><div>6-15g<br> Tincture: 2-4ml</div></td></tr></table>')}
${trig('<strong>ACTIONS AND INDICATIONS</strong>', '<table><tr><td><strong>Actions</strong></td><td><strong>Indications/Syndromes</strong></td></tr><tr><td><p><strong>Tonifies the Spleen <em>Qi</em></strong></p></td><td><p>Fatigue with poor appetite</p><p>Loose stools from Spleen <em>Qi</em> Deficiency</p></td></tr><tr><td><p><strong>Raises the <em>Yang</em></strong></p></td><td><p>Prolapse of the rectum</p></td></tr></table>')}
${trig('<strong>CONTRAINDICATIONS, INCOMPATIBILITIES AND HERB/DRUG INTERACTIONS</strong>', '<table><tr><td><div align="center"><strong>CONTRAINDICATIONS</strong></div></td></tr><tr><td><ul><li>Contraindicated in Excess patterns.</li><li>Use with caution in pregnancy.</li></ul></td></tr><tr><td><div align="center"><strong>INCOMPATIBILITIES</strong></div></td></tr><tr><td><ul><li>Counteracts Rx. Exempli <em><a href="X.html">Li Zi Gen</a></em></li></ul></td></tr><tr><td><div align="center"><strong>HERB/DRUG INTERACTIONS </strong></div></td></tr><tr><td><ul><li></li></ul></td></tr></table>')}
${trig('<strong>MAJOR COMBINATIONS</strong>', '<table><tr class="leftcollevel3"><td><div align="center"><p><strong>Rx. Alpha<br><em><a href="A.html">Jia Yi</a></em></strong></p></div></td><td><div align="center"><p><strong>Rx. Beta<br><em><a href="B.html">Bing Ding</a></em></strong><br><strong>Sm. Gamma<br><em><a href="C.html">Wu Ji</a></em></strong></p></div></td></tr><tr class="rightcolslevel3"><td><p>Fatigue from Qi Deficiency.</p></td><td><p>Edema with Spleen Deficiency.</p></td></tr></table>')}
${trig('<strong>NOTES</strong>', '<ol><li>A note about the herb.</li><li></li></ol>')}
</div></div></body></html>`;

const FORMULA_PAGE = `<html><head><title>Ce Shi Tang - Test Decoction</title></head><body><h1>HERB FORMULAS</h1><div class="p7AB">
${trig('<em>CE SHI TANG </em>- &#27979;&#35797;&#27748; - TRIAL DECOCTION', '<table><tr><td><strong>English:</strong></td><td>Trial Decoction</td></tr><tr><td><strong>Also Known As:</strong></td><td>Test Combination</td></tr></table>', true)}
${trig('<strong>HERBS AND ACTIONS</strong>', '<table><tr><td><strong>Pharmaceutical Latin </strong></td><td><strong><em>Pin Yin </em></strong></td><td>Dosage </td><td><strong>Actions</strong></td></tr><tr><td><strong>Rx. Alpha</strong></td><td><em><strong><a href="../Individualherbsupdate/JiaYi.html">Jia Yi </a></strong></em></td><td>6-9g</td><td>Tonifies Qi.</td></tr><tr><td><strong>Rx. Beta</strong></td><td><em><a href="x">Bing Ding</a></em></td><td>3g</td><td>Harmonizes.</td></tr></table>', true)}
${trig('<strong>FORMULA ACTIONS </strong>', '<ul><li>Tonifies <em>Qi</em></li><li> Harmonizes the Middle</li></ul>', true)}
${trig('<strong>SYNDROMES</strong>', '<ul><li>Spleen <em>Qi</em> Deficiency</li></ul>', true)}
${trig('<strong>CLINICAL MANIFESTATIONS </strong>', '<table><tr><td><ul><li>Fatigue</li><li>Poor appetite</li><li>T: Pale</li></ul></td><td><ul><li>Loose stools</li><li>C: Thin white</li><li>P: Weak</li></ul></td></tr></table>', true)}
${trig('<strong>TREATS</strong>', '<table><tr><td><ul><li><a href="../conditions/Fatigue.html">Chronic fatigue</a></li></ul></td></tr></table>', true)}
${trig('<strong>CONTRAINDICATIONS AND HERB/DRUG INTERACTIONS</strong>', '<table><tr><td align="center" class="leftcollevel3"><strong>CONTRAINDICATIONS</strong></td></tr><tr><td><ul><li>Not for Excess Heat.</li></ul></td></tr><tr><td align="center"><strong>HERB/DRUG INTERACTIONS </strong></td></tr><tr><td><ul><li></li></ul></td></tr></table>', true)}
${trig('<strong>NOTES</strong>', '<ul><li>A formula note.</li></ul>', true)}
</div></body></html>`;

const PROTOCOL_PAGE = `<html><head><title>Sore Throat Gargle #2</title></head><body><h1>HERB FORMULAS</h1><div class="p7AB">
${trig('<strong>SORE THROAT GARGLE #2</strong>', '<table><tr><td><strong>English:</strong></td><td></td></tr></table>', true)}
${trig('<strong>HERBS AND ACTIONS</strong>', '<table><tr><td>Pharmaceutical Latin</td><td>Pin Yin</td><td>Dosage</td><td>Actions</td></tr><tr><td>Rx. Alpha</td><td>Jia Yi</td><td>9g</td><td>x</td></tr></table>', true)}
</div></body></html>`;

const POINT_PAGE = `<html><head><title>ST-99 Test Point</title></head><body><div id="mainbox"><h1>POINT: ST-99 (STOMACH-99) &nbsp;</h1><div class="p7AB">
${trig('NAME:<em> CESHIXUE </em>', '<table><tr><td><strong>English:</strong></td><td>Test Point </td></tr><tr><td><strong>Also Known As:</strong></td><td>Trial Hole</td></tr></table>')}
${trig('LOCATION:', '<ul><li>Below the knee, 3 <em>cun </em>inferior to ST-35 <em><a href="ST-35.html">Dubi</a></em>, one finger breadth lateral to the tibia.</li></ul>')}
${trig('NEEDLING:', '<ul><li>Perpendicular insertion 1 to 1.5 <em>cun.</em></li></ul>')}
${trig('COMMAND FUNCTIONS: ', '<ul><li><em>He-</em>Sea point of the Stomach channel </li></ul>')}
${trig('ACTIONS: ', '<ul><li>Harmonizes the Spleen and Stomach </li><li>Tonifies <em>Qi</em></li></ul>')}
${trig('INDICATIONS: ', '<table><tr><td><ul><li>Epigastric pain</li></ul></td><td><ul><li>Fatigue</li></ul></td></tr></table>')}
${trig('COMBINATIONS:', '<table><tr><td>REN-12<br>Zhongwan</td><td>SP-6<br>Sanyinjiao<br>PC-6<br>Neiguan</td></tr><tr><td>Epigastric pain</td><td>Nausea</td></tr></table>')}
${trig('CONTRAINDICATIONS:', '<ul><li>Forbidden in the eighth month of pregnancy.</li></ul>')}
${trig('NOTES:', '<ul><li>A point note.</li></ul>')}
</div></div></body></html>`;

const EXTRA_POINT_PAGE = POINT_PAGE.replace('POINT: ST-99 (STOMACH-99)', 'POINT: N-HN-99');

describe('the little HTML', () => {
  it('decodes entities and folds whitespace', () => {
    expect(textOf('A &amp; B &#27979; <br> C')).toBe('A & B 测 C');
    expect(linesOf('one<br>two<p>three</p>')).toEqual(['one', 'two', 'three']);
  });
  it('reads the accordion, whether or not the anchor is wrapped in <strong>', () => {
    expect(accordionSections(HERB_PAGE).map((section) => section.title.split(':')[0])).toEqual([
      'NAME',
      'CATEGORY',
      'PROPERTIES',
      'ACTIONS AND INDICATIONS',
      'CONTRAINDICATIONS, INCOMPATIBILITIES AND HERB/DRUG INTERACTIONS',
      'MAJOR COMBINATIONS',
      'NOTES',
    ]);
    expect(accordionSections(FORMULA_PAGE)[0].title).toContain('CE SHI TANG');
    expect(tables(accordionSections(HERB_PAGE)[2].html)[0]).toHaveLength(2);
  });
});

describe('an American Dragon herb page', () => {
  const herb = parseDragonHerb(
    HERB_PAGE,
    'https://www.americandragon.com/Individualherbsupdate/CeShiCao.html',
  )!;
  it('reads the names', () => {
    expect(herb.pinyin).toBe('Ce Shi Cao');
    expect(herb.chinese).toBe('测试草');
    expect(herb.pharmaceutical).toBe('Herba Probationis');
    expect(herb.english).toEqual(['Test Grass', 'Trial Herb']);
  });
  it('reads the properties table by its headers', () => {
    expect(herb.categoryRaw).toBe('Herbs that Tonify Qi');
    expect(herb.tastesRaw).toEqual(['Sweet', 'Bitter']);
    expect(herb.temperatureRaw).toBe('Slightly Warm');
    expect(herb.channelsRaw).toEqual(['Spleen', 'Lung']);
    expect(herb.doses).toEqual([
      { min: 6, max: 15, unit: 'g', raw: '6-15g', source: 'americandragon' },
      { min: 2, max: 4, unit: 'ml', raw: 'Tincture: 2-4ml', source: 'americandragon' },
    ]);
  });
  it('pairs each action with what it is used for', () => {
    expect(herb.actions).toEqual([
      {
        text: 'Tonifies the Spleen Qi',
        lang: 'en',
        source: 'americandragon',
        indications: ['Fatigue with poor appetite', 'Loose stools from Spleen Qi Deficiency'],
      },
      {
        text: 'Raises the Yang',
        lang: 'en',
        source: 'americandragon',
        indications: ['Prolapse of the rectum'],
      },
    ]);
  });
  it('separates contraindications, incompatibilities and interactions, and drops empty items', () => {
    expect(herb.contraindications.map((fact) => fact.text)).toEqual([
      'Contraindicated in Excess patterns.',
      'Use with caution in pregnancy.',
    ]);
    expect(herb.incompatibilities.map((fact) => fact.text)).toEqual([
      'Counteracts Rx. Exempli Li Zi Gen',
    ]);
    expect(herb.interactions).toEqual([]);
  });
  it('reads combinations as herb names and what the pair is for, skipping the Latin lines', () => {
    expect(herb.combinations).toEqual([
      { with: ['Jia Yi'], for: 'Fatigue from Qi Deficiency.' },
      { with: ['Bing Ding', 'Wu Ji'], for: 'Edema with Spleen Deficiency.' },
    ]);
    expect(herb.notes.map((fact) => fact.text)).toEqual(['A note about the herb.']);
  });
});

describe('an American Dragon formula page', () => {
  const formula = parseDragonFormula(FORMULA_PAGE, 'u')!;
  it('reads the names and the ingredient table', () => {
    expect(formula.pinyin).toBe('Ce Shi Tang');
    expect(formula.chinese).toBe('测试汤');
    expect(formula.english).toEqual(['Trial Decoction', 'Test Combination']);
    expect(formula.ingredients).toEqual([
      {
        pinyin: 'Jia Yi',
        latin: 'Rx. Alpha',
        doseMin: 6,
        doseMax: 9,
        note: null,
        actions: 'Tonifies Qi.',
        source: 'americandragon',
      },
      {
        pinyin: 'Bing Ding',
        latin: 'Rx. Beta',
        doseMin: 3,
        doseMax: 3,
        note: null,
        actions: 'Harmonizes.',
        source: 'americandragon',
      },
    ]);
  });
  it('reads actions, syndromes, manifestations with tongue and pulse, treats, cautions', () => {
    expect(formula.actions.map((fact) => fact.text)).toEqual([
      'Tonifies Qi',
      'Harmonizes the Middle',
    ]);
    expect(formula.syndromes.map((fact) => fact.text)).toEqual(['Spleen Qi Deficiency']);
    expect(formula.indications.map((fact) => fact.text)).toEqual([
      'Fatigue',
      'Poor appetite',
      'Loose stools',
    ]);
    expect(formula.tongue?.text).toBe('tongue: Pale; coating: Thin white');
    expect(formula.pulse?.text).toBe('Weak');
    expect(formula.treats).toEqual(['Chronic fatigue']);
    expect(formula.contraindications.map((fact) => fact.text)).toEqual(['Not for Excess Heat.']);
    expect(formula.notes.map((fact) => fact.text)).toEqual(['A formula note.']);
  });
  it('gives a protocol page no pinyin name, so it stays out of the catalogue', () => {
    expect(parseDragonFormula(PROTOCOL_PAGE, 'u')?.pinyin).toBeNull();
  });
});

describe('an American Dragon point page', () => {
  const point = parseDragonPoint(POINT_PAGE, 'u')!;
  it('reads the code into our form and the names', () => {
    expect(point.code).toBe('ST99');
    expect(point.codeRaw).toBe('ST-99');
    expect(point.pinyin).toBe('Ceshixue');
    expect(point.english).toEqual(['Test Point', 'Trial Hole']);
  });
  it('reads each list', () => {
    expect(point.location[0].text).toContain('3 cun inferior to ST-35 Dubi');
    expect(point.needling.map((fact) => fact.text)).toEqual([
      'Perpendicular insertion 1 to 1.5 cun.',
    ]);
    expect(point.commandFunctions.map((fact) => fact.text)).toEqual([
      'He-Sea point of the Stomach channel',
    ]);
    expect(point.actions.map((fact) => fact.text)).toEqual([
      'Harmonizes the Spleen and Stomach',
      'Tonifies Qi',
    ]);
    expect(point.indications.map((fact) => fact.text)).toEqual(['Epigastric pain', 'Fatigue']);
    expect(point.combinations).toEqual([
      { with: ['REN12'], for: 'Epigastric pain' },
      { with: ['SP6', 'PC6'], for: 'Nausea' },
    ]);
    expect(point.contraindications.map((fact) => fact.text)).toEqual([
      'Forbidden in the eighth month of pregnancy.',
    ]);
  });
  it('keeps an extra point with no code of ours', () => {
    const extra = parseDragonPoint(EXTRA_POINT_PAGE, 'u')!;
    expect(extra.code).toBeNull();
    expect(extra.codeRaw).toBe('N-HN-99');
  });
});

const BARA_HERB = {
  url: 'https://barapro.co.il/indexes/x/ce-shi-cao/',
  listName: 'Ce Shi Cao (אסור לשימוש), Probatio sinensis, צמח בדיקה',
  hebrew: 'צמח בדיקה',
  latin: 'Ce Shi Cao',
  modes: ['pinYanName'],
  text: `\nCE SHI CAO\n\nקליגרפיה: 测试草\n\nקבוצה טיפולית: מחזקי צ'י\n\nשם בוטני: Probationis Herba\n\nשם עברי: צמח בדיקה\nשם עממי: Test Grass\n\nחלק בשימוש: עלה\n\nמקור בספרות הקלסית: מוזכר לראשונה בספר הבדיקות\n\nטעמים: מתוק, מר\nטמפרטורה: מעט חמים\nאיברים: SP/LU\n\nהצמח אינו מאושר בארץ על פי הנחיות משרד הבריאות (ראו תחליפים בהמשך)\n\nתפקודים עיקריים:\n• מחזק את צ'י הטחול: עייפות, חוסר תיאבון\n• מעלה יאנג: צניחות איברים\n• משתן\n\nמינון יומי מומלץ: 15-6 גר'\n\nהתוויות נגד:\n\nעודף בחיצון\nהיריון: מתאים לשימוש\nהנקה: מתאים לשימוש\n\nתחליפים אפשריים:\n• לחיזוק: dang shen, tai zi shen\n\nמשתתף בפורמולות:\n\nCe Shi Tang\n\nלקריאה של המונוגרף המערבי על הצמח - לחץ כאן`,
};

const BARA_WESTERN = {
  url: 'https://barapro.co.il/indexes/x/probatio-vulgaris/',
  listName: 'Probatio vulgaris, בדיקה מצויה',
  hebrew: 'בדיקה מצויה',
  latin: 'Probatio vulgaris',
  modes: ['botanicalName', 'hebrewName'],
  text: `משפחה: Testaceae - בדיקתיים\nשמות משלימים: Common Test\nחלק בשימוש: עלווה - Herba\n\nתכונות רפואיות עיקריות:\n\nAstringent - מכווץ.\nFebrifuge- מוריד חום.\n\nהתוויות ושימושים רפואיים עיקריים:\n\nשפעת ומחלות חום.\nמערכת עיכול: אובדן תיאבון.\n\nאנרגטיקה:\nמר, מכווץ, מקרר.\n\nהתוויות נגד:\n\nאלרגיה למשפחת הבדיקתיים.\nהריון: מוטב להימנע.\n\nמינון מומלץ:\nטינקטורה (1:3): 4-9 מ"ל ליום.\nצמח יבש: 3-6 גרם ליום.\n\nתחליפים:\n\nפטל אדום | Rubus idaeus\n\nעלי הפטל האדום היו בשימוש של הרפואה המסורתית במקומות שונים בעולם, לטיפול במגוון של מצבים המיוחסים למערכת הרבייה הנשית ובכלל.`,
};

describe('a Bara herb record', () => {
  const herb = parseBaraHerb(BARA_HERB)!;
  it('reads the blocks by their labels, and drops the regulatory remark that follows them', () => {
    const blocks = blocksOf(BARA_HERB.text);
    expect(blocks.channels).toEqual(['SP/LU']);
    // "not approved in Israel" is the source's own regulatory position; the
    // catalogue does not carry it, so it never becomes a note.
    expect(blocks.remarks).toBeUndefined();
    expect(blocks.formulas).toEqual(['Ce Shi Tang']);
  });
  it('reads the names, the group, the properties and the dose', () => {
    expect(herb.pinyin).toBe('Ce Shi Cao');
    expect(herb.kind).toBe('chinese');
    expect(herb.chinese).toBe('测试草');
    expect(herb.pharmaceutical).toBe('Probationis Herba');
    expect(herb.botanical).toBe('Probatio sinensis');
    expect(herb.hebrew).toEqual(['צמח בדיקה']);
    expect(herb.english).toEqual(['Test Grass']);
    expect(herb.categoryRaw).toBe("מחזקי צ'י");
    expect(herb.temperatureRaw).toBe('מעט חמים');
    expect(herb.tastesRaw).toEqual(['מתוק, מר']);
    expect(herb.channelsRaw).toEqual(['SP/LU']);
    expect(herb.partUsed).toBe('עלה');
    expect(herb.classicalSource).toBe('מוזכר לראשונה בספר הבדיקות');
    expect(herb.doses).toEqual([{ min: 6, max: 15, unit: 'g', raw: "15-6 גר'", source: 'bara' }]);
  });
  it('splits each function line into the action and what it is used for', () => {
    expect(herb.actions).toEqual([
      {
        text: "מחזק את צ'י הטחול",
        lang: 'he',
        source: 'bara',
        indications: ['עייפות', 'חוסר תיאבון'],
      },
      { text: 'מעלה יאנג', lang: 'he', source: 'bara', indications: ['צניחות איברים'] },
      { text: 'משתן', lang: 'he', source: 'bara', indications: [] },
    ]);
  });
  it('reads cautions, pregnancy, breastfeeding and substitutes, and keeps the regulatory line out of the notes', () => {
    expect(herb.contraindications.map((fact) => fact.text)).toEqual(['עודף בחיצון']);
    expect(herb.pregnancy?.text).toBe('מתאים לשימוש');
    expect(herb.lactation?.text).toBe('מתאים לשימוש');
    expect(herb.substitutes).toEqual(['לחיזוק: dang shen, tai zi shen']);
    // The flag records what the source said, for whoever reads a fact sheet.
    // Nothing downstream reads it, and no note repeats it.
    expect(herb.restrictedInIsrael).toBe(true);
    expect(herb.notes).toEqual([]);
  });
  it('reads a Western monograph as a Western herb with its energetics and two doses', () => {
    const western = parseBaraHerb(BARA_WESTERN)!;
    expect(western.kind).toBe('western');
    expect(western.pinyin).toBeNull();
    expect(western.botanical).toBe('Probatio vulgaris');
    expect(western.family).toBe('Testaceae - בדיקתיים');
    expect(western.english).toEqual(['Common Test']);
    expect(western.actions.map((fact) => fact.text)).toEqual([
      'Astringent - מכווץ.',
      'Febrifuge- מוריד חום.',
    ]);
    expect(western.indications.map((fact) => fact.text)).toEqual([
      'שפעת ומחלות חום.',
      'מערכת עיכול: אובדן תיאבון.',
    ]);
    expect(western.temperatureRaw).toBe('מר, מכווץ, מקרר.');
    expect(western.doses).toEqual([
      { min: 3, max: 6, unit: 'g', raw: 'dry: 3-6 גרם ליום.', source: 'bara' },
      { min: 4, max: 9, unit: 'ml', raw: 'tincture: 3): 4-9 מ"ל ליום.', source: 'bara' },
    ]);
    expect(western.substitutes).toEqual(['פטל אדום | Rubus idaeus']);
  });
});

const BARA_FORMULA = {
  url: 'https://barapro.co.il/indexes/formulas/ce-shi-tang/',
  name: 'CE SHI TANG | 测试汤',
  sections: {
    'אודות הפורמולה': {
      text: "קיימת כמוצר מדף בתמצית מבושלת.\n\nפעילות: חיזוק צ'י והרמוניה של המחמם האמצעי.",
    },
    'יתרונות הפורמולה': {
      text: "פירוש השם: מרתח הבדיקה.\n\nקבוצה טיפולית: מחזקות צ'י.\n\nדיון בפורמולה: הפורמולה משלבת שני צמחים.\n\nתמונה קלינית: עייפות, חוסר תיאבון, צואה רכה. באבחנה מתאימה אפשר להשתמש במחלות כגון: עייפות כרונית, אנמיה.\n\nלשון: חיוורת.\n\nדופק: חלש.",
    },
    הערות: {
      text: 'הערת מינון: המינון לילדים מחצית.\nהתוויות נגד: זהירות בחום מעודף.\nאבחנה סינית:Qi Def.',
    },
  },
  ingredients: [
    { name: 'Jia Yi', href: '/x', form: '', dose: '9' },
    { name: 'Bing Ding', href: '/y', form: 'TR', dose: '3' },
    { name: '', dose: '' },
  ],
};

describe('a Bara formula record', () => {
  const formula = parseBaraFormula(BARA_FORMULA)!;
  it('reads the names, the group, the ingredients with their doses', () => {
    expect(formula.pinyin).toBe('Ce Shi Tang');
    expect(formula.chinese).toBe('测试汤');
    expect(formula.categoryRaw).toBe("מחזקות צ'י.");
    expect(formula.ingredients).toEqual([
      {
        pinyin: 'Jia Yi',
        latin: null,
        doseMin: 9,
        doseMax: 9,
        note: null,
        actions: null,
        source: 'bara',
      },
      {
        pinyin: 'Bing Ding',
        latin: null,
        doseMin: 3,
        doseMax: 3,
        note: 'TR',
        actions: null,
        source: 'bara',
      },
    ]);
  });
  it('reads the labelled lines inside the prose sections', () => {
    expect(formula.actions.map((fact) => fact.text)).toEqual([
      "חיזוק צ'י והרמוניה של המחמם האמצעי.",
    ]);
    expect(formula.nameMeaning?.text).toBe('מרתח הבדיקה.');
    expect(formula.indications.map((fact) => fact.text)).toEqual([
      'עייפות, חוסר תיאבון, צואה רכה.',
    ]);
    expect(formula.treats).toEqual(['עייפות כרונית', 'אנמיה']);
    expect(formula.tongue?.text).toBe('חיוורת.');
    expect(formula.pulse?.text).toBe('חלש.');
    expect(formula.contraindications.map((fact) => fact.text)).toEqual(['זהירות בחום מעודף.']);
    expect(formula.syndromes.map((fact) => fact.text)).toEqual(['Qi Def.']);
    expect(formula.notes.map((fact) => fact.text)).toEqual([
      'המינון לילדים מחצית.',
      'הפורמולה משלבת שני צמחים.',
    ]);
  });
});

describe('merging the two sources', () => {
  it('puts Bara first and keeps American Dragon where Bara is silent, noting disagreements', () => {
    const bara = parseBaraHerb(BARA_HERB)!;
    const dragon = parseDragonHerb(HERB_PAGE, 'u')!;
    const sheet = mergeHerb(bara, dragon)!;
    expect(sheet.key).toBe('ceshicao');
    expect(sheet.category).toBe('tonify_qi');
    expect(sheet.temperature).toBe('slightly_warm');
    expect(sheet.tastes).toEqual(['sweet', 'bitter']);
    expect(sheet.channels).toEqual(['lung', 'spleen']);
    expect(sheet.dose).toEqual({ min: 6, max: 15, unit: 'g', raw: "15-6 גר'", source: 'bara' });
    expect(sheet.hebrew).toBe('צמח בדיקה');
    expect(sheet.english).toBe('Test Grass');
    expect(sheet.pharmaceutical).toBe('Herba Probationis');
    expect(sheet.actions).toHaveLength(5);
    expect(sheet.restrictedInIsrael).toBe(true);
    expect(sheet.sources.map((source) => source.name)).toEqual(['bara', 'americandragon']);
    expect(sheet.disagreements).toEqual([]);
  });
  it('records a disagreement on temperature rather than deciding silently', () => {
    const bara = parseBaraHerb({ ...BARA_HERB, text: BARA_HERB.text.replace('מעט חמים', 'קר') })!;
    const dragon = parseDragonHerb(HERB_PAGE, 'u')!;
    const sheet = mergeHerb(bara, dragon)!;
    expect(sheet.temperature).toBe('cold');
    expect(sheet.disagreements[0]).toMatch(
      /^temperature: bara "קר" → cold; americandragon "Slightly Warm" → slightly_warm$/,
    );
  });
  it("takes Bara's ingredients for a formula and lists what only the other source has", () => {
    const bara = parseBaraFormula(BARA_FORMULA)!;
    const dragon = parseDragonFormula(FORMULA_PAGE, 'u')!;
    const sheet = mergeFormula(bara, dragon)!;
    expect(sheet.ingredientsFrom).toBe('bara');
    expect(sheet.ingredients.map((item) => item.pinyin)).toEqual(['Jia Yi', 'Bing Ding']);
    expect(sheet.category).toBe('tonify');
    expect(sheet.categoryInferred).toBe(false);
    expect(sheet.disagreements).toEqual([]);
    const dragonOnly = mergeFormula(null, dragon)!;
    expect(dragonOnly.category).toBe('tonify');
    expect(dragonOnly.categoryInferred).toBe(true);
    expect(dragonOnly.ingredientsFrom).toBe('americandragon');
  });
});
