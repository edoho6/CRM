/**
 * A month of full days, and complete files, for the sandbox clinic.
 *
 * What the practice asked to see: the diary a month ahead with fourteen
 * patients on every working day (Sunday, Tuesday and Wednesday, 10:00 to
 * 20:00), in two treatment rooms so that a new patient can start every half
 * hour while the previous one still rests with the needles in; and every one
 * of those patients with a file filled all the way down — details, medical
 * history, tags, a history of visits with signed clinical notes, a formula
 * of their own, a set of points of their own, prescriptions, invoices and
 * payments, consents, a filled questionnaire (which also puts a document in
 * the file) and a task.
 *
 * Everything is fictional and deliberately unusable, the way the SQL seed's
 * rows are: emails end in .test, phones are 050-000xxxx (unallocated),
 * national ids fail the check digit. The guard is the same as well: the
 * clinic row must carry `is_synthetic`, or nothing is written. The script
 * signs in with the smoke account (apps/web/.env.test.local) and writes
 * through the API as that member, so every row passes the same policies the
 * application itself passes — and invoices, payments, prescriptions and
 * questionnaires go through the same triggers and functions.
 *
 * Usage:  node scripts/seed-sandbox-month.mjs [--dry-run] [--reset] [--patients=60] [--per-day=14]
 *   --reset   first removes what an earlier run of this script made (its
 *             patients carry a marker in their notes) — nothing else.
 *   --dry-run prints the plan and writes nothing.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { createClient } = createRequire(path.join(root, 'apps', 'web', 'package.json'))('@supabase/supabase-js');

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const reset = args.has('--reset');
const numberArg = (name, fallback) => Number([...args].find((a) => a.startsWith(`--${name}=`))?.split('=')[1] ?? fallback);
const PATIENTS = numberArg('patients', 60);
const PER_DAY = Math.min(19, numberArg('per-day', 14));
const PAST_PER_DAY = 8;
const MARKER = 'SEED-MONTH';
/** Sunday, Tuesday, Wednesday. */
const WORK_DAYS = [0, 2, 3];
const DAY_START = 10;
const DAY_END = 20;
const DAYS_AHEAD = 31;
const DAYS_BACK = 63;

