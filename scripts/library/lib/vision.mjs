// Google Cloud Vision as the reader of scans.
//
// A scanned PDF has no text layer; an image is only pixels. Vision reads
// both (Hebrew and English alike, tables and columns included) and says
// which page each line came from. It runs under the same service account
// as Drive, in the same Google Cloud project, once the Vision API is
// enabled there and the project has billing: the first thousand pages a
// month are free, and a thousand more cost about a dollar and a half.
//
// PDFs go up inline, five pages at a time — the most one request takes —
// cut with pdf-lib; images go up one at a time. Nothing is stored on
// Google's side: the request carries the bytes and the reply the text.
import { sleep } from '../../medicine/lib.mjs';
import { fetchWithRetry, resolveToken } from './drive.mjs';
import { splitPdf } from './pdf.mjs';

const ENDPOINT = 'https://vision.googleapis.com/v1';
/** Vision reads at most five pages of a PDF in one request. */
export const VISION_PAGES_PER_REQUEST = 5;
const FEATURES = [{ type: 'DOCUMENT_TEXT_DETECTION' }];
const CONTEXT = { languageHints: ['he', 'en'] };

async function annotate(token, path, body) {
  const payload = JSON.stringify(body);
  let renewed = false;
  for (let attempt = 1; ; attempt += 1) {
    const bearer = await resolveToken(token);
    const response = await fetchWithRetry(`${ENDPOINT}/${path}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${bearer}`, 'content-type': 'application/json' },
      body: payload,
    });
    if (response.ok) return response.json();
    if (response.status === 401 && !renewed && typeof token === 'function' && token.renew) {
      renewed = true;
      await token.renew();
      continue;
    }
    if ((response.status === 429 || response.status >= 500) && attempt < 6) {
      await sleep(attempt * 5000);
      continue;
    }
    const detail = await response.text().catch(() => '');
    const message = detail.match(/"message":\s*"([^"]+)"/)?.[1] ?? detail.slice(0, 200);
    throw new Error(`vision ${response.status}: ${message}`);
  }
}

function cleanText(text) {
  return String(text ?? '').replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * A scanned PDF, page by page.
 * @param {string} token
 * @param {Buffer} buffer
 * @param {{onPart?: (done: number, total: number) => void}} [options]
 * @returns {Promise<{pages: {page: number, text: string}[], pageCount: number}>}
 */
export async function visionPdf(token, buffer, { onPart } = {}) {
  const parts = await splitPdf(buffer, VISION_PAGES_PER_REQUEST);
  const pages = [];
  for (const [index, part] of parts.entries()) {
    const payload = await annotate(token, 'files:annotate', {
      requests: [
        {
          inputConfig: { content: part.buffer.toString('base64'), mimeType: 'application/pdf' },
          features: FEATURES,
          imageContext: CONTEXT,
        },
      ],
    });
    const answers = payload.responses?.[0]?.responses ?? [];
    for (const answer of answers) {
      if (answer.error) throw new Error(`vision: ${answer.error.message ?? 'page error'}`);
      const text = cleanText(answer.fullTextAnnotation?.text);
      const page = part.firstPage + ((answer.context?.pageNumber ?? 1) - 1);
      if (text) pages.push({ page, text });
    }
    onPart?.(index + 1, parts.length);
  }
  pages.sort((a, b) => a.page - b.page);
  return { pages, pageCount: parts.length ? parts[parts.length - 1].lastPage : 0 };
}

/**
 * An image: one page.
 * @returns {Promise<{pages: {page: number | null, text: string}[], pageCount: null}>}
 */
export async function visionImage(token, buffer) {
  const payload = await annotate(token, 'images:annotate', {
    requests: [{ image: { content: buffer.toString('base64') }, features: FEATURES, imageContext: CONTEXT }],
  });
  const answer = payload.responses?.[0] ?? {};
  if (answer.error) throw new Error(`vision: ${answer.error.message ?? 'image error'}`);
  const text = cleanText(answer.fullTextAnnotation?.text);
  return { pages: text ? [{ page: null, text }] : [], pageCount: null };
}
