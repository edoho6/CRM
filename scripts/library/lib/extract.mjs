// The text of a file, page by page where the file has pages.
//
// PDF through pdfjs (the reader behind Firefox), one page at a time so the
// passage can say which page it came from; Word (.docx) through mammoth as
// HTML, so headings survive as lines the chunker recognises; old Word
// (.doc) through word-extractor; RTF by walking its control words; slides,
// spreadsheets and EPUB books by opening the zip they are and reading the
// XML inside; plain text and Markdown as they are. A scanned PDF with no
// text layer, and an image, yield nothing here and say so — the loader
// then sends them to Drive's OCR (convert.mjs).
import path from 'node:path';
import { createRequire } from 'node:module';
import { htmlToText } from '../../medicine/lib.mjs';

const require = createRequire(import.meta.url);

/** File extensions the local-folder mode reads, and the kind each is read as. */
export const EXTENSION_KINDS = {
  pdf: 'pdf',
  docx: 'docx',
  doc: 'doc',
  rtf: 'rtf',
  pptx: 'pptx',
  xlsx: 'xlsx',
  epub: 'epub',
  txt: 'txt',
  md: 'md',
  jpg: 'image',
  jpeg: 'image',
  png: 'image',
  tif: 'image',
  tiff: 'image',
  webp: 'image',
};

/** The MIME type a local file is uploaded as when it goes to Drive for OCR or conversion. */
export const EXTENSION_MIME = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  webp: 'image/webp',
};

/** Said in `note` when a file has no text of its own and needs OCR. */
export const NEEDS_OCR = 'no text layer (scanned?)';

/** @returns {Promise<{pages: {page: number | null, text: string}[], pageCount: number | null, note: string | null}>} */
export async function extractText(buffer, ext) {
  switch (ext) {
    case 'pdf':
      return extractPdf(buffer);
    case 'docx':
      return extractDocx(buffer);
    case 'doc':
      return extractDoc(buffer);
    case 'rtf':
      return single(rtfToText(buffer));
    case 'pptx':
      return extractPptx(buffer);
    case 'xlsx':
      return extractXlsx(buffer);
    case 'epub':
      return extractEpub(buffer);
    case 'txt':
    case 'md':
      return single(buffer.toString('utf8'));
    case 'image':
      return { pages: [], pageCount: null, note: NEEDS_OCR };
    default:
      return { pages: [], pageCount: null, note: `unsupported: ${ext}` };
  }
}

function single(text) {
  const clean = String(text ?? '').trim();
  return { pages: clean ? [{ page: null, text: clean }] : [], pageCount: null, note: clean ? null : 'no text' };
}

async function extractPdf(buffer) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const document = await pdfjs.getDocument({ data: new Uint8Array(buffer), useSystemFonts: true, disableFontFace: true, isEvalSupported: false }).promise;
  const pages = [];
  let empty = 0;
  for (let n = 1; n <= document.numPages; n += 1) {
    const page = await document.getPage(n);
    const content = await page.getTextContent();
    let text = '';
    for (const item of content.items) {
      if (!('str' in item)) continue;
      text += item.str;
      text += item.hasEOL ? '\n' : ' ';
    }
    // Lines that end mid-sentence belong to one paragraph; a blank line, or a
    // line ending in a full stop before a capital, is a break.
    const cleaned = text
      .replace(/[ \t]+/g, ' ')
      .replace(/ \n/g, '\n')
      .replace(/([^.!?:\n])\n(?=[a-z֐-׿])/g, '$1 ')
      .trim();
    if (!cleaned) empty += 1;
    pages.push({ page: n, text: cleaned });
    page.cleanup();
  }
  await document.destroy();
  // A scan often carries a few characters of junk on some pages; nine in ten empty is a scan.
  const scanned = document.numPages > 0 && empty >= Math.ceil(document.numPages * 0.9);
  const note = scanned ? NEEDS_OCR : empty > 0 ? `${empty} empty page(s)` : null;
  return { pages: scanned ? [] : pages, pageCount: document.numPages, note };
}

/** HTML from a converter, with its headings and paragraphs turned into the lines the chunker reads. */
function htmlBlocksToText(html) {
  return htmlToText(
    String(html ?? '')
      .replace(/<h([1-6])[^>]*>/gi, (_, level) => `\n\n${'#'.repeat(Number(level))} `)
      .replace(/<\/h[1-6]>/gi, '\n\n')
      .replace(/<\/(p|div|section|tr|blockquote|pre)>/gi, '\n\n')
      .replace(/<li[^>]*>/gi, '\n• '),
  );
}