function readEnv(file) {
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (match) out[match[1]] = match[2].replace(/^["']|["']$/g, '');
  }
  return out;
}
const env = { ...readEnv(path.join(root, 'apps/web/.env.local')), ...readEnv(path.join(root, 'apps/web/.env.test.local')) };
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const email = env.SMOKE_EMAIL;
const password = env.SMOKE_PASSWORD;
if (!url || !anonKey || !email || !password) {
  throw new Error('Needs NEXT_PUBLIC_SUPABASE_URL/ANON_KEY (apps/web/.env.local) and SMOKE_EMAIL/SMOKE_PASSWORD (apps/web/.env.test.local).');
}

/* ---- time, in the clinic's zone ------------------------------------------ */

function offsetMinutes(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(date);
  const get = (type) => Number(parts.find((p) => p.type === type).value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return (asUtc - date.getTime()) / 60000;
}
/** The instant of a wall-clock time in the zone. */
function zoned(y, m, d, h, min, timeZone) {
  const guess = new Date(Date.UTC(y, m - 1, d, h, min));
  const first = new Date(guess.getTime() - offsetMinutes(guess, timeZone) * 60000);
  return new Date(guess.getTime() - offsetMinutes(first, timeZone) * 60000);
}
/** 'YYYY-MM-DD' of an instant in the zone. */
function localDate(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
const addDays = (dateKey, n) => {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};
const weekdayOf = (dateKey) => {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
};
const pad = (n) => String(n).padStart(2, '0');

/* ---- the fictional practice ---------------------------------------------- */

const FIRST_F = ['נועה', 'מיכל', 'שירה', 'תמר', 'רונית', 'הדס', 'ליאת', 'מאיה', 'יעל', 'שני', 'טל', 'נטע', 'אביגיל', 'רותם', 'עדי', 'גלית', 'אורית', 'סיון', 'דנה', 'מור', 'ענבר', 'הילה', 'קרן', 'לירון', 'נוגה', 'אלה', 'יובל', 'שקד', 'רוני', 'אפרת'];
const FIRST_M = ['איתי', 'דניאל', 'יונתן', 'אורי', 'אבישי', 'גיא', 'עומר', 'ניר', 'אסף', 'רועי', 'אלון', 'עידו', 'תומר', 'מתן', 'יואב', 'אייל', 'נדב', 'אמיר', 'שחר', 'ליאור', 'עמית', 'בועז', 'דור', 'ארז', 'יאיר', 'גל', 'נועם', 'אלעד', 'רן', 'אביב'];
const LAST = ['לוי', 'כהן', 'מזרחי', 'פרץ', 'ביטון', 'אברהם', 'דהן', 'אזולאי', 'שרון', 'גבאי', 'אוחיון', 'חדד', 'נחום', 'ברקוביץ', 'שפירא', 'אלמוג', 'רוזן', 'בן דוד', 'טולדנו', 'אשכנזי', 'גולן', 'סבן', 'ירון', 'מלכה', 'פרידמן', 'קפלן', 'ברק', 'הראל', 'עמר', 'סויסה', 'לביא', 'שמש', 'אדרי', 'ניסים', 'בר', 'זוהר', 'מור', 'יוסף', 'קדוש', 'חיים'];
const CITIES = ['תל אביב-יפו', 'חיפה', 'ירושלים', 'באר שבע', 'רעננה', 'מודיעין', 'כפר סבא', 'נתניה', 'ראשון לציון', 'הרצליה', 'גבעתיים', 'רמת גן', 'פתח תקווה', 'חולון', 'הוד השרון', 'זכרון יעקב'];
const STREETS = ['הרצל', 'ויצמן', 'רוטשילד', 'הנשיא', 'בן גוריון', 'ז׳בוטינסקי', 'הגליל', 'השקד', 'הדקל', 'התמר', 'אלנבי', 'סוקולוב'];
const JOBS = ['מורה', 'מהנדסת תוכנה', 'נהג', 'אדריכלית', 'פיזיותרפיסט', 'גננת', 'רואה חשבון', 'עצמאי', 'אחות', 'סטודנטית', 'שף', 'גמלאי', 'עורכת דין', 'מעצב גרפי', 'חקלאי', 'מנהלת שיווק', 'צלם', 'מדריכת יוגה', 'טכנאי', 'רוקחת'];
const REFERRAL = ['המלצה מחבר', 'חיפוש באינטרנט', 'רופא משפחה', 'מטופל קיים', 'קופת חולים', 'עמוד הפייסבוק', 'אינסטגרם', 'הרצאה בקהילה'];

/**
 * Twenty presentations a herbal and acupuncture practice sees, each with the
 * findings, the points and the formula that go with it. A patient gets one,
 * and then their own variation of its points and its herbs, so no two files
 * carry the same prescription.
 */
const CASES = [
  { tag: 'כאבי גב', complaint: 'כאבי גב תחתון מזה שמונה חודשים, מחמירים בישיבה ממושכת ובבוקר', western: 'כאב גב תחתון מכני', pattern: 'חסימת ערוצים מקור ולחות עם חוסר Qi של הכליה', principle: 'לחמם את הערוצים, לפזר קור ולחות ולחזק את הכליה', tongue: ['חיוור', 'נפוחה עם סימני שיניים', 'חיפוי לבן דביק', 'יובש קל בקצה'], pulse: ['עמוק ואיטי', 'עמוק וחלש', ['עמוק', 'איטי'], 'חלש בעמדת הכליה משמאל'], points: ['BL23', 'BL40', 'GB30', 'GV4', 'KI3', 'BL25'], formula: ['Du Huo Ji Sheng Tang', 'דו הואו ג׳י שנג טאנג'], herbs: [['Du Huo', 9], ['Sang Ji Sheng', 15], ['Du Zhong', 12], ['Niu Xi', 9], ['Fang Feng', 6], ['Dang Gui', 9], ['Bai Shao', 9], ['Fu Ling', 9], ['Gan Cao', 3]], modalities: ['acupuncture', 'moxibustion'], recommendations: 'חימום מקומי בערב, הימנעות מישיבה מעל 45 דקות ברצף, תרגילי מתיחה לירך האחורית.', chronic: 'כאב גב כרוני; יתר לחץ דם קל, מאוזן', medications: 'אמלודיפין 5 מ״ג', allergies: 'ללא ידועות', surgeries: 'ניתוח מניסקוס בברך ימין (2019)', family: 'אב — מחלת לב כלילית; אם — סוכרת סוג 2', lifestyle: 'עבודה משרדית, ישיבה ממושכת; הליכה פעמיים בשבוע', task: 'לשלוח דף תרגילי מתיחה לגב התחתון' },
  { tag: 'מיגרנות', complaint: 'מיגרנות כפעמיים בשבוע, מלוות בבחילה ורגישות לאור', western: 'מיגרנה ללא אאורה', pattern: 'עליית Yang הכבד על רקע חוסר Yin', principle: 'להוריד Yang, להזין Yin ולהרגיע את הכבד', tongue: ['אדום בקצוות', 'דקה', 'חיפוי צהבהב דק', 'סדק אורכי במרכז'], pulse: ['מיתרי', 'מיתרי ודק', ['מיתרי'], 'מיתרי בעמדת הכבד'], points: ['GB20', 'LV3', 'LI4', 'GB41', 'Taiyang', 'GV20'], formula: ['Tian Ma Gou Teng Yin', 'טיאן מא גואו טנג יין'], herbs: [['Tian Ma', 9], ['Gou Teng', 12], ['Ju Hua', 9], ['Bai Shao', 12], ['Chuan Xiong', 6], ['Sang Ji Sheng', 12], ['Du Zhong', 9], ['Fu Ling', 9]], modalities: ['acupuncture'], recommendations: 'יומן כאבי ראש, שינה קבועה, הפחתת קפאין אחרי הצהריים.', chronic: 'מיגרנה מגיל 20', medications: 'ריזטריפטן לפי הצורך', allergies: 'פניצילין', surgeries: 'ללא', family: 'אם — מיגרנות', lifestyle: 'שינה לא סדירה, עבודה במשמרות', task: 'לבדוק אם יומן כאבי הראש מולא' },
  { tag: 'שינה', complaint: 'קשיי הירדמות ושינה קטועה מזה כשנה, עייפות בבוקר', western: 'נדודי שינה', pattern: 'חוסר דם של הלב והטחול', principle: 'להזין דם, לחזק את הטחול ולהרגיע את השן', tongue: ['חיוור', 'דקה', 'חיפוי לבן דק', ''], pulse: ['דק וחלש', 'דק', ['דק', 'חלש'], ''], points: ['HT7', 'SP6', 'Anmian', 'Yintang', 'PC6', 'KI6'], formula: ['Gui Pi Tang', 'גואי פי טאנג'], herbs: [['Huang Qi', 12], ['Dang Shen', 9], ['Bai Zhu', 9], ['Fu Ling', 9], ['Suan Zao Ren', 15], ['Long Yan Rou', 9], ['Yuan Zhi', 6], ['Dang Gui', 9], ['Gan Cao', 3]], modalities: ['acupuncture', 'moxibustion'], recommendations: 'כיבוי מסכים שעה לפני השינה, ארוחת ערב קלה, רגליים חמות.', chronic: 'ללא', medications: 'מלטונין 3 מ״ג לפי הצורך', allergies: 'ללא ידועות', surgeries: 'ללא', family: 'ללא ידוע', lifestyle: 'עבודה מול מסך עד מאוחר, קפה 4 כוסות ביום', task: 'לשאול על השינה אחרי שבועיים של הפורמולה' },
  { tag: 'עייפות', complaint: 'עייפות כרונית, תחושת כבדות בגפיים וירידה בריכוז', western: 'תסמונת עייפות כרונית — בבירור', pattern: 'חוסר Qi של הטחול עם לחות פנימית', principle: 'לחזק את הטחול, לייבש לחות ולהניע Qi', tongue: ['חיוור', 'נפוחה עם סימני שיניים', 'חיפוי לבן דביק', ''], pulse: ['חלקלק', 'חלש', ['חלקלק', 'חלש'], ''], points: ['ST36', 'SP9', 'CV12', 'SP3', 'BL20', 'CV6'], formula: ['Shen Ling Bai Zhu San', 'שן לינג באי ג׳ו סאן'], herbs: [['Dang Shen', 12], ['Bai Zhu', 9], ['Fu Ling', 12], ['Shan Yao', 12], ['Yi Yi Ren', 15], ['Sha Ren', 3], ['Chen Pi', 6], ['Gan Cao', 3]], modalities: ['acupuncture', 'moxibustion'], recommendations: 'ארוחת בוקר חמה, הימנעות ממאכלים קרים וגולמיים, הליכה קצרה אחרי הצהריים.', chronic: 'תת פעילות של בלוטת התריס', medications: 'לבותירוקסין 50 מק״ג', allergies: 'לקטוז', surgeries: 'ללא', family: 'אם — תת פעילות בלוטת התריס', lifestyle: 'שינה 6 שעות, ארוחות לא סדירות', task: 'לבקש תוצאות בדיקות דם עדכניות' },
  { tag: 'עיכול', complaint: 'נפיחות בטנית אחרי ארוחות, גזים ויציאות לא סדירות', western: 'תסמונת המעי הרגיז', pattern: 'סטגנציה של Qi הכבד שפולשת לטחול', principle: 'להניע את Qi הכבד ולחזק את הטחול', tongue: ['ורוד תקין', 'תקינה', 'חיפוי לבן דק', 'קצוות מעט אדומים'], pulse: ['מיתרי', 'מיתרי וחלש', ['מיתרי'], ''], points: ['LV3', 'ST36', 'CV12', 'ST25', 'SP6', 'PC6'], formula: ['Tong Xie Yao Fang', 'טונג שיה יאו פאנג'], herbs: [['Bai Zhu', 12], ['Bai Shao', 12], ['Chen Pi', 6], ['Fang Feng', 6], ['Chai Hu', 6], ['Fu Ling', 9], ['Mu Xiang', 6], ['Gan Cao', 3]], modalities: ['acupuncture', 'cupping'], recommendations: 'לאכול בישיבה ובנחת, להימנע מארוחות גדולות בערב, יומן תזונה שבועיים.', chronic: 'מעי רגיז מזה חמש שנים', medications: 'ללא', allergies: 'אגוזים', surgeries: 'כריתת תוספתן (2010)', family: 'ללא ידוע', lifestyle: 'לחץ בעבודה, אוכל בחוץ', task: 'לעבור על יומן התזונה לפני הביקור הבא' },
  { tag: 'מחזור', complaint: 'מחזור לא סדיר עם כאבים חזקים ביומיים הראשונים', western: 'דיסמנוריאה ראשונית', pattern: 'סטגנציה של Qi ודם ברחם', principle: 'להניע Qi ודם, לחמם את הרחם ולעצור כאב', tongue: ['סגלגל', 'תקינה', 'חיפוי לבן דק', 'נקודות סטגנציה בצדדים'], pulse: ['מיתרי', 'קשה', ['מיתרי', 'קשה'], ''], points: ['SP6', 'SP8', 'CV4', 'LV3', 'ST29', 'SP10'], formula: ['Shao Fu Zhu Yu Tang', 'שאו פו ג׳ו יו טאנג'], herbs: [['Dang Gui', 9], ['Chuan Xiong', 6], ['Chi Shao', 9], ['Yan Hu Suo', 9], ['Xiao Hui Xiang', 3], ['Rou Gui', 3], ['Pu Huang', 9], ['Wu Ling Zhi', 9]], modalities: ['acupuncture', 'moxibustion'], recommendations: 'חימום הבטן התחתונה בשבוע שלפני המחזור, הימנעות מקור ומשקאות קרים.', chronic: 'ללא', medications: 'איבופרופן בזמן המחזור', allergies: 'ללא ידועות', surgeries: 'ללא', family: 'אחות — אנדומטריוזיס', lifestyle: 'ספורט 3 פעמים בשבוע', task: 'לתאם ביקור בשבוע שלפני המחזור הבא' },
  { tag: 'חרדה', complaint: 'חרדה, לחץ בחזה ודפיקות לב בתקופות עומס', western: 'הפרעת חרדה כללית', pattern: 'סטגנציה של Qi הכבד עם חום שמטריד את הלב', principle: 'להניע את Qi הכבד, לנקות חום ולהרגיע את השן', tongue: ['אדום בקצה', 'דקה', 'חיפוי צהבהב דק', 'קצה אדום'], pulse: ['מיתרי ומהיר', 'מיתרי', ['מיתרי', 'מהיר'], ''], points: ['PC6', 'HT7', 'LV3', 'Yintang', 'CV17', 'GV24'], formula: ['Chai Hu Shu Gan San', 'צ׳אי הו שו גאן סאן'], herbs: [['Chai Hu', 9], ['Bai Shao', 12], ['Zhi Ke', 6], ['Xiang Fu', 9], ['Chuan Xiong', 6], ['Chen Pi', 6], ['Zhi Zi', 6], ['Gan Cao', 3]], modalities: ['acupuncture'], recommendations: 'נשימות בטן 5 דקות פעמיים ביום, הליכה בטבע, הפחתת קפאין.', chronic: 'ללא', medications: 'ללא', allergies: 'ללא ידועות', surgeries: 'ללא', family: 'אב — חרדה', lifestyle: 'עבודה תובענית, פעילות גופנית מועטה', task: 'לשלוח הקלטת תרגול נשימה' },
  { tag: 'צוואר וכתפיים', complaint: 'כאבי צוואר וכתפיים מעבודה מול מחשב, כאבי ראש מתח', western: 'כאב צווארי מכני', pattern: 'חסימת Qi ודם בערוצי הצוואר מרוח וקור', principle: 'לפזר רוח וקור, להניע Qi ודם בערוצים', tongue: ['ורוד תקין', 'תקינה', 'חיפוי לבן דק', ''], pulse: ['צף ומתוח', 'מיתרי', ['צף', 'מתוח'], ''], points: ['GB21', 'GB20', 'SI3', 'BL10', 'LI4', 'SI11'], formula: ['Ge Gen Tang', 'גה גן טאנג'], herbs: [['Ge Gen', 15], ['Gui Zhi', 6], ['Bai Shao', 9], ['Sheng Jiang', 3], ['Da Zao', 6], ['Qiang Huo', 6], ['Jiang Huang', 6], ['Gan Cao', 3]], modalities: ['acupuncture', 'cupping', 'tuina'], recommendations: 'הפסקה כל 40 דקות, גובה מסך בקו העיניים, כרית נמוכה יותר.', chronic: 'ללא', medications: 'ללא', allergies: 'אבקנים', surgeries: 'ללא', family: 'ללא ידוע', lifestyle: 'מפתחת, 9 שעות מול מסך', task: 'לבדוק את סידור עמדת העבודה' },
  { tag: 'אלרגיה', complaint: 'אלרגיה עונתית עם גודש באף, עיטושים ועיניים דומעות', western: 'נזלת אלרגית עונתית', pattern: 'חוסר Qi של הריאה עם חדירת רוח', principle: 'לחזק את הריאה, לייצב את פני השטח ולפזר רוח', tongue: ['חיוור', 'תקינה', 'חיפוי לבן דק', ''], pulse: ['צף', 'חלש', ['צף', 'חלש'], ''], points: ['LI20', 'Yintang', 'LI4', 'LU7', 'BL13', 'ST36'], formula: ['Yu Ping Feng San', 'יו פינג פנג סאן'], herbs: [['Huang Qi', 15], ['Bai Zhu', 9], ['Fang Feng', 6], ['Xin Yi Hua', 6], ['Cang Er Zi', 6], ['Bai Zhi', 6], ['Bo He', 3], ['Gan Cao', 3]], modalities: ['acupuncture', 'moxibustion'], recommendations: 'שטיפת אף במי מלח, להתחיל את הפורמולה חודש לפני העונה.', chronic: 'אסתמה קלה בילדות', medications: 'אנטיהיסטמין לפי הצורך', allergies: 'אבקנים, קרדית האבק', surgeries: 'ללא', family: 'אח — אסתמה', lifestyle: 'רץ בחוץ 3 פעמים בשבוע', task: 'להזכיר להתחיל את הפורמולה לפני האביב' },
  { tag: 'ברכיים', complaint: 'ברכיים כואבות בירידה במדרגות ובקימה מישיבה', western: 'אוסטאוארתריטיס של הברך', pattern: 'חוסר Qi ודם עם קור ולחות בברכיים', principle: 'להזין Qi ודם, לפזר קור ולחות ולחזק גידים ועצמות', tongue: ['חיוור', 'נפוחה', 'חיפוי לבן דביק', ''], pulse: ['עמוק וחלש', 'עמוק', ['עמוק', 'חלש'], ''], points: ['ST35', 'Xiyan', 'ST34', 'SP10', 'GB34', 'ST36'], formula: ['Shen Tong Zhu Yu Tang', 'שן טונג ג׳ו יו טאנג'], herbs: [['Qin Jiao', 9], ['Chuan Xiong', 6], ['Tao Ren', 9], ['Hong Hua', 6], ['Niu Xi', 9], ['Qiang Huo', 6], ['Dang Gui', 9], ['Wu Ling Zhi', 6], ['Gan Cao', 3]], modalities: ['acupuncture', 'moxibustion'], recommendations: 'חיזוק ארבע-ראשי בישיבה, שחייה, חימום הברכיים בחורף.', chronic: 'אוסטאוארתריטיס; עודף משקל', medications: 'גלוקוזאמין', allergies: 'ללא ידועות', surgeries: 'ללא', family: 'אם — דלקת מפרקים', lifestyle: 'גמלאית, הליכה יומית קצרה', task: 'להפנות לפיזיותרפיה לחיזוק הברך' },
  { tag: 'עור', complaint: 'יובש בעור ואקזמה בכפות הידיים, מחמירה בחורף', western: 'דרמטיטיס אטופית', pattern: 'חוסר דם עם יובש ורוח בעור', principle: 'להזין דם, ללחלח יובש ולהרגיע גירוד', tongue: ['חיוור', 'דקה', 'ללא חיפוי', 'יבשה'], pulse: ['דק', 'דק ומחוספס', ['דק'], ''], points: ['SP10', 'LI11', 'SP6', 'ST36', 'BL17', 'LI4'], formula: ['Dang Gui Yin Zi', 'דאנג גואי יין דזה'], herbs: [['Dang Gui', 9], ['Sheng Di Huang', 12], ['Bai Shao', 9], ['Chuan Xiong', 6], ['He Shou Wu', 9], ['Jing Jie', 6], ['Fang Feng', 6], ['Bai Ji Li', 9], ['Huang Qi', 9]], modalities: ['acupuncture'], recommendations: 'קרם לחות אחרי כל רחיצה, כפפות כותנה בלילה, להימנע ממים חמים מאוד.', chronic: 'אקזמה מילדות', medications: 'משחת סטרואידים לפי הצורך', allergies: 'ניקל', surgeries: 'ללא', family: 'אב — פסוריאזיס', lifestyle: 'עובדת עם חומרי ניקוי', task: 'לשלוח המלצות לטיפוח העור בחורף' },
  { tag: 'גיל המעבר', complaint: 'הזעות לילה, גלי חום והתעוררות בשעות הקטנות', western: 'תסמיני גיל המעבר', pattern: 'חוסר Yin של הכליה עם חום ריק', principle: 'להזין Yin, לנקות חום ריק ולהרגיע את השן', tongue: ['אדום', 'דקה', 'חיפוי דק מקולף', 'סדקים'], pulse: ['דק ומהיר', 'דק', ['דק', 'מהיר'], ''], points: ['KI3', 'KI6', 'SP6', 'HT6', 'CV4', 'BL23'], formula: ['Zhi Bai Di Huang Wan', 'ג׳ה באי די הואנג וואן'], herbs: [['Shu Di Huang', 15], ['Shan Zhu Yu', 9], ['Shan Yao', 12], ['Ze Xie', 6], ['Mu Dan Pi', 9], ['Fu Ling', 9], ['Zhi Mu', 9], ['Huang Bai', 6]], modalities: ['acupuncture'], recommendations: 'להימנע מאלכוהול ומאוכל חריף בערב, פיג׳מת כותנה, שתייה מספקת ביום.', chronic: 'אוסטאופניה', medications: 'ויטמין D, סידן', allergies: 'ללא ידועות', surgeries: 'ללא', family: 'אם — אוסטאופורוזיס', lifestyle: 'יוגה פעמיים בשבוע', task: 'לתאם מעקב אחרי חודש של הפורמולה' },
  { tag: 'פוריות', complaint: 'ניסיונות להריון מזה שנה, מחזור קצר ותסמונת קדם-וסתית', western: 'אי-פוריות ראשונית — בבירור', pattern: 'חוסר Yang של הכליה עם סטגנציה של Qi הכבד', principle: 'לחמם את הכליה, להניע את Qi הכבד ולווסת את המחזור', tongue: ['חיוור', 'נפוחה', 'חיפוי לבן', 'לח'], pulse: ['עמוק וחלש', 'מיתרי', ['עמוק', 'חלש'], 'חלש בעמדת הכליה'], points: ['CV4', 'KI3', 'SP6', 'ST36', 'LV3', 'Zigong'], formula: ['Wen Jing Tang', 'וון ג׳ינג טאנג'], herbs: [['Wu Zhu Yu', 3], ['Gui Zhi', 6], ['Dang Gui', 9], ['Chuan Xiong', 6], ['Bai Shao', 9], ['E Jiao', 6], ['Mai Men Dong', 9], ['Ban Xia', 6], ['Sheng Jiang', 3], ['Gan Cao', 3]], modalities: ['acupuncture', 'moxibustion'], recommendations: 'מעקב טמפרטורה בסיסית, שינה לפני 23:00, ארוחות חמות.', chronic: 'ללא', medications: 'חומצה פולית', allergies: 'ללא ידועות', surgeries: 'ללא', family: 'ללא ידוע', lifestyle: 'ריצה 4 פעמים בשבוע, דיאטה דלת שומן', task: 'לבקש תוצאות בדיקות הורמונים' },
  { tag: 'שחלות פוליציסטיות', complaint: 'מחזורים ארוכים ולא סדירים, אקנה ועלייה במשקל', western: 'תסמונת השחלות הפוליציסטיות', pattern: 'ליחה-לחות שחוסמת את הרחם עם חוסר Qi של הטחול', principle: 'להמיר ליחה, לייבש לחות, לחזק את הטחול ולווסת את המחזור', tongue: ['חיוור', 'נפוחה עם סימני שיניים', 'חיפוי לבן עבה ודביק', ''], pulse: ['חלקלק', 'חלקלק וחלש', ['חלקלק'], ''], points: ['SP6', 'ST40', 'CV3', 'ST28', 'SP9', 'ST36'], formula: ['Cang Fu Dao Tan Wan', 'צאנג פו דאו טאן וואן'], herbs: [['Cang Zhu', 9], ['Xiang Fu', 9], ['Chen Pi', 6], ['Ban Xia', 9], ['Fu Ling', 12], ['Dan Nan Xing', 6], ['Zhi Ke', 6], ['Shen Qu', 9], ['Gan Cao', 3]], modalities: ['acupuncture', 'moxibustion'], recommendations: 'הפחתת סוכרים פשוטים ומוצרי חלב, הליכה מהירה 30 דקות ביום.', chronic: 'תסמונת השחלות הפוליציסטיות; תנגודת לאינסולין', medications: 'מטפורמין 850 מ״ג', allergies: 'ללא ידועות', surgeries: 'ללא', family: 'אם — סוכרת סוג 2', lifestyle: 'עבודה משרדית, מעט פעילות', task: 'לבדוק סדירות המחזור אחרי חודשיים' },
  { tag: 'לחץ דם', complaint: 'לחץ דם גבולי, סחרחורת קלה וכאבי ראש בעורף', western: 'יתר לחץ דם שלב 1', pattern: 'עליית Yang הכבד עם ליחה', principle: 'להוריד Yang הכבד, להמיר ליחה ולהרגיע', tongue: ['אדום', 'תקינה', 'חיפוי צהבהב דביק', ''], pulse: ['מיתרי וחלקלק', 'מיתרי', ['מיתרי', 'חלקלק'], ''], points: ['LV3', 'GB20', 'ST40', 'LI11', 'KI1', 'GV20'], formula: ['Ban Xia Bai Zhu Tian Ma Tang', 'באן שיה באי ג׳ו טיאן מא טאנג'], herbs: [['Ban Xia', 9], ['Bai Zhu', 9], ['Tian Ma', 9], ['Chen Pi', 6], ['Fu Ling', 12], ['Gou Teng', 12], ['Ju Hua', 9], ['Gan Cao', 3]], modalities: ['acupuncture'], recommendations: 'מדידת לחץ דם בבוקר ובערב, הפחתת מלח, הליכה יומית.', chronic: 'יתר לחץ דם; כולסטרול גבוה', medications: 'רמיפריל 2.5 מ״ג, אטורבסטטין 10 מ״ג', allergies: 'ללא ידועות', surgeries: 'ללא', family: 'אב — שבץ מוחי', lifestyle: 'מעשן בעבר, מעט פעילות', task: 'לבקש יומן מדידות לחץ דם' },
  { tag: 'טנטון', complaint: 'צפצוף באוזן שמאל מזה חצי שנה, מחמיר בערב ובעייפות', western: 'טנטון סובייקטיבי', pattern: 'חוסר Yin של הכליה שאינו מזין את האוזן', principle: 'להזין Yin של הכליה ולפתוח את פתחי האוזן', tongue: ['אדום', 'דקה', 'חיפוי דק', 'סדקים'], pulse: ['דק', 'דק ומהיר', ['דק'], ''], points: ['TE17', 'GB2', 'SI19', 'KI3', 'TE3', 'GB43'], formula: ['Er Long Zuo Ci Wan', 'אר לונג דזואו צה וואן'], herbs: [['Shu Di Huang', 15], ['Shan Zhu Yu', 9], ['Shan Yao', 12], ['Fu Ling', 9], ['Mu Dan Pi', 9], ['Ze Xie', 6], ['Ci Shi', 15], ['Wu Wei Zi', 6], ['Shi Chang Pu', 6]], modalities: ['acupuncture'], recommendations: 'להימנע מרעש חזק, שינה מספקת, הפחתת מלח.', chronic: 'ללא', medications: 'ללא', allergies: 'ללא ידועות', surgeries: 'ללא', family: 'ללא ידוע', lifestyle: 'נגן בלהקה, חשיפה לרעש', task: 'להמליץ על בדיקת שמיעה' },
  { tag: 'סיאטיקה', complaint: 'כאב מקרין מהישבן לאורך הרגל השמאלית, נימול בכף הרגל', western: 'סיאטיקה', pattern: 'חסימת ערוץ שלפוחית השתן וכיס המרה מקור ולחות', principle: 'לפתוח את הערוצים, לפזר קור ולחות ולעצור כאב', tongue: ['חיוור', 'תקינה', 'חיפוי לבן', ''], pulse: ['מיתרי ומתוח', 'מיתרי', ['מיתרי'], ''], points: ['GB30', 'BL40', 'GB34', 'BL60', 'BL25', 'GB39'], formula: ['Shen Tong Zhu Yu Tang', 'שן טונג ג׳ו יו טאנג'], herbs: [['Qin Jiao', 9], ['Chuan Xiong', 9], ['Tao Ren', 9], ['Hong Hua', 6], ['Niu Xi', 12], ['Di Long', 9], ['Dang Gui', 9], ['Mo Yao', 6], ['Xiang Fu', 6]], modalities: ['acupuncture', 'cupping'], recommendations: 'הימנעות מהרמת משאות, שינה על הצד עם כרית בין הברכיים.', chronic: 'בלט דיסק L4-L5', medications: 'אטופן לפי הצורך', allergies: 'ללא ידועות', surgeries: 'ללא', family: 'ללא ידוע', lifestyle: 'נהג משאית', task: 'לבדוק אם הכאב המקרין נרגע' },
  { tag: 'צרבת', complaint: 'צרבת אחרי ארוחות, גיהוקים ותחושת מלאות', western: 'ריפלוקס קיבתי-ושטי', pattern: 'חום בקיבה עם Qi שעולה במקום לרדת', principle: 'לנקות חום מהקיבה, להוריד Qi מורד ולהרמוניה בין הכבד לקיבה', tongue: ['אדום', 'תקינה', 'חיפוי צהוב', ''], pulse: ['מיתרי ומהיר', 'חלקלק', ['מיתרי', 'מהיר'], ''], points: ['CV12', 'PC6', 'ST36', 'ST44', 'LV3', 'CV17'], formula: ['Zuo Jin Wan', 'דזואו ג׳ין וואן'], herbs: [['Huang Lian', 6], ['Wu Zhu Yu', 1.5], ['Hai Piao Xiao', 12], ['Zhe Bei Mu', 9], ['Bai Shao', 9], ['Chen Pi', 6], ['Zhi Ke', 6], ['Gan Cao', 3]], modalities: ['acupuncture'], recommendations: 'ארוחות קטנות, לא לשכב שעתיים אחרי אוכל, הרמת ראש המיטה.', chronic: 'ריפלוקס', medications: 'אומפרזול 20 מ״ג', allergies: 'ללא ידועות', surgeries: 'ללא', family: 'ללא ידוע', lifestyle: 'ארוחות ערב מאוחרות, קפה על בטן ריקה', task: 'לעבור על שינויי התזונה שהוסכמו' },
  { tag: 'מצב רוח', complaint: 'מצב רוח ירוד, חוסר חשק ועייפות בבוקר מזה כמה חודשים', western: 'דיכאון קל', pattern: 'סטגנציה של Qi הכבד עם חוסר Qi של הטחול והלב', principle: 'להניע את Qi הכבד, לחזק את הטחול ולהזין את הלב', tongue: ['חיוור', 'מעט נפוחה', 'חיפוי לבן דק', ''], pulse: ['מיתרי וחלש', 'חלש', ['מיתרי', 'חלש'], ''], points: ['GV20', 'Yintang', 'LV3', 'HT7', 'ST36', 'PC6'], formula: ['Xiao Yao San', 'שיאו יאו סאן'], herbs: [['Chai Hu', 9], ['Dang Gui', 9], ['Bai Shao', 9], ['Bai Zhu', 9], ['Fu Ling', 9], ['Bo He', 3], ['Sheng Jiang', 3], ['He Huan Pi', 12], ['Gan Cao', 3]], modalities: ['acupuncture'], recommendations: 'יציאה לאור יום בבוקר, פעילות גופנית מתונה, שיחה עם איש מקצוע במקביל.', chronic: 'ללא', medications: 'ללא', allergies: 'ללא ידועות', surgeries: 'ללא', family: 'אם — דיכאון', lifestyle: 'עובד מהבית, מעט מפגשים', task: 'לוודא שנקבע מפגש עם פסיכולוג' },
  { tag: 'נשימה', complaint: 'קוצר נשימה במאמץ ושיעול יבש שנותר אחרי מחלה ויראלית', western: 'תסמינים מתמשכים לאחר זיהום ויראלי', pattern: 'חוסר Qi ו-Yin של הריאה', principle: 'לחזק Qi הריאה, להזין Yin ולעצור שיעול', tongue: ['אדום', 'דקה', 'חיפוי דק', 'יובש'], pulse: ['דק וחלש', 'דק', ['דק', 'חלש'], ''], points: ['LU9', 'LU7', 'BL13', 'ST36', 'CV17', 'KI6'], formula: ['Sheng Mai San', 'שנג מאי סאן'], herbs: [['Dang Shen', 12], ['Mai Men Dong', 12], ['Wu Wei Zi', 6], ['Sha Shen', 9], ['Bai He', 12], ['Jie Geng', 6], ['Xing Ren', 6], ['Gan Cao', 3]], modalities: ['acupuncture', 'moxibustion'], recommendations: 'הליכה קלה בהדרגה, תרגילי נשימה, שתייה חמה.', chronic: 'ללא', medications: 'ללא', allergies: 'ללא ידועות', surgeries: 'ללא', family: 'ללא ידוע', lifestyle: 'רוכב אופניים, חזר בהדרגה', task: 'לשאול על השיעול והסיבולת בביקור הבא' },
];

const TAGS = [
  ['כאבי גב', 'amber'], ['מיגרנות', 'red'], ['שינה', 'sky'], ['עייפות', 'ink'], ['עיכול', 'jade'], ['מחזור', 'red'], ['חרדה', 'sky'],
  ['צוואר וכתפיים', 'amber'], ['אלרגיה', 'jade'], ['ברכיים', 'amber'], ['עור', 'ink'], ['גיל המעבר', 'red'], ['פוריות', 'jade'],
  ['שחלות פוליציסטיות', 'jade'], ['לחץ דם', 'red'], ['טנטון', 'ink'], ['סיאטיקה', 'amber'], ['צרבת', 'jade'], ['מצב רוח', 'sky'], ['נשימה', 'sky'],
  ['מעקב צמוד', 'red'], ['ותיק/ה', 'ink'], ['ספורטאי/ת', 'jade'],
];

const INTAKE_FIELDS = [
  { id: 'intro', type: 'section', label: 'שאלון קבלה', help: 'מסמך לדוגמה בסביבת הבדיקות. כל התשובות בדיוניות.', required: false, options: [], scale_min: 0, scale_max: 10 },
  { id: 'main_complaint', type: 'long_text', label: 'מה מביא אותך לטיפול?', required: true, options: [], scale_min: 0, scale_max: 10 },
  { id: 'duration', type: 'single_choice', label: 'מזה כמה זמן?', required: true, options: ['פחות מחודש', '1–6 חודשים', '6–12 חודשים', 'יותר משנה'], scale_min: 0, scale_max: 10 },
  { id: 'intensity', type: 'scale', label: 'עוצמת הכאב או המצוקה היום', required: true, options: [], scale_min: 0, scale_max: 10, scale_min_label: 'אין', scale_max_label: 'הכי חזק שיש' },
  { id: 'sleep', type: 'single_choice', label: 'איך השינה בדרך כלל?', required: false, options: ['טובה', 'סבירה', 'גרועה'], scale_min: 0, scale_max: 10 },
  { id: 'digestion', type: 'multi_choice', label: 'תלונות עיכול', required: false, options: ['נפיחות', 'צרבת', 'עצירות', 'שלשול', 'אין'], scale_min: 0, scale_max: 10 },
  { id: 'medications', type: 'short_text', label: 'תרופות קבועות', required: false, options: [], scale_min: 0, scale_max: 10 },
  { id: 'pregnancy', type: 'yes_no', label: 'הריון או תכנון הריון בתקופה הקרובה?', required: false, options: [], scale_min: 0, scale_max: 10 },
  { id: 'goals', type: 'long_text', label: 'מה היית רוצה להשיג בטיפול?', required: false, options: [], scale_min: 0, scale_max: 10 },
];
const DURATIONS = ['פחות מחודש', '1–6 חודשים', '6–12 חודשים', 'יותר משנה'];
const SLEEP = ['טובה', 'סבירה', 'גרועה'];
const DIGESTION = [['אין'], ['נפיחות'], ['צרבת', 'נפיחות'], ['עצירות'], ['אין'], ['שלשול']];
const GOALS = ['לישון טוב ולקום עם אנרגיה', 'לחזור לספורט בלי כאב', 'להפחית את התרופות בהסכמת הרופא', 'להרגיש רגוע יותר ביום-יום', 'להסדיר את המחזור', 'לנשום בקלות ולחזור לשגרה'];

/** An Israeli id that is guaranteed to fail its own check digit. */
function invalidNationalId(i) {
  const base = '9' + String(300000 + i).padStart(7, '0');
  let sum = 0;
  for (let k = 0; k < 8; k++) {
    let d = Number(base[k]) * (k % 2 === 0 ? 1 : 2);
    if (d > 9) d -= 9;
    sum += d;
  }
  const valid = (10 - (sum % 10)) % 10;
  return base + String((valid + 1) % 10);
}

const norm = (s) => String(s ?? '').toLowerCase().replace(/[^a-z]/g, '');

/* ---- main ---------------------------------------------------------------- */

async function main() {
  const sb = createClient(url, anonKey, { auth: { persistSession: false } });
  const { error: signInError } = await sb.auth.signInWithPassword({ email, password });
  if (signInError) throw new Error(`sign-in failed: ${signInError.message}`);
  const user = (await sb.auth.getUser()).data.user;
  const practitioner = user.id;

  const q = async (promise, what) => {
    const { data, error } = await promise;
    if (error) throw new Error(`${what}: ${error.message}${error.details ? ' — ' + error.details : ''}`);
    return data;
  };

  // The guard: one clinic, flagged as a sandbox.
  const clinics = await q(sb.from('clinics').select('id, name, is_synthetic, timezone'), 'clinics');
  if (clinics.length !== 1) throw new Error(`Expected one clinic for this account, found ${clinics.length}.`);
  const clinic = clinics[0];
  if (!clinic.is_synthetic) {
    throw new Error(`"${clinic.name}" is not flagged as a sandbox (clinics.is_synthetic). Refusing to write fictional patients into it.`);
  }
  const tz = clinic.timezone || 'Asia/Jerusalem';
  console.log(`Sandbox: ${clinic.name} (${tz}) · practitioner ${practitioner}`);

  // ---- what is already there ---------------------------------------------
  const seededBefore = await q(sb.from('patients').select('id').ilike('notes', `%${MARKER}%`), 'seeded patients');
  if (seededBefore.length && !reset) {
    throw new Error(`${seededBefore.length} patients from an earlier run are already there. Run with --reset to replace them.`);
  }
  if (seededBefore.length && reset && !dryRun) {
    const ids = seededBefore.map((p) => p.id);
    // Invoices restrict the patient delete; tasks would be left behind (set null).
    for (let k = 0; k < ids.length; k += 50) {
      const chunk = ids.slice(k, k + 50);
      await q(sb.from('invoices').delete().in('patient_id', chunk), 'delete invoices');
      await q(sb.from('clinic_tasks').delete().in('patient_id', chunk), 'delete tasks');
      await q(sb.from('patients').delete().in('id', chunk), 'delete patients');
    }
    await q(sb.from('herb_formulas').delete().eq('data_source', 'seed-month'), 'delete formulas');
    console.log(`Removed ${ids.length} patients from the earlier run, with everything attached.`);
  }

  const herbs = await q(sb.from('herbs').select('id, pinyin_name, hebrew_name').eq('is_active', true).order('pinyin_name'), 'herbs');
  const points = await q(sb.from('acupuncture_points').select('code, bilateral').eq('is_active', true).order('code'), 'points');
  const types = await q(sb.from('appointment_types').select('id, name_he, default_duration_minutes').eq('is_active', true), 'types');
  const existingNames = new Set((await q(sb.from('patients').select('full_name'), 'names')).map((p) => p.full_name));
  if (herbs.length < 12) throw new Error('The herb catalogue is nearly empty — seed the reference data first.');
  if (points.length < 8) throw new Error('The point catalogue is nearly empty — seed the reference data first.');

  const herbByPinyin = new Map(herbs.map((h) => [norm(h.pinyin_name), h]));
  const pointByCode = new Map(points.map((p) => [p.code.toUpperCase(), p]));
  const followUpType = types.find((t) => t.default_duration_minutes === 60) ?? types[0];
  const firstType = types.find((t) => t.default_duration_minutes === 90) ?? followUpType;

  // ---- the diary geometry ---------------------------------------------------
  const today = localDate(new Date(), tz);
  const futureDays = [];
  for (let n = 1; n <= DAYS_AHEAD; n++) {
    const day = addDays(today, n);
    if (WORK_DAYS.includes(weekdayOf(day))) futureDays.push(day);
  }
  const pastDays = [];
  for (let n = DAYS_BACK; n >= 1; n--) {
    const day = addDays(today, -n);
    if (WORK_DAYS.includes(weekdayOf(day))) pastDays.push(day);
  }

  const windowStart = zoned(...pastDays[0].split('-').map(Number), 0, 0, tz);
  const windowEnd = zoned(...futureDays[futureDays.length - 1].split('-').map(Number), 23, 59, tz);
  const taken = (
    await q(
      sb.from('appointments').select('start_at, end_at').neq('status', 'cancelled').gte('start_at', windowStart.toISOString()).lte('start_at', windowEnd.toISOString()),
      'existing appointments',
    )
  ).map((a) => [Date.parse(a.start_at), Date.parse(a.end_at)]);
  const clashes = (start, end) => taken.some(([s, e]) => start < e && end > s);

  /** Every possible slot of a day: room 1 on the hour, room 2 on the half hour, 60 minutes each. */
  function daySlots(day) {
    const [y, m, d] = day.split('-').map(Number);
    const slots = [];
    for (let h = DAY_START; h < DAY_END; h++) slots.push({ day, room: 0, start: zoned(y, m, d, h, 0, tz) });
    for (let h = DAY_START; h < DAY_END - 1; h++) slots.push({ day, room: 1, start: zoned(y, m, d, h, 30, tz) });
    for (const slot of slots) slot.end = new Date(slot.start.getTime() + 60 * 60000);
    return slots.sort((a, b) => a.start - b.start);
  }
  /** The slots a day actually gets: all of room 1, then room 2 in runs, so some hours have a patient every half hour. */
  function pickSlots(day, index, count) {
    const all = daySlots(day).filter((s) => !clashes(s.start.getTime(), s.end.getTime()));
    const roomOne = all.filter((s) => s.room === 0);
    const roomTwo = all.filter((s) => s.room === 1);
    const chosen = roomOne.slice(0, Math.min(count, roomOne.length));
    const extra = count - chosen.length;
    if (extra > 0 && roomTwo.length) {
      const offset = (index * 2) % roomTwo.length;
      const order = [0, 1, 4, 5, 2, 3, 6, 7, 8].map((k) => (k + offset) % roomTwo.length);
      for (const k of [...new Set(order)].slice(0, extra)) chosen.push(roomTwo[k]);
    }
    return chosen.sort((a, b) => a.start - b.start);
  }

  const futureSlots = futureDays.flatMap((day, index) => pickSlots(day, index, PER_DAY));
  const pastSlots = pastDays.flatMap((day, index) => pickSlots(day, index, PAST_PER_DAY));

  // ---- the people -----------------------------------------------------------
  const people = [];
  for (let i = 0; i < PATIENTS; i++) {
    const female = i % 2 === 0;
    const first = female ? FIRST_F[(i / 2) % FIRST_F.length] : FIRST_M[((i - 1) / 2) % FIRST_M.length];
    let lastIndex = (i * 7) % LAST.length;
    while (existingNames.has(`${first} ${LAST[lastIndex]}`) || people.some((p) => p.first === first && p.last === LAST[lastIndex])) lastIndex = (lastIndex + 1) % LAST.length;
    const last = LAST[lastIndex];
    const c = CASES[i % CASES.length];
    // Women get the women's presentations; men do not.
    const womenOnly = ['מחזור', 'גיל המעבר', 'פוריות', 'שחלות פוליציסטיות'];
    const kase = !female && womenOnly.includes(c.tag) ? CASES[(i + 3) % CASES.length] : c;
    people.push({
      i, first, last, female, kase,
      fullName: `${first} ${last}`,
      birth: `${1950 + ((i * 13) % 55)}-${pad(((i * 5) % 12) + 1)}-${pad(((i * 3) % 28) + 1)}`,
      pastVisits: 1 + (i % 3),
    });
  }
  // The women's cases must not land on a man even after the swap.
  for (const p of people) {
    if (!p.female && ['מחזור', 'גיל המעבר', 'פוריות', 'שחלות פוליציסטיות'].includes(p.kase.tag)) p.kase = CASES[0];
  }

  // Future visits: slot k to person k mod N, so each file's visits spread across the month.
  const futureByPerson = people.map(() => []);
  futureSlots.forEach((slot, k) => futureByPerson[k % people.length].push(slot));
  // Past visits: round by round, so each file's history is chronological and spaced.
  const pastByPerson = people.map(() => []);
  let cursor = 0;
  for (let round = 0; round < 3; round++) {
    for (const p of people) {
      if (p.pastVisits > round && cursor < pastSlots.length) pastByPerson[p.i].push(pastSlots[cursor++]);
    }
  }

  console.log(`Working days ahead: ${futureDays.length} (${futureDays[0]} … ${futureDays[futureDays.length - 1]}), ${futureSlots.length} appointments, ${PER_DAY} a day where the diary is free.`);
  console.log(`Working days behind: ${pastDays.length}, ${pastByPerson.flat().length} past visits with clinical records.`);
  console.log(
    'Per day: ' + futureDays.map((day) => `${day.slice(5)}×${futureSlots.filter((s) => s.day === day).length}`).join('  '),
  );
  console.log(`Patients: ${people.length}. First full day, for example:`);
  const sampleDay = futureDays.find((day) => futureSlots.filter((s) => s.day === day).length >= PER_DAY) ?? futureDays[0];
  for (const s of futureSlots.filter((s) => s.day === sampleDay)) {
    const k = futureSlots.indexOf(s) % people.length;
    console.log(`  ${new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit' }).format(s.start)}  חדר ${s.room + 1}  ${people[k].fullName}`);
  }
  if (dryRun) {
    console.log('Dry run — nothing written.');
    return;
  }

  // ---- the practice itself: hours, rooms, tags, consent documents, the questionnaire ----
  await q(sb.from('practitioner_schedules').delete().eq('practitioner_id', practitioner), 'clear hours');
  await q(
    sb.from('practitioner_schedules').insert(WORK_DAYS.map((weekday) => ({ clinic_id: clinic.id, practitioner_id: practitioner, weekday, start_time: `${pad(DAY_START)}:00`, end_time: `${pad(DAY_END)}:00`, is_active: true }))),
    'hours',
  );
  const roomRows = await q(sb.from('rooms').select('id, name'), 'rooms');
  const roomIds = [];
  for (const [k, name] of ['חדר 1', 'חדר 2'].entries()) {
    const existing = roomRows.find((r) => r.name === name);
    if (existing) roomIds.push(existing.id);
    else roomIds.push((await q(sb.from('rooms').insert({ clinic_id: clinic.id, name, color: k === 0 ? '#0e7490' : '#7c3aed', sort_order: k }).select('id').single(), 'room'))?.id);
  }
  const tagRows = await q(sb.from('patient_tags').select('id, name'), 'tags');
  const tagId = new Map(tagRows.map((t) => [t.name, t.id]));
  const missingTags = TAGS.filter(([name]) => !tagId.has(name));
  if (missingTags.length) {
    const made = await q(sb.from('patient_tags').insert(missingTags.map(([name, color], k) => ({ clinic_id: clinic.id, name, color, sort_order: tagRows.length + k })).map((row) => row)).select('id, name'), 'new tags');
    for (const t of made) tagId.set(t.name, t.id);
  }
  const docRows = await q(sb.from('consent_documents').select('id, kind, version, locale, published_at').not('published_at', 'is', null), 'consent documents');
  const docByKind = new Map();
  for (const kind of ['terms', 'privacy', 'treatment', 'marketing']) {
    const have = docRows.filter((d) => d.kind === kind && d.locale === 'he').sort((a, b) => b.version - a.version)[0];
    if (have) docByKind.set(kind, have.id);
    else {
      const titles = { terms: 'תנאי שימוש', privacy: 'הצהרת פרטיות', treatment: 'הסכמה לטיפול', marketing: 'דיוור' };
      const made = await q(
        sb.from('consent_documents').insert({ clinic_id: clinic.id, kind, version: 1, locale: 'he', title: `${titles[kind]} · סביבת בדיקות`, body: `מסמך לדוגמה לסביבת הבדיקות (${titles[kind]}). אינו מסמך משפטי. נוצר על ידי seed-sandbox-month.`, published_at: new Date().toISOString(), created_by: practitioner }).select('id').single(),
        `consent document ${kind}`,
      );
      docByKind.set(kind, made.id);
    }
  }
  const templateTitle = 'שאלון קבלה · סביבת בדיקות';
  let template = (await q(sb.from('form_templates').select('id, version').eq('title', templateTitle).limit(1), 'template'))[0];
  if (!template) {
    template = await q(sb.from('form_templates').insert({ clinic_id: clinic.id, title: templateTitle, description: 'שאלון קבלה לדוגמה, ממולא על ידי הסקריפט.', fields: INTAKE_FIELDS, version: 1, is_active: true, created_by: practitioner }).select('id, version').single(), 'new template');
  }

  // ---- patients -------------------------------------------------------------
  const patientRows = people.map((p) => ({
    clinic_id: clinic.id,
    first_name: p.first,
    last_name: p.last,
    date_of_birth: p.birth,
    sex: p.female ? 'female' : 'male',
    national_id: invalidNationalId(p.i),
    phone: `050-000${String(2001 + p.i).padStart(4, '0')}`,
    email: `synthetic.month.${p.i}@example.test`,
    address: `${STREETS[p.i % STREETS.length]} ${3 + ((p.i * 7) % 90)}, דירה ${1 + (p.i % 12)}`,
    city: CITIES[(p.i * 5) % CITIES.length],
    emergency_contact_name: `${p.female ? FIRST_M[(p.i + 11) % FIRST_M.length] : FIRST_F[(p.i + 11) % FIRST_F.length]} ${p.last}`,
    emergency_contact_phone: `050-000${String(3001 + p.i).padStart(4, '0')}`,
    occupation: JOBS[(p.i * 3) % JOBS.length],
    referral_source: REFERRAL[p.i % REFERRAL.length],
    preferred_locale: p.i % 9 === 0 ? 'en' : 'he',
    notes: `סינתטי (${MARKER}) — רשומה בדיונית שנוצרה על ידי seed-sandbox-month. לא אדם אמיתי.`,
    is_active: true,
    treatment_status: 'active',
    created_by: practitioner,
  }));
  const patients = await q(sb.from('patients').insert(patientRows).select('id, full_name'), 'patients');
  people.forEach((p, k) => (p.id = patients[k].id));
  console.log(`Patients written: ${patients.length}`);

  await q(
    sb.from('patient_medical_history').insert(
      people.map((p) => ({
        clinic_id: clinic.id,
        patient_id: p.id,
        allergies: p.kase.allergies,
        medications: p.kase.medications,
        chronic_conditions: p.kase.chronic + (p.i % 4 === 0 ? '; אנמיה קלה' : ''),
        surgeries: p.kase.surgeries,
        family_history: p.kase.family,
        lifestyle_notes: p.kase.lifestyle,
        pregnancy_status: p.female ? (p.kase.tag === 'פוריות' ? 'מנסה להרות' : p.i % 10 === 4 ? 'הריון — שבוע 14' : 'לא בהריון') : 'לא רלוונטי',
        updated_by: practitioner,
      })),
    ),
    'medical history',
  );

  const links = [];
  for (const p of people) {
    const names = new Set([p.kase.tag]);
    if (p.i % 5 === 0) names.add('ותיק/ה');
    if (p.i % 7 === 0) names.add('מעקב צמוד');
    if (/ספורט|ריצה|רץ|רוכב|שחייה|יוגה/.test(p.kase.lifestyle)) names.add('ספורטאי/ת');
    for (const name of names) if (tagId.has(name)) links.push({ clinic_id: clinic.id, patient_id: p.id, tag_id: tagId.get(name), created_by: practitioner });
  }
  await q(sb.from('patient_tag_links').insert(links), 'tag links');

  // ---- a formula of their own -------------------------------------------------
  const pool = herbs;
  const formulaRows = people.map((p) => ({
    clinic_id: clinic.id,
    name_pinyin: `${p.kase.formula[0]} jia jian`,
    name_hebrew: `${p.kase.formula[1]} · ${p.fullName}`,
    category: 'modified',
    description: `פורמולה מותאמת אישית ל${p.fullName}. אבחנה: ${p.kase.pattern}.`,
    indications: p.kase.complaint,
    actions: p.kase.principle,
    dosage_notes: `${3 + (p.i % 2)} גרם גרנולות, פעמיים ביום ${p.i % 3 === 0 ? 'לפני' : 'אחרי'} האוכל`,
    is_active: true,
    data_source: 'seed-month',
    created_by: practitioner,
  }));
  const formulas = await q(sb.from('herb_formulas').insert(formulaRows).select('id'), 'formulas');
  people.forEach((p, k) => (p.formulaId = formulas[k].id));

  const itemRows = [];
  let substituted = 0;
  for (const p of people) {
    // The herbs the catalogue knows first, so a stand-in for a missing one
    // can never collide with a real one further down the list.
    const wanted = p.kase.herbs.map(([pinyin, grams]) => ({ herb: herbByPinyin.get(norm(pinyin)) ?? null, grams }));
    const used = new Set(wanted.filter((w) => w.herb).map((w) => w.herb.id));
    const pick = (seed) => {
      let k = seed % pool.length;
      let guard = 0;
      while (used.has(pool[k].id) && guard++ < pool.length) k = (k + 1) % pool.length;
      used.add(pool[k].id);
      return pool[k];
    };
    wanted.forEach((w, n) => {
      if (!w.herb) {
        substituted++;
        w.herb = pick(p.i * 13 + n * 7);
      }
    });
    const lines = [];
    for (const w of wanted) if (!lines.some((l) => l.herb.id === w.herb.id)) lines.push(w);
    // The variation: one line out, one line of the patient's own in.
    if (lines.length > 5) lines.splice(p.i % lines.length, 1);
    lines.push({ herb: pick(p.i * 11 + 3), grams: 6 + (p.i % 4) * 3 });
    p.lines = lines;
    lines.forEach((l, k) => itemRows.push({ clinic_id: clinic.id, formula_id: p.formulaId, herb_id: l.herb.id, dosage: l.grams, unit: 'gram', sequence: k }));
  }
  await q(sb.from('herb_formula_items').insert(itemRows), 'formula items');
  if (substituted) console.log(`(${substituted} herbs named by the cases are not in this catalogue — stood in for by catalogue herbs.)`);

  // ---- points of their own -------------------------------------------------------
  const pointList = points;
  for (const p of people) {
    const codes = p.kase.points.map((c) => c.toUpperCase()).filter((c) => pointByCode.has(c));
    let k = 0;
    while (codes.length < 5 && k < pointList.length) {
      const code = pointList[(p.i * 7 + k) % pointList.length].code.toUpperCase();
      if (!codes.includes(code)) codes.push(code);
      k++;
    }
    let extra = pointList[(p.i * 3 + 1) % pointList.length].code.toUpperCase();
    let guard = 0;
    while (codes.includes(extra) && guard++ < pointList.length) extra = pointList[(pointList.findIndex((x) => x.code.toUpperCase() === extra) + 1) % pointList.length].code.toUpperCase();
    codes.push(extra);
    p.points = codes.map((code, n) => {
      const bilateral = pointByCode.get(code)?.bilateral ?? true;
      return {
        point: code,
        side: bilateral ? (n === codes.length - 1 && p.i % 4 === 1 ? 'left' : 'bilateral') : 'midline',
        technique: ['even', 'tonifying', 'reducing'][(p.i + n) % 3],
        retention_minutes: 20 + (p.i % 2) * 5,
        notes: n === 0 ? 'נקודה מרכזית לתלונה' : undefined,
      };
    });
  }

  // ---- appointments: the month ahead and the history -----------------------------
  const appointmentRows = [];
  for (const p of people) {
    for (const [n, slot] of pastByPerson[p.i].entries()) {
      appointmentRows.push({
        clinic_id: clinic.id, patient_id: p.id, practitioner_id: practitioner,
        appointment_type_id: n === 0 ? firstType.id : followUpType.id,
        start_at: slot.start.toISOString(), end_at: slot.end.toISOString(), status: 'completed',
        room_id: roomIds[slot.room], location: 'הקליניקה', notes: n === 0 ? 'ביקור ראשון' : null, kind: 'past', person: p.i, visit: n,
      });
    }
    for (const [n, slot] of futureByPerson[p.i].entries()) {
      appointmentRows.push({
        clinic_id: clinic.id, patient_id: p.id, practitioner_id: practitioner,
        appointment_type_id: followUpType.id,
        start_at: slot.start.toISOString(), end_at: slot.end.toISOString(),
        status: (p.i + n) % 3 === 0 ? 'confirmed' : 'scheduled',
        room_id: roomIds[slot.room], location: 'הקליניקה', notes: null, kind: 'future', person: p.i, visit: n,
      });
    }
  }
  const strip = ({ kind, person, visit, ...row }) => row;
  const inserted = [];
  for (let k = 0; k < appointmentRows.length; k += 100) {
    const chunk = appointmentRows.slice(k, k + 100);
    const made = await q(sb.from('appointments').insert(chunk.map(strip)).select('id, start_at'), `appointments ${k}`);
    made.forEach((row, j) => inserted.push({ ...chunk[j], id: row.id }));
  }
  console.log(`Appointments written: ${inserted.length} (${inserted.filter((a) => a.kind === 'future').length} ahead, ${inserted.filter((a) => a.kind === 'past').length} behind)`);

  // ---- the clinical record of every past visit --------------------------------------
  const pastAppointments = inserted.filter((a) => a.kind === 'past').sort((a, b) => Date.parse(a.start_at) - Date.parse(b.start_at));
  const encounterRows = pastAppointments.map((a) => ({
    clinic_id: clinic.id, patient_id: a.patient_id, practitioner_id: practitioner, appointment_id: a.id,
    encounter_date: localDate(new Date(a.start_at), tz), started_at: a.start_at, status: 'draft', created_by: practitioner,
  }));
  const encounters = [];
  for (let k = 0; k < encounterRows.length; k += 100) {
    const made = await q(sb.from('encounters').insert(encounterRows.slice(k, k + 100)).select('id, appointment_id'), `encounters ${k}`);
    encounters.push(...made);
  }
  const encounterByAppointment = new Map(encounters.map((e) => [e.appointment_id, e.id]));

  const noteRows = pastAppointments.map((a) => {
    const p = people[a.person];
    const c = p.kase;
    const first = a.visit === 0;
    return {
      clinic_id: clinic.id,
      encounter_id: encounterByAppointment.get(a.id),
      chief_complaint: c.complaint,
      history_of_present_illness: first
        ? `פנייה ראשונה. ${c.complaint}. התלונה נמשכת ${DURATIONS[p.i % 4]}; טופל/ה בעבר ב${p.i % 2 ? 'רפואה קונבנציונלית בלבד' : 'פיזיותרפיה ותרופות'} עם שיפור חלקי.`
        : `ביקור מעקב ${a.visit + 1}. שיפור של כ-${30 + a.visit * 20}% מאז הביקור הקודם; עוצמת התלונה ירדה, התדירות ${a.visit > 1 ? 'ירדה גם היא' : 'דומה'}. הפורמולה נלקחה כסדרה.`,
      tongue_body_color: c.tongue[0],
      tongue_shape: c.tongue[1],
      tongue_coating: c.tongue[2],
      tongue_notes: c.tongue[3] || null,
      pulse_left: c.pulse[0],
      pulse_right: c.pulse[1],
      pulse_qualities: c.pulse[2],
      pulse_notes: c.pulse[3] || null,
      tcm_pattern_diagnosis: c.pattern,
      western_diagnosis: c.western,
      treatment_principle: c.principle,
      modalities_used: c.modalities,
      points_used: p.points,
      treatment_notes: `${p.points.length} נקודות, השהיה ${p.points[0].retention_minutes} דקות. ${c.modalities.includes('moxibustion') ? 'מוקסה על הנקודות המרכזיות. ' : ''}${c.modalities.includes('cupping') ? 'כוסות רוח על הגב. ' : ''}הטיפול עבר בנוחות, ללא תגובה חריגה.`,
      recommendations: c.recommendations,
      follow_up_plan: a.visit + 1 === p.pastVisits ? 'המשך טיפול שבועי לפי היומן; בדיקת התקדמות בעוד ארבעה טיפולים.' : 'מעקב בעוד שבוע.',
    };
  });
  for (let k = 0; k < noteRows.length; k += 100) await q(sb.from('tcm_notes').insert(noteRows.slice(k, k + 100)), `notes ${k}`);

  // Prescriptions go through the app's own function, before the record is signed.
  let prescriptions = 0;
  for (const a of pastAppointments) {
    const p = people[a.person];
    await q(
      sb.rpc('record_prescription', {
        p_encounter_id: encounterByAppointment.get(a.id),
        p_formula_id: p.formulaId,
        p_items: [],
        p_multiplier: 1,
        p_notes: a.visit === 0 ? 'פורמולה ראשונה — לבדוק סבילות אחרי שבוע.' : 'המשך אותה פורמולה.',
        p_preparation: 'dry_extract',
        p_days_supply: '14 ימים',
        p_custom_formula: null,
        p_dose_amount: 3 + (p.i % 2),
        p_dose_unit: 'gram',
        p_dose_timing: p.i % 3 === 0 ? 'before_meal' : 'after_meal',
        p_doses_per_day: 2,
      }),
      `prescription for ${p.fullName}`,
    );
    prescriptions++;
  }

  // Signed, except the latest visit of every second file — a draft in progress is a state worth having.
  const toSign = pastAppointments.filter((a) => !(a.visit + 1 === people[a.person].pastVisits && a.person % 2 === 0));
  for (const a of toSign) {
    await q(
      sb.from('encounters').update({ status: 'signed', signed_at: new Date(Date.parse(a.start_at) + 60 * 60000).toISOString(), signed_by: practitioner }).eq('id', encounterByAppointment.get(a.id)),
      'sign',
    );
  }

  // ---- invoices and payments, one per visit -------------------------------------------
  const invoiceIds = [];
  for (const a of pastAppointments) {
    const p = people[a.person];
    const invoice = await q(
      sb.from('invoices').insert({
        clinic_id: clinic.id, patient_id: p.id, encounter_id: encounterByAppointment.get(a.id), appointment_id: a.id,
        invoice_number: 0, status: 'sent', issued_at: a.start_at, due_date: localDate(new Date(Date.parse(a.start_at) + 14 * 86400000), tz),
        notes: a.visit === 0 ? 'טיפול ראשון ופורמולה' : 'טיפול המשך ופורמולה', created_by: practitioner,
      }).select('id').single(),
      'invoice',
    );
    invoiceIds.push({ id: invoice.id, a, p });
  }
  const lineRows = invoiceIds.flatMap(({ id, a }) => [
    { clinic_id: clinic.id, invoice_id: id, description: a.visit === 0 ? 'טיפול ראשון — אבחון ודיקור' : 'טיפול דיקור', quantity: 1, unit_price: a.visit === 0 ? 400 : 300, line_total: a.visit === 0 ? 400 : 300, sequence: 0 },
    { clinic_id: clinic.id, invoice_id: id, description: 'פורמולה — 14 ימים', quantity: 1, unit_price: 180, line_total: 180, sequence: 1 },
  ]);
  for (let k = 0; k < lineRows.length; k += 100) await q(sb.from('invoice_items').insert(lineRows.slice(k, k + 100)), `invoice lines ${k}`);
  const paymentRows = invoiceIds
    .filter(({ p, a }) => !(a.visit + 1 === p.pastVisits && p.i % 5 === 0)) // every fifth file still owes for its last visit
    .map(({ id, a, p }) => ({
      clinic_id: clinic.id, invoice_id: id, amount: (a.visit === 0 ? 400 : 300) + 180,
      method: ['card', 'cash', 'bit', 'bank_transfer'][p.i % 4], status: 'paid', provider: 'manual',
      paid_at: new Date(Date.parse(a.start_at) + 65 * 60000).toISOString(), created_by: practitioner,
    }));
  for (let k = 0; k < paymentRows.length; k += 100) await q(sb.from('payments').insert(paymentRows.slice(k, k + 100)), `payments ${k}`);

  // ---- consents, the questionnaire, a task ------------------------------------------
  const firstVisitOf = (p) => pastByPerson[p.i][0]?.start ?? new Date();
  const consentRows = people.flatMap((p) =>
    ['terms', 'privacy', 'treatment', 'marketing'].map((kind) => ({
      clinic_id: clinic.id, patient_id: p.id, document_id: docByKind.get(kind), kind,
      granted: kind === 'marketing' ? p.i % 3 === 0 : true, method: p.i % 4 === 0 ? 'portal' : 'in_person',
      decided_at: new Date(firstVisitOf(p).getTime() - 30 * 60000).toISOString(), recorded_by: practitioner,
    })),
  );
  for (let k = 0; k < consentRows.length; k += 100) await q(sb.from('patient_consents').insert(consentRows.slice(k, k + 100)), `consents ${k}`);

  const submissionRows = people.map((p) => ({
    clinic_id: clinic.id, template_id: template.id, patient_id: p.id,
    encounter_id: encounterByAppointment.get(pastAppointments.find((a) => a.person === p.i && a.visit === 0)?.id) ?? null,
    template_version: template.version, fields: INTAKE_FIELDS,
    answers: {
      main_complaint: p.kase.complaint,
      duration: DURATIONS[p.i % 4],
      intensity: 3 + (p.i % 6),
      sleep: SLEEP[p.i % 3],
      digestion: DIGESTION[p.i % DIGESTION.length],
      medications: p.kase.medications,
      pregnancy: p.female && p.kase.tag === 'פוריות',
      goals: GOALS[p.i % GOALS.length],
    },
    submitted_at: new Date(firstVisitOf(p).getTime() - 24 * 60 * 60000).toISOString(),
    submitted_by: practitioner,
  }));
  for (let k = 0; k < submissionRows.length; k += 100) await q(sb.from('form_submissions').insert(submissionRows.slice(k, k + 100)), `questionnaires ${k}`);

  // Every second file gets a task: the home widget shows the first fifty open
  // tasks, and a diary-sized pile of them would push a new one out of sight.
  const taskRows = people.filter((p) => p.i % 2 === 0).map((p) => ({
    clinic_id: clinic.id, title: p.kase.task, notes: `לגבי ${p.fullName}`,
    due_on: addDays(today, 1 + ((p.i * 5) % 20)), is_urgent: p.i % 6 === 0, patient_id: p.id, created_by: practitioner,
  }));
  await q(sb.from('clinic_tasks').insert(taskRows), 'tasks');

  console.log(
    `Done: ${people.length} patients with history, tags, a formula and points of their own; ${prescriptions} prescriptions; ${invoiceIds.length} invoices (${paymentRows.length} paid); ${consentRows.length} consent decisions; ${submissionRows.length} questionnaires (each also a document); ${taskRows.length} tasks; hours set to Sunday, Tuesday and Wednesday ${DAY_START}:00–${DAY_END}:00 in two rooms.`,
  );
  await sb.auth.signOut();
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exitCode = 1;
});
