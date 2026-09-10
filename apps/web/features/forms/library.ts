import type { FormTemplateValues } from '@clinic/domain';

/**
 * Ready-made questionnaires a clinic can add with one click.
 *
 * A practitioner used to keep intake forms on a form service and copy the
 * answers over by hand. These are the same forms as records the app itself
 * holds: every submission is tied to the patient and lands in their file
 * under documents, and the questions can be edited afterwards like any
 * other form. Add one here rather than typing seventy questions again.
 *
 * Field ids are stable, hand-chosen names — answers are keyed by them, and
 * a form edited later must keep them for the old answers to stay readable.
 */
export interface LibraryEntry {
  key: string;
  title: string;
  description: string;
  template: FormTemplateValues;
}

const YES_NO = 'yes_no' as const;

function q(id: string, label: string, extra: Partial<FormTemplateValues['fields'][number]> = {}) {
  return { id, type: 'short_text' as const, label, required: false, options: [], ...extra };
}
function yn(id: string, label: string, extra: Partial<FormTemplateValues['fields'][number]> = {}) {
  return { id, type: YES_NO, label, required: false, options: [], ...extra };
}
function long(
  id: string,
  label: string,
  extra: Partial<FormTemplateValues['fields'][number]> = {},
) {
  return { id, type: 'long_text' as const, label, required: false, options: [], ...extra };
}
function choice(
  id: string,
  label: string,
  options: string[],
  extra: Partial<FormTemplateValues['fields'][number]> = {},
) {
  return { id, type: 'single_choice' as const, label, required: false, options, ...extra };
}
function multi(
  id: string,
  label: string,
  options: string[],
  extra: Partial<FormTemplateValues['fields'][number]> = {},
) {
  return { id, type: 'multi_choice' as const, label, required: false, options, ...extra };
}
function section(id: string, label: string, help = '') {
  return { id, type: 'section' as const, label, help, required: false, options: [] };
}

const ERECTION_SCALE = [
  'אין זקפה בכלל',
  '2-3',
  '4 - זקפה רכה שלא מספיקה לחדירה',
  '5 - זקפה רכה שכן מספיקה לחדירה',
  '6',
  '7 - זקפה בינונית',
  '8-9 - זקפה חזקה כמעט מלאה',
  '10 - זקפה חזקה ומלאה',
];

const HEALTH_DECLARATION = [
  'הנני מאשר שאני מודע לכך שהטיפול המבוקש על ידי אינו מהווה תחליף לכל טיפול רפואי/תרופתי ברפואה קונבנציונלית ו/או לכל התייעצות עם רופא, ואי פנייה שלי לכזה הינה על פי החלטתי הבלעדית ואחריותי בלבד.',
  'ידוע לי כי כל שינוי מהמלצות אשר ניתנו לי על ידי רופא יעשו בתיאום איתו לרבות נטילת תרופות, בדיקות מעקב או כל המלצה אחרת.',
  'הנני מצהיר כי המידע שמסרתי בטופס זה הינו מלא ומדויק ואני מתחייב לעדכן בכל שינוי במצבי הבריאותי.',
  'הנני מצהיר כי אין מניעה ו/או הגבלה לכך שאקבל טיפול ברפואה סינית הכולל דיקור, צמחי מרפא, תוספי תזונה, משחות, טכניקות מגע, המלצות תזונתיות, טיפול בחום (מוקסה/FIR) ושיטות טיפול נוספות.',
].join('\n');

const TREATMENT_CLARIFICATION = [
  'הטיפול הניתן במרפאה מבוסס על עקרונות הרפואה הסינית ומתבצע באופן מקצועי, בטוח ואחראי.',
  'על סמך ניסיון קליני רחב, ברוב המקרים אין תופעות לוואי או תגובות אלרגיות לטיפול. עם זאת, לעיתים נדירות ייתכנו תגובות כגון אדמומיות, גרד, נפיחות או רגישות – בדומה לתגובה אפשרית לכל גירוי אחר בגוף.',
  'הטיפול נועד לתמוך בתהליכי הריפוי הטבעיים של הגוף, להקל על סימפטומים ולשפר את איכות החיים. עם זאת, תגובת הגוף לטיפול היא אישית, ולכן מידת ההטבה ועיתויה עשויים להשתנות מאדם לאדם.',
  'הטיפול הוא תהליך – שדורש זמן, סבלנות, התמדה ושיתוף פעולה על מנת להגיע לתוצאות מיטביות. כמו בכל תהליך טיפולי, קיימים הבדלים אישיים בתגובה ובקצב השיפור, ולכן אין דרך לחזות מראש כיצד בדיוק הגוף יגיב לטיפול.',
  'במקרים מסוימים, שאינם ניתנים להגדרה או לצפייה מראש, ייתכן מצב שבו לא יחול שיפור משמעותי או שיפור כלל ובעקבות זאת תישקל הפסקת הטיפול.',
  'נמסר לי הסבר ברור לגבי מהות הטיפול, אופן פעולתו, הסיכויים לשיפור והסיכונים האפשריים, ואני מאשר כי הבנתי את הדברים במלואם. אני מסכים לקבל את הטיפול ומוותר על כל טענה או תביעה הנוגעת לכך.',
].join('\n');