async function extractDocx(buffer) {
  const mammoth = require('mammoth');
  const { value: html } = await mammoth.convertToHtml({ buffer });
  return single(htmlBlocksToText(html));
}

async function extractDoc(buffer) {
  const WordExtractor = require('word-extractor');
  const document = await new WordExtractor().extract(buffer);
  const parts = [document.getBody(), document.getFootnotes(), document.getEndnotes()].map((part) => String(part ?? '').trim()).filter(Boolean);
  return single(parts.join('\n\n'));
}

/** Destinations whose content is not the document's text. */
const RTF_SILENT = new Set([
  'fonttbl', 'colortbl', 'stylesheet', 'info', 'pict', 'object', 'header', 'footer', 'headerl', 'headerr', 'footerl', 'footerr',
  'xmlnstbl', 'listtable', 'listoverridetable', 'rsidtbl', 'generator', 'themedata', 'colorschememapping', 'latentstyles',
  'datastore', 'pgdsctbl', 'filetbl', 'revtbl', 'fldinst', 'picprop', 'shpinst', 'userprops', 'docvar', 'template',
  'bkmkstart', 'bkmkend', 'mmathPr', 'wgrffmtfilter', 'pntxta', 'pntxtb', 'atnid', 'atnauthor', 'annotation',
]);

/**
 * RTF is 7-bit text with control words; bytes above ASCII arrive as \'hh in
 * the document's code page (1255 for Hebrew) and modern writers add \uN.
 */
export function rtfToText(buffer) {
  const src = buffer.toString('latin1');
  let decoder = new TextDecoder('windows-1255');
  const out = [];
  let bytes = [];
  const flush = () => {
    if (bytes.length) {
      out.push(decoder.decode(Uint8Array.from(bytes)));
      bytes = [];
    }
  };
  const stack = [];
  let skip = 0;
  let uc = 1;
  let skipBytes = 0;
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (ch === '{') {
      stack.push({ skip, uc });
      if (skip) skip += 1;
      continue;
    }
    if (ch === '}') {
      const saved = stack.pop();
      if (saved) {
        skip = saved.skip;
        uc = saved.uc;
      }
      continue;
    }
    if (ch === '\\') {
      const next = src[i + 1];
      if (next === '*') {
        if (!skip) skip = 1;
        i += 1;
        continue;
      }
      if (next === "'") {
        const code = parseInt(src.slice(i + 2, i + 4), 16);
        i += 3;
        if (skipBytes > 0) skipBytes -= 1;
        else if (!skip && Number.isFinite(code)) bytes.push(code);
        continue;
      }
      if (next === '\\' || next === '{' || next === '}') {
        if (!skip) bytes.push(next.charCodeAt(0));
        i += 1;
        continue;
      }
      if (next === '~') {
        if (!skip) bytes.push(32);
        i += 1;
        continue;
      }
      if (next === '\n' || next === '\r') {
        if (!skip) {
          flush();
          out.push('\n');
        }
        i += 1;
        continue;
      }
      const match = /^\\([a-zA-Z]+)(-?\d+)? ?/.exec(src.slice(i, i + 40));
      if (!match) {
        i += 1;
        continue;
      }
      i += match[0].length - 1;
      const word = match[1];
      const param = match[2] === undefined ? null : Number(match[2]);
      if (skip) continue;
      if (RTF_SILENT.has(word) && stack.length) {
        skip = 1;
        continue;
      }
      if (word === 'ansicpg' && param) {
        try {
          decoder = new TextDecoder(`windows-${param}`);
        } catch {
          // An unknown code page: Hebrew stays the guess.
        }
      } else if (word === 'uc') uc = param ?? 1;
      else if (word === 'u' && param !== null) {
        flush();
        out.push(String.fromCharCode(param < 0 ? param + 65536 : param));
        skipBytes = uc;
      } else if (word === 'par' || word === 'line' || word === 'sect' || word === 'page') {
        flush();
        out.push('\n');
      } else if (word === 'tab') {
        flush();
        out.push('\t');
      }
      continue;
    }
    if (ch === '\r' || ch === '\n') continue;
    // What follows a unicode escape is a fallback for readers without
    // unicode — a byte or a plain '?' — and is skipped either way.
    if (skipBytes > 0) {
      skipBytes -= 1;
      continue;
    }
    if (!skip) bytes.push(ch.charCodeAt(0));
  }
  flush();
  return out.join('').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function decodeXml(text) {
  return String(text ?? '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&amp;/g, '&');
}

/** Every text run of an Office XML part, in order, each paragraph on its own line. */
function officeXmlText(xml, paragraphTag, runTag) {
  const lines = [];
  for (const paragraph of String(xml).split(new RegExp(`<${paragraphTag}[\\s>]`)).slice(1)) {
    const runs = [...paragraph.matchAll(new RegExp(`<${runTag}(?:\\s[^>]*)?>([^<]*)</${runTag}>`, 'g'))].map((m) => decodeXml(m[1]));
    const line = runs.join('').trim();
    if (line) lines.push(line);
  }
  return lines.join('\n');
}

async function extractPptx(buffer) {
  const JSZip = require('jszip');
  const zip = await JSZip.loadAsync(buffer);
  const slides = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));
  const pages = [];
  for (const [index, name] of slides.entries()) {
    const text = officeXmlText(await zip.file(name).async('string'), 'a:p', 'a:t');
    if (text.trim()) pages.push({ page: index + 1, text });
  }
  return { pages, pageCount: slides.length, note: pages.length ? null : 'no text' };
}

