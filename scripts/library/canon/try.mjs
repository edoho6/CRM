// A trial of the lean engine on questions of every kind: each answer, what it
// cost and how long it took, written to test-results/canon-trial/ (git-ignored).
// Every question is fictitious; no patient's details.
//
//   node scripts/library/canon/try.mjs [--only=3,7] [--course]   (--course: with the Hebrew course layer)
import fs from 'node:fs';
import path from 'node:path';
import { root } from '../../medicine/lib.mjs';
import { ask, loadIndex } from './engine.mjs';

export const QUESTIONS = [
  { kind: 'עובדה — צמח ובטיחות', q: 'מה המינון של Fu Zi ומה חשוב לדעת על הבטיחות שלו?' },
  { kind: 'עובדה — נקודה', q: 'איפה נמצאת SP-6, איך מדקרים אותה, והאם מותר לדקר אותה בהיריון?' },
  { kind: 'עובדה — הרכב פורמולה', q: 'מה ההרכב והמינונים של Xiao Yao San?' },
  { kind: 'מקור קלאסי', q: 'מאיזה ספר קלאסי מגיעה Gui Zhi Tang ומה ההתוויה המקורית שלה?' },
  {
    kind: 'השוואה — פורמולות',
    q: 'מה ההבדל בין Xiao Yao San ל-Chai Hu Shu Gan San ומתי בוחרים כל אחת?',
  },
  { kind: 'השוואה — צמחים', q: 'מה ההבדל בין Bai Shao ל-Chi Shao?' },
  { kind: 'תפקיד בפורמולה', q: 'מה התפקיד של Bai Shao ב-Gui Zhi Tang?' },
  {
    kind: 'שינויים בפורמולה',
    q: 'איך משנים את Liu Wei Di Huang Wan כשיש חום מחוסר יין בולט עם הזעות לילה?',
  },
  { kind: 'טיפול לפי מצב — נקודות', q: 'אילו נקודות מתאימות לנדודי שינה, לפי דפוסים?' },
  { kind: 'טיפול לפי מצב — גינקולוגיה', q: 'איך מטפלים בכאבי מחזור לפי דפוסים? פורמולות ונקודות.' },
  {
    kind: 'מושגים ודפוסים',
    q: 'מה ההבדל בסימנים בין חוסר יין בכליות לחוסר יאנג בכליות, כולל לשון ודופק?',
  },
  {
    kind: 'מקרה — אבחנה מבדלת',
    q: 'גבר בן 48, ליבידו נמוכה וזקפה חלשה, הזעות לילה, עצבנות, לשון אדומה, דופק מיתרי ומהיר. מה האבחנה המבדלת ואיך מטפלים?',
  },
  {
    kind: 'מקרה — נשים',
    q: 'אישה בת 34, מחזורים לא סדירים, לפני המחזור רגישות בשדיים ועצבנות, עייפות, צואה רכה, לשון חיוורת עם סימני שיניים, דופק מיתרי. מה הדפוסים ומה הטיפול?',
  },
  { kind: 'בטיחות — היריון', q: 'אילו נקודות אסור לדקר בהיריון?' },
  { kind: 'בטיחות — תרופות', q: 'האם אפשר לתת Dan Shen למטופל שנוטל warfarin?' },
  { kind: 'הנחה שגויה', q: 'למה Ma Huang טוב להזעות לילה?' },
  {
    kind: 'מורכב — היריון ושינה',
    q: 'מטופלת בשבוע 20 להיריון עם נדודי שינה וחרדה. מה אפשר לעשות בדיקור ובצמחים, וממה להימנע?',
  },
];

const only = process.argv
  .find((a) => a.startsWith('--only='))
  ?.slice(7)
  .split(',')
  .map(Number);
const OUT = path.join(root, 'test-results', 'canon-trial');
fs.mkdirSync(OUT, { recursive: true });
const started = Date.now();
loadIndex();
console.log(`index loaded in ${Date.now() - started} ms`);

const course = process.argv.includes('--course');
const budget = Number(process.argv.find((a) => a.startsWith('--budget='))?.slice(9) ?? 2);
const results = [];
for (const [i, item] of QUESTIONS.entries()) {
  if (only && !only.includes(i + 1)) continue;
  const spent = results.reduce((s, r) => s + (r.usage?.dollars ?? 0), 0);
  if (spent >= budget) {
    console.log(`stopped: $${spent.toFixed(3)} spent, budget $${budget}`);
    break;
  }
  try {
    const r = await ask(item.q, [], { course });
    results.push({ n: i + 1, kind: item.kind, ...r });
    console.log(
      `#${i + 1} ${r.complex ? 'complex' : 'simple '} ${r.seconds}s $${r.usage.dollars.toFixed(4)} doses removed ${r.checks.dosesRemoved.length}, safety fixes ${r.checks.safetyFixes.length}, names ${r.checks.namesFixed.length}, books ${r.checks.bookNamesRemoved.length} | ${r.evidence.entries.length} entries, ${r.evidence.passages} passages`,
    );
  } catch (error) {
    results.push({
      n: i + 1,
      kind: item.kind,
      question: item.q,
      error: String(error?.message ?? error),
    });
    console.log(`#${i + 1} ERROR ${error?.message ?? error}`);
  }
  fs.writeFileSync(
    path.join(OUT, `${only ? `results-${only.join('-')}` : 'results'}${course ? '-course' : ''}.json`),
    JSON.stringify(results, null, 2),
  );
}
const ok = results.filter((r) => !r.error);
const dollars = ok.reduce((s, r) => s + r.usage.dollars, 0);
console.log(
  `\n${ok.length} answered, $${dollars.toFixed(3)} total, $${(dollars / Math.max(1, ok.length)).toFixed(4)} per question`,
);
process.exit(0);
