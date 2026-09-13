// The text of a file, page by page where the file has pages.
//
// PDF through pdfjs (the reader behind Firefox), one page at a time so the
// passage can say which page it came from; Word through mammoth as HTML,
// so headings survive as lines the chunker recognises; plain text and
// Markdown as they are. Scanned PDFs with no text layer yield nothing, and
// are reported rather than guessed at.
import path from 'node:path';
import { createRequire } from 'node:module';
import { htmlToText } from '../../medicine/lib.mjs';

const require = createRequire(import.meta.url);

/** @returns {Promise<{pages: {page: number | null, text: string}[], pageCount: number | null, note: string | null}>} */
export async function extractText(buffer, ext) {
  switch (ext) {
    case 'pdf':
      return extractPdf(buffer);
    case 'docx':
      return extractDocx(buffer);
    case 'txt':
    case 'md':
      return { pages: [{ page: null, text: buffer.toString('utf8') }], pageCount: null, note: null };
    default:
      return { pages: [], pageCount: null, note: `unsupported: ${ext}` };
  }
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
  const note = empty === document.numPages ? 'no text layer (scanned?)' : empty > 0 ? `${empty} empty page(s)` : null;
  return { pages, pageCount: document.numPages, note };
}

async function extractDocx(buffer) {
  const mammoth = require('mammoth');
  const { value: html } = await mammoth.convertToHtml({ buffer });
  const text = htmlToText(
    html
      .replace(/<h([1-6])[^>]*>/gi, (_, level) => `\n\n${'#'.repeat(Number(level))} `)
      .replace(/<\/h[1-6]>/gi, '\n\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<li[^>]*>/gi, '\n• '),
  );
  return { pages: [{ page: null, text }], pageCount: null, note: text.trim() ? null : 'no text' };
}

export function titleOf(fileName) {
  return path.basename(fileName).replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').trim();
}
