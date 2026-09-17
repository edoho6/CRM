// The canon: which book is read how, and where its text already sits on disk.
// The ids are neutral on purpose — no title or author travels past this file.
// Every text here was read once (Vision OCR for the scans, the PDF text layer
// for the rest) and cached under .cache (git-ignored); nothing is downloaded.
import fs from 'node:fs';
import path from 'node:path';
import { root } from '../../medicine/lib.mjs';
import { readVisionRun } from './vision-layout.mjs';

export const CANON_CACHE = path.join(root, '.cache', 'library', 'canon');

const pagesFromDir = (dir) =>
  fs
    .readdirSync(dir)
    .filter((f) => /^page-\d+\.txt$/.test(f))
    .sort()
    .map((f) => ({
      page: Number(f.match(/\d+/)[0]),
      text: fs.readFileSync(path.join(dir, f), 'utf8'),
    }));

const pagesFromJson = (file) =>
  JSON.parse(fs.readFileSync(file, 'utf8')).pages.map((p, i) => ({
    page: p.page ?? i + 1,
    text: p.text ?? '',
  }));

const visionPages = (rawDir) =>
  [...readVisionRun(rawDir).entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([page, text]) => ({ page, text }));

const libraryText = (md5) =>
  pagesFromJson(path.join(root, '.cache', 'library', 'text', `${md5}.json`));

/**
 * kind: 'herbs' | 'formulas' | 'points' — monographs; 'prose' — passages.
 * Front matter and back matter (contents, index, references) are skipped by
 * page range where a book has a long one.
 */
export const BOOKS = [
  {
    id: 'herbs',
    kind: 'herbs',
    pages: () => pagesFromDir(path.join(CANON_CACHE, 'bensky-mm-3e', 'ocr', 'pages')),
  },
  {
    id: 'formulas',
    kind: 'formulas',
    pages: () => visionPages(path.join(CANON_CACHE, 'formulas-strategies-2e', 'ocr', 'raw')),
  },
  // Read again by Vision from the scans: the PDF's own text layer braided the columns (HE-7's location carried HE-8's).
  {
    id: 'points',
    kind: 'points',
    pages: () => visionPages(path.join(CANON_CACHE, 'deadman', 'ocr', 'raw')),
  },
  {
    id: 'formula-strategies',
    kind: 'prose',
    pages: () => pagesFromJson(path.join(CANON_CACHE, 'yang-formulas', 'pages.json')),
  },
  {
    id: 'herb-comparisons',
    kind: 'prose',
    pages: () => pagesFromJson(path.join(CANON_CACHE, 'yang-comparisons', 'pages.json')),
  },
  {
    id: 'foundations',
    kind: 'prose',
    pages: () => libraryText('9688865156ec36607fbe2bfdf507b8c8'),
  },
  { id: 'practice', kind: 'prose', pages: () => libraryText('33fe20ea79a3b884404c20b73393624a') },
  { id: 'diagnosis', kind: 'prose', pages: () => libraryText('f5c2a81aeac71670dfc24856208cd435') },
  {
    id: 'gynaecology',
    kind: 'prose',
    pages: () => libraryText('e0640e1876128e4764670aeb1a96eefb'),
  },
  { id: 'psyche', kind: 'prose', pages: () => libraryText('37fc2887fa9271a9eb78c32946d995b4') },
];