const CANCELLATION_POLICY = [
  'מטופל יקר, אם יש צורך לשנות או לבטל טיפול – ניתן לעשות זאת עד 36 שעות לפני מועד התור.',
  'ביטול או שינוי שנעשה פחות מ-36 שעות לפני מועד התור יחויב במלוא סכום הטיפול.',
  'המדיניות נועדה לשמור על זמינות התורים ועל רצף טיפולי.',
].join('\n');

/** שאלון רפואי · בריאות הגבר — the intake used by a men's-health practice. */
const mensHealthIntake: FormTemplateValues = {
  title: 'שאלון רפואי · בריאות הגבר',
  description:
    'השאלון הבא נועד להעניק תמונה רחבה ומדויקת יותר של מצבך. אנא השב בכנות ובפירוט על השאלות הבאות.',
  is_active: true,
  fields: [
    section('s_personal', 'פרטים אישיים'),
    q('full_name', 'שם מלא', { required: true }),
    q('phone', 'טלפון', { required: true }),
    { id: 'birth_date', type: 'date', label: 'תאריך לידה', required: true, options: [] },
    { id: 'age', type: 'number', label: 'גיל', required: false, options: [] },
    q('national_id', 'תעודת זהות'),
    q('email', 'אימייל', { required: true, help: 'לאישורים ולתזכורות' }),
    q('city', 'עיר מגורים'),
    choice('marital_status', 'מצב משפחתי', ['רווק', 'נשוי', 'גרוש/פרוד', 'אלמן']),
    yn('has_partner', 'בת/בן זוג קבוע/ה'),

    section('s_general', 'שאלון רפואי כללי', 'סמן את המצבים הרפואיים שאובחנו אצלך.'),
    yn('diabetes', 'סכרת'),
    q('a1c', 'אם כן, מהו מדד ה-A1C האחרון שלך?'),
    choice('blood_pressure', 'לחץ דם', ['גבוה', 'נמוך', 'תקין']),
    yn('liver', 'מחלת כבד/הפטיטיס/צהבת'),
    yn('hiv', 'HIV'),
    yn('cancer', 'סרטן'),
    long('cancer_details', 'במידה וכן, אנא פרט בקצרה בנוגע לסוג הסרטן והטיפולים שעברת'),
    yn('pacemaker', 'קוצב לב'),
    yn('neuro', 'אפילפסיה/מיאסטניה גראביס/טרשת נפוצה'),
    yn('stroke', 'שבץ מוחי'),
    yn('kidney', 'מחלות כליה'),
    yn('ibd', 'קרוהן/קוליטיס'),
    yn('autoimmune', 'דלקת מפרקים שגרונית/זאבת/פסוריאזיס'),
    yn('lung', 'מחלות ריאה (COPD, אסתמה)'),
    yn('mental', 'הפרעות נפשיות'),
    yn('thyroid', 'הפרעות בבלוטת התריס'),
    yn('back', 'כאבי גב/בלט/פריצת דיסק'),
    long('other_conditions', 'משהו אחר שלא צוין שממנו אתה סובל?'),

    section('s_surgery', 'ניתוחים'),
    yn('surg_varicocele', 'ניתוח וריקוצלה (דליות בורידי האשך)'),
    yn('surg_bypass', 'ניתוח מעקפים/לב פתוח'),
    yn('surg_cath', 'צנתור לב/צנתור כליות'),
    yn('surg_prostate', 'ניתוח באיזור הערמונית (הסרה/אידוי/כל ניתוח אחר)'),
    yn('surg_hernia', 'ניתוח בקע מפשעתי/סרעפתי'),
    yn('surg_bariatric', 'ניתוח בריאטרי (קיצור קיבה, שרוול, מעקף)'),
    yn('surg_back', 'ניתוח גב'),
    long('surg_other', 'אחר'),

    section('s_lifestyle', 'אורח חיים'),
    yn('vegan', 'טבעוני/צמחוני'),
    yn('smoker', 'מעשן סיגריות?'),
    q('packs_per_day', 'אם כן, כמה חפיסות ביום?'),
    yn('alcohol', 'האם שותה אלכוהול באופן קבוע?'),
    yn('cannabis', 'האם מעשן קנאביס באופן קבוע?'),
    yn('other_drugs', 'האם משתמש בסמים אחרים?'),

    section('s_meds', 'תרופות'),
    yn('rx_regular', 'האם נוטל תרופות מרשם באופן קבוע?'),
    yn('rx_sleep', 'האם נוטל תרופות לשינה/איזון נפשי/שיכוך כאבים/צרבת?'),
    yn('hair_products', 'האם אתה משתמש או השתמש בעבר בכדורים/משחות/ספריי להצמחת שיער/מניעת נשירה?'),
    long('rx_details', 'פרט את התרופות אותן אתה לוקח באופן קבוע, כולל מינונים'),
    long('other_medical', 'האם אתה סובל מבעיה רפואית כלשהי שלא הוזכרה? אם כן, פרט'),
    yn(
      'details_correct',
      'כל הפרטים שציינתי בשאלון מעלה נכונים ולא ידוע לי על כל בעיה רפואית אחרת',
      { required: true },
    ),

    section('s_urology', 'תפקוד אורולוגי ומיני', 'השאלון הבא מתמקד בתחום האורולוגי ובתפקוד המיני.'),
    long('complaint', 'תיאור הבעיה בעקבותיה פנית לטיפול'),
    long('duration', 'כמה זמן אתה מתמודד עם הבעיה?'),
    multi('examined_by', 'האם נבדקת בהקשר לבעיה אצל אחד מהגורמים הבאים?', [
      'רופא משפחה',
      'אורולוג',
      'סקסולוג',
      'לא',
    ]),
    choice('libido', 'מה רמת החשק המיני?', ['נמוך', 'בינוני', 'גבוה']),
    choice(
      'erection_strength',
      "מהי עוצמת הזקפה בחודש האחרון מ-1 עד 10 (ללא כדורים או ג'לים כמו ויאגרה, סיאליס, קמאגרה, דבש וכו')",
      ERECTION_SCALE,
    ),
    choice(
      'erection_with_aid',
      "במידה ואתה משתמש בכדורים או ג'לים למיניהם (ויאגרה, סיאליס, קמאגרה, דבש וכו') - איך היית מתאר את עוצמת הזקפה במצב זה?",
      ERECTION_SCALE,
    ),
    choice('erection_onset', 'האם ההגעה לזקפה קלה ומהירה, או שלוקח זמן ונדרש גירוי ממושך?', [
      'מהירה',
      'לוקח זמן',
    ]),
    choice(
      'erection_loss',
      'אם אתה מרגיש היחלשות או התרככות בזקפה במהלך יחסי מין או לפני חדירה — האם זה קורה בכל פעם או מדי פעם',
      ['בכל פעם', 'לא קבוע - מדי פעם'],
    ),
    yn('also_masturbation', 'האם זה קורה גם באוננות?'),
    choice('confidence', 'מה רמת הביטחון שלך בכל הנוגע לקיום יחסי מין?', [
      'ירוד',
      'בינוני',
      'גבוה',
    ]),
    choice('morning_erections', 'האם יש לך זקפות בוקר?', [
      'בכלל לא',
      'מדי פעם',
      'קבוע (כמה פעמים בשבוע)',
    ]),

    section('s_prostate', 'ערמונית ודרכי השתן'),
    yn('bph', 'ערמונית מוגדלת? (מאובחנת)'),
    q('psa', 'אם כן, מה תוצאת PSA אחרונה?'),
    yn('prostate_procedure', 'האם עברת ניתוח או פרוצדורה כלשהי בערמונית?'),
    {
      id: 'nocturia',
      type: 'number',
      label: 'כמה פעמים אתה קם בלילה לתת שתן?',
      required: false,
      options: [],
    },
    multi('urinary_symptoms', 'סמן אם אתה סובל מכל אחד מהמצבים הבאים', [
      'צריבה במתן שתן',
      'בריחת שתן',
      'דם בשתן',
      'דחיפות במתן שתן',
      'תכיפות במתן שתן',
      'דלקות בדרכי השתן',
      'הפרשות מאיבר המין',
      'רגישות או כאב באיבר המין או באשכים',
      'קרי לילה',
      'חלומות אירוטיים',
      'וריקוצלה',
      'אבנים בכליות',
    ]),
    yn('fertility', 'האם אתה סובל כיום או סבלת בעבר מבעיות פוריות?'),

    section('s_health_declaration', 'הצהרת בריאות', HEALTH_DECLARATION),
    yn('health_declaration_agreed', 'קראתי את הצהרת הבריאות ואני מאשר אותה', { required: true }),

    section('s_treatment', 'הבהרה בנוגע לטיפול', TREATMENT_CLARIFICATION),
    yn('treatment_agreed', 'קראתי את ההבהרה בנוגע לטיפול ואני מאשר אותה', { required: true }),

    section('s_cancellation', 'מדיניות ביטולים', CANCELLATION_POLICY),
    yn('cancellation_agreed', 'אני מאשר כי קראתי והסכמתי למדיניות הביטולים', { required: true }),

    section(
      's_sign',
      'חתימה',
      'החתימה בסוף השאלון מאשרת את כל ההצהרות שלמעלה, בשמך ובתאריך המילוי.',
    ),
  ],
};

export const FORM_LIBRARY: LibraryEntry[] = [
  {
    key: 'mens-health-intake',
    title: mensHealthIntake.title,
    description:
      'שאלון קליטה מלא לבריאות הגבר: פרטים אישיים, רקע רפואי, ניתוחים, אורח חיים, תרופות, תפקוד אורולוגי ומיני, הצהרת בריאות והבהרה על הטיפול, מדיניות ביטולים וחתימה.',
    template: mensHealthIntake,
  },
];

export function libraryEntry(key: string): LibraryEntry | null {
  return FORM_LIBRARY.find((entry) => entry.key === key) ?? null;
}
