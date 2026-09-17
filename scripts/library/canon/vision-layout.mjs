// A page read by Google Vision, put back in reading order. Vision returns
// blocks in its own order, and on a two-column page with composition tables
// that order interleaves the columns: the herbs of one formula land next to
// the doses of another (Formulas & Strategies p.120 — the "12g" of an
// associated formula sat between the herbs of Rambling Powder). Here every
// word is placed by its box: a column by where it starts, a line by where
// its middle sits, and the lines of a column top to bottom. A herb and its
// dose share a line because they share a height on the page.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

/** Where the gap between the columns is looked for, as fractions of the page width. */
const GUTTER_FROM = 0.3;
const GUTTER_TO = 0.7;
const BIN = 0.005;

/**
 * The gap between the two columns on this page. It is not at a fixed place:
 * the scan of a left-hand page sits further left (F&S p.121 put the right
 * column's first words inside a fixed 0.52 gutter). The gap is the middle of
 * the widest band that the fewest words cover.
 */
function gutterOf(words) {
  const bins = Math.round((GUTTER_TO - GUTTER_FROM) / BIN);
  const cover = new Array(bins).fill(0);
  for (const w of words) {
    const from = Math.max(0, Math.floor((w.x0 - GUTTER_FROM) / BIN));
    const to = Math.min(bins - 1, Math.floor((w.x1 - GUTTER_FROM) / BIN));
    for (let i = from; i <= to; i += 1) cover[i] += 1;
  }
  const least = Math.min(...cover);
  let best = { start: Math.floor(bins / 2), length: 0 };
  for (let i = 0; i < bins;) {
    if (cover[i] !== least) {
      i += 1;
      continue;
    }
    let j = i;
    while (j < bins && cover[j] === least) j += 1;
    if (j - i > best.length) best = { start: i, length: j - i };
    i = j;
  }
  return GUTTER_FROM + (best.start + best.length / 2) * BIN;
}
/** Running heads and page numbers sit above this. */
const HEAD_LIMIT = 0.08;

function wordText(word) {
  return (word.symbols ?? [])
    .map((s) => s.text + (s.property?.detectedBreak?.type === 'SPACE' ? '' : ''))
    .join('');
}

function box(vertices = []) {
  const xs = vertices.map((v) => v.x ?? 0);
  const ys = vertices.map((v) => v.y ?? 0);
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
}

/** Lines of one column: words grouped by the height of their middle, each line read left to right. */
function linesOf(words) {
  const sorted = [...words].sort((a, b) => a.cy - b.cy);
  const heights = sorted.map((w) => w.y1 - w.y0).sort((a, b) => a - b);
  const tolerance = Math.max(0.004, (heights[Math.floor(heights.length / 2)] ?? 0.01) * 0.55);
  const lines = [];
  for (const word of sorted) {
    const line = lines.at(-1);
    if (line && Math.abs(word.cy - line.cy) <= tolerance) {
      line.words.push(word);
      line.cy = line.words.reduce((sum, w) => sum + w.cy, 0) / line.words.length;
    } else lines.push({ cy: word.cy, words: [word] });
  }
  return lines.map((line) => {
    const words = line.words.sort((a, b) => a.x0 - b.x0);
    // A wide gap inside a line is a table: the herb on the left, its dose on the right.
    let text = '';
    words.forEach((w, i) => {
      if (i > 0) text += w.x0 - words[i - 1].x1 > 0.06 ? ' \t ' : ' ';
      text += w.text;
    });
    return { y: line.cy, text: tidy(text) };
  });
}

/**
 * Vision puts a space around every punctuation mark ("Radix ( chái hú ) ."); a
 * reader would not. The dotted leaders of a composition table go first — a
 * leader's last dot glued to the dose (".30g") would otherwise read as a decimal;
 * the book writes its decimals with a leading digit ("4.5g").
 */
function tidy(text) {
  return text
    .replace(/(?:\s*[.…·]){2,}\s*/g, ' \t ')
    .replace(/(^|\s)\.(?=\d)/g, '$1')
    .replace(/[ ]+([,.;:!?)\]])/g, '$1')
    .replace(/([([])\s+/g, '$1')
    .replace(/([A-Za-z]) - (?=[A-Za-z])/g, '$1-')
    .replace(/([A-Za-z.]) - (?=\d)/g, '$1-')
    .replace(/[ ]{2,}/g, ' ')
    .trim();
}

/**
 * The page's text in reading order: the left column, then the right. The
 * column is decided per word, by where its middle sits: Vision sometimes
 * returns one block that holds both columns (F&S p.121), and a block-level
 * split then braided the two into one text. A line that truly runs across
 * the gutter — rare in these books — is cut in two, which a reader of the
 * passage survives.
 * @param {object} answer one Vision response
 */
export function readingOrder(answer) {
  const first = answer.fullTextAnnotation?.pages?.[0];
  const blocks = first?.blocks ?? [];
  // An image comes back measured in pixels, a PDF page in fractions of the page.
  const place = (bounds) =>
    bounds?.normalizedVertices?.length
      ? box(bounds.normalizedVertices)
      : box(
          (bounds?.vertices ?? []).map((v) => ({
            x: (v.x ?? 0) / (first?.width || 1),
            y: (v.y ?? 0) / (first?.height || 1),
          })),
        );
  const words = [];
  for (const block of blocks) {
    const b = place(block.boundingBox);
    if (b.y1 < HEAD_LIMIT) continue;
    for (const paragraph of block.paragraphs ?? []) {
      for (const word of paragraph.words ?? []) {
        const w = place(word.boundingBox);
        words.push({ ...w, cy: (w.y0 + w.y1) / 2, text: wordText(word) });
      }
    }
  }
  const gutter = gutterOf(words);
  const columns = [[], []];
  for (const word of words) columns[(word.x0 + word.x1) / 2 < gutter ? 0 : 1].push(word);
  return columns.flatMap((words) => linesOf(words).map((line) => line.text)).join('\n');
}

/** Every page of a Vision run, in reading order, keyed by page number. */
export function readVisionRun(rawDir) {
  const pages = new Map();
  for (const file of fs.readdirSync(rawDir).sort()) {
    const { first, responses, answers } = JSON.parse(
      zlib.gunzipSync(fs.readFileSync(path.join(rawDir, file))),
    );
    // Two shapes: a PDF run answers per page of the part; an image run keys each answer by page.
    if (answers)
      for (const [page, { answer }] of Object.entries(answers))
        pages.set(Number(page), readingOrder(answer));
    else
      responses.forEach((answer, i) => {
        const page = first + (answer.context?.pageNumber ?? i + 1) - 1;
        pages.set(page, readingOrder(answer));
      });
  }
  return pages;
}