async function extractXlsx(buffer) {
  const JSZip = require('jszip');
  const zip = await JSZip.loadAsync(buffer);
  const shared = [];
  const sharedXml = zip.file('xl/sharedStrings.xml') ? await zip.file('xl/sharedStrings.xml').async('string') : '';
  for (const item of sharedXml.split('<si>').slice(1)) {
    shared.push([...item.matchAll(/<t(?:\s[^>]*)?>([^<]*)<\/t>/g)].map((m) => decodeXml(m[1])).join(''));
  }
  const workbook = zip.file('xl/workbook.xml') ? await zip.file('xl/workbook.xml').async('string') : '';
  const names = [...workbook.matchAll(/<sheet\b[^>]*\bname="([^"]*)"/g)].map((m) => decodeXml(m[1]));
  const sheets = Object.keys(zip.files)
    .filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name))
    .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));
  const pages = [];
  for (const [index, name] of sheets.entries()) {
    const xml = await zip.file(name).async('string');
    const rows = [];
    for (const row of xml.split(/<row\b/).slice(1)) {
      const cells = [];
      for (const cell of row.matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
        const attrs = cell[1];
        const inner = cell[2];
        const type = attrs.match(/\bt="([^"]*)"/)?.[1];
        let value = '';
        if (type === 's') value = shared[Number(inner.match(/<v>([^<]*)<\/v>/)?.[1])] ?? '';
        else if (type === 'inlineStr') value = [...inner.matchAll(/<t(?:\s[^>]*)?>([^<]*)<\/t>/g)].map((m) => decodeXml(m[1])).join('');
        else value = decodeXml(inner.match(/<v>([^<]*)<\/v>/)?.[1] ?? '');
        if (value.trim()) cells.push(value.trim());
      }
      if (cells.length) rows.push(cells.join(' | '));
    }
    if (rows.length) pages.push({ page: index + 1, text: `# ${names[index] ?? `Sheet ${index + 1}`}\n\n${rows.join('\n')}` });
  }
  return { pages, pageCount: sheets.length, note: pages.length ? null : 'no text' };
}

async function extractEpub(buffer) {
  const JSZip = require('jszip');
  const zip = await JSZip.loadAsync(buffer);
  const container = zip.file('META-INF/container.xml') ? await zip.file('META-INF/container.xml').async('string') : '';
  const opfPath = container.match(/full-path="([^"]+)"/)?.[1];
  const opf = opfPath && zip.file(opfPath) ? await zip.file(opfPath).async('string') : '';
  const base = opfPath ? opfPath.replace(/[^/]*$/, '') : '';
  const items = new Map();
  for (const item of opf.matchAll(/<item\b([^>]*)\/?>/g)) {
    const id = item[1].match(/\bid="([^"]*)"/)?.[1];
    const href = item[1].match(/\bhref="([^"]*)"/)?.[1];
    const type = item[1].match(/\bmedia-type="([^"]*)"/)?.[1];
    if (id && href && /xhtml|html/.test(type ?? '')) items.set(id, decodeXml(href));
  }
  const order = [...opf.matchAll(/<itemref\b[^>]*\bidref="([^"]*)"/g)].map((m) => m[1]).filter((id) => items.has(id));
  const hrefs = order.length ? order.map((id) => items.get(id)) : [...items.values()];
  const pages = [];
  for (const [index, href] of hrefs.entries()) {
    const file = zip.file(base + href) ?? zip.file(href);
    if (!file) continue;
    const html = await file.async('string');
    const body = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? html;
    const text = htmlBlocksToText(body.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' '));
    if (text.trim()) pages.push({ page: index + 1, text });
  }
  return { pages, pageCount: hrefs.length, note: pages.length ? null : 'no text' };
}

export function titleOf(fileName) {
  return path.basename(fileName).replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').trim();
}
