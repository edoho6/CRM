// A PDF cut into parts, each a PDF of its own — for readers that take a
// few pages at a time (Vision reads five per request). The pages keep
// their numbers: a part says which page it starts and ends on.
import { PDFDocument } from 'pdf-lib';

/**
 * @param {Buffer} buffer
 * @param {number} pagesPerPart
 * @returns {Promise<{buffer: Buffer, firstPage: number, lastPage: number}[]>}
 */
export async function splitPdf(buffer, pagesPerPart) {
  const source = await PDFDocument.load(buffer, { ignoreEncryption: true, updateMetadata: false });
  const total = source.getPageCount();
  const parts = [];
  for (let first = 0; first < total; first += pagesPerPart) {
    const last = Math.min(total, first + pagesPerPart);
    const part = await PDFDocument.create();
    const pages = await part.copyPages(source, Array.from({ length: last - first }, (_, i) => first + i));
    for (const page of pages) part.addPage(page);
    parts.push({ buffer: Buffer.from(await part.save({ useObjectStreams: true })), firstPage: first + 1, lastPage: last });
  }
  return parts;
}
