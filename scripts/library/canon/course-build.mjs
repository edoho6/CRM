// The course folder (course-read.mjs) as passages for the canon's teaching layer:
// Hebrew files only, cut into passages of a few paragraphs, identifying details
// dropped, repeated passages kept once, embedded with Voyage (cached per text).
// Written to .cache/library/canon/course/index/{passages.json, vectors.f32}.
//
//   node --max-old-space-size=8192 scripts/library/canon/course-build.mjs [--no-embed]
//
// A passage carries no file name and no author: its heading is the course subject
// ("דיאגנוזה") and the nearest heading in the text. Summaries name the students who
// wrote them and slides the lecturer; a line that names a person by e-mail or phone
// is dropped by findPii, and the file name never leaves this script.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { env, log } from '../../medicine/lib.mjs';
import { findPii } from '../../../packages/domain/src/library.ts';
import { chunkPages } from '../lib/chunk.mjs';
import { DIMENSIONS, embedTexts } from '../lib/voyage.mjs';
import { COURSE_CACHE } from './course-read.mjs';

export const COURSE_BOOK = 'course';
const INDEX = path.join(COURSE_CACHE, 'index');
const embed = !process.argv.includes('--no-embed');
/** A passage below this is a slide title or a table cell, not something to read. */
const MIN_CHARS = 200;
/** "נערך על ידי …", "סוכם ע"י …": a credit line names a person and nothing else. */
const CREDIT =
  /(?:נערך|נכתב|סוכם|הוכן|תומלל|נאסף)\s+(?:על\s+ידי|ע["״]י)|^\s*(?:מאת|כותב(?:ת)?|מרצה|המרצה)\s*:/;
const bare = (line) =>
  line
    .replace(/[\d\-–|•.,:()]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
/** "שיעור 5- 1.12.21": when a lesson was given, which says nothing and dates the student. */
const LESSON_DATE =/^\s*(?:שיעור|הרצאה|מפגש)\s*\d*\s*[-–:]?\s*\d{1,2}[./]\d{1,2}[./]\d{2,4}\s*$/;

const hebrewShare = (text) =>
  (text.match(/[א-ת]/g) ?? []).length / Math.max(1, text.replace(/\s/g, '').length);
/** "6.דיאגנוזה" → "דיאגנוזה". */
const subjectOf = (filePath) => (filePath.split('/')[1] ?? '').replace(/^[\d.\s]+/, '').trim();

const report = JSON.parse(fs.readFileSync(path.join(COURSE_CACHE, 'report.json'), 'utf8'));
const passages = [];
const seen = new Set();
let droppedLines = 0;
let files = 0;
const courseFiles = report
  .filter((row) => row.status === 'text' && row.hebrew / Math.max(1, row.chars) > 0.3)
  .map((row) => ({
    row,
    pages: JSON.parse(fs.readFileSync(path.join(COURSE_CACHE, 'full', `${row.md5}.json`), 'utf8'))
      .pages,
  }));

// A running header — the student who wrote the summary, the lecturer, the course — repeats on page after
// page. With its page number ("118 פלורייט ריבלין") it is a different line on every page, so lines are
// compared without digits. A header found in one file is taken out of every file: the same student's
// Word summary is one long page, where nothing repeats.
const running = new Set();
for (const { pages } of courseFiles) {
  if (pages.length < 3) continue;
  const onPages = new Map();
  for (const p of pages)
    for (const line of new Set(
      p.text
        .split('\n')
        .map(bare)
        .filter((l) => l && l.length < 60),
    ))
      onPages.set(line, (onPages.get(line) ?? 0) + 1);
  for (const [line, n] of onPages) if (n >= Math.max(3, pages.length * 0.3)) running.add(line);
}
// …also at the start of a line that goes on ("פלורייט ריבלין ס"ס כללים: …"), when it is two or three words
// and none of them is a word of the trade (a running "עיקרון טיפולי" must not be cut out of content).
const TRADE =
  /צ'י|יין|יאנג|דם|חום|קור|לחות|ליחה|רוח|כבד|טחול|כליות|ריאות|לב|קיבה|טיפול|עיקרון|פורמול|צמח|נקוד|מרידיאן|דופק|לשון|סינדרום|דפוס|חוסר|עודף|תקיעות|אבחנ/;
const prefixes = [...running].filter(
  (line) => /^[א-ת'"]+(?: [א-ת'"]+){1,2}$/.test(line) && !TRADE.test(line),
);

for (const { row, pages } of courseFiles) {
  files += 1;
  const clean = pages.map((p) => ({
    page: p.page ?? null,
    text: p.text
      .split('\n')
      .filter((line) => {
        const drop =
          running.has(bare(line)) ||
          LESSON_DATE.test(line) ||
          CREDIT.test(line) ||
          findPii(line).length > 0;
        if (drop) droppedLines += 1;
        return !drop;
      })
      .map((line) =>
        prefixes.reduce((l, name) => l.replace(new RegExp(`^\\s*\\d*\\s*${name}\\s+`), ''), line),
      )
      .join('\n'),
  }));
  const subject = subjectOf(row.path);
  for (const chunk of chunkPages(clean, { maxChars: 1400, overlapChars: 150 })) {
    const text = chunk.content.trim();
    if (text.length < MIN_CHARS || hebrewShare(text) < 0.3) continue;
    const key = crypto.createHash('sha1').update(text.replace(/\s+/g, ' ')).digest('hex');
    if (seen.has(key)) continue;
    seen.add(key);
    const heading =
      chunk.heading && hebrewShare(chunk.heading) > 0.3 ? `${subject} — ${chunk.heading}` : subject;
    passages.push({
      book: COURSE_BOOK,
      entry: null,
      section: null,
      page: chunk.page,
      heading,
      text,
    });
  }
}
fs.mkdirSync(INDEX, { recursive: true });
fs.writeFileSync(path.join(INDEX, 'passages.json'), JSON.stringify(passages));
const chars = passages.reduce((s, p) => s + p.text.length, 0);
log(
  `course: ${files} files, ${passages.length} passages, ${Math.round(chars / 1000)}k chars, ${droppedLines} lines with an identifying detail dropped`,
);

if (embed) {
  const key = env('VOYAGE_API_KEY');
  if (!key) throw new Error('VOYAGE_API_KEY is not set');
  let last = 0;
  const { embeddings, cached, tokens } = await embedTexts(
    key,
    passages.map((p) => `${p.heading}\n${p.text}`),
    {
      cacheDir: path.join(COURSE_CACHE, 'embeddings'),
      onProgress: (done, total) => {
        if (done - last >= 1000 || done === total) {
          log(`embedded ${done} of ${total}`);
          last = done;
        }
      },
    },
  );
  const out = new Float32Array(passages.length * DIMENSIONS);
  embeddings.forEach((vector, i) => {
    const norm = Math.hypot(...vector) || 1;
    for (let d = 0; d < DIMENSIONS; d += 1) out[i * DIMENSIONS + d] = vector[d] / norm;
  });
  fs.writeFileSync(path.join(INDEX, 'vectors.f32'), Buffer.from(out.buffer));
  log(`vectors: ${cached} from cache, ${tokens.toLocaleString('en-US')} tokens paid`);
}
process.exit(0);
