// Checks the no-model half of the engine: does each name a practitioner writes
// find the right canon entry? Free — no service is called.
//
//   node scripts/library/canon/lookup-check.mjs
import { entryTitle, findEntry, loadIndex } from './engine.mjs';

const CASES = [
  ['herb', 'Fu Zi', /Aconiti Radix lateralis/],
  ['herb', 'Bai Shao', /Paeoniae Radix alba/],
  ['herb', 'Chi Shao', /Paeoniae Radix rubra/],
  ['herb', 'Dan Shen', /Salviae miltiorrhizae/],
  ['herb', 'Ma Huang', /Ephedrae Herba/],
  ['herb', 'Huang Qi', /Astragali/],
  ['herb', 'Ren Shen', /Ginseng Radix/],
  ['herb', 'Chai Hu', /Bupleuri/],
  ['herb', 'Suan Zao Ren', /Ziziphi/],
  ['formula', 'Xiao Yao San', /xiao yáo|Rambling/i],
  ['formula', 'Chai Hu Shu Gan San', /Bupleurum Powder to Dredge/],
  ['formula', 'Gui Zhi Tang', /Cinnamon Twig Decoction/],
  ['formula', 'Liu Wei Di Huang Wan', /Six-Ingredient Pill/],
  ['formula', 'Zhi Bai Di Huang Wan', /Anemarrhena, Phellodendron/],
  ['formula', 'Tian Wang Bu Xin Dan', /Emperor/],
  ['formula', 'Gui Pi Tang', /Restore the Spleen/],
  ['formula', 'Suan Zao Ren Tang', /Sour Jujube/],
  ['formula', 'Shao Fu Zhu Yu Tang', /Drive Out Blood Stasis in the Lower Abdomen/],
  ['point', 'SP-6', /SP-6/],
  ['point', 'Sp6', /SP-6/],
  ['point', 'HT-7', /HE-7/],
  ['point', 'KI-3', /KID-3/],
  ['point', 'CV-4', /REN-4/],
  ['point', 'GV-20', /DU-20/],
  ['point', 'LI-4', /LI-4/],
  ['point', 'GB-21', /GB-21/],
  ['point', 'BL-60', /BL-60/],
  ['point', 'BL-67', /BL-67/],
  ['point', 'LIV-3', /LIV-3/],
  ['point', 'Yintang', /Yintang/i],
  ['point', 'Anmian', /Anmian/i],
];

const index = loadIndex();
const counts = { herb: 0, formula: 0, point: 0 };
for (const e of index.entries) counts[e.kind] += 1;
console.log(`entries: ${JSON.stringify(counts)}, passages ${index.passages.length}`);
let ok = 0;
for (const [kind, name, want] of CASES) {
  const e = findEntry(kind, name);
  const title = e ? entryTitle(e) : '—';
  const pass = e && want.test(title);
  if (pass) ok += 1;
  console.log(`${pass ? 'ok  ' : 'MISS'} ${kind} ${name} → ${title}`);
}
console.log(`${ok}/${CASES.length}`);
process.exit(0);
