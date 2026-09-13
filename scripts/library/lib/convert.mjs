// Google Drive as the reader of last resort.
//
// A scanned PDF has no text layer; an image is only pixels. Drive reads
// both: a file uploaded as a Google document is passed through Google's
// OCR on the way in (Hebrew and English alike), the text is exported, and
// the document is deleted at once.
//
// Where the copy lives while it is read: a service account has no Drive
// storage of its own any more, so the copy is created inside a folder the
// practitioner made for it and shared with the account as an editor
// (LIBRARY_OCR_FOLDER_ID) — a folder that holds nothing else, where every
// file the account creates is removed seconds later. The token must carry
// the drive.file scope for that, which lets the account create and delete
// files of its own and touch nothing else.
//
// A scanned book is far larger than one conversion accepts, so a PDF is
// cut into parts of a few pages each (pdf-lib), and each part is read on
// its own; the passages then know the page they start on to within a part.
// Resumable upload throughout, because a multipart upload is capped at
// five megabytes.
import { sleep } from '../../medicine/lib.mjs';

const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
const API = 'https://www.googleapis.com/drive/v3';
const GOOGLE_DOC = 'application/vnd.google-apps.document';

/** Pages per part when a PDF is cut for OCR: small enough for every scan, close enough for page references. */
export const OCR_PAGES_PER_PART = 12;

async function call(token, url, init = {}, label = 'drive') {
  for (let attempt = 1; ; attempt += 1) {
    const response = await fetch(url, { ...init, headers: { authorization: `Bearer ${token}`, ...(init.headers ?? {}) } });
    if (response.ok) return response;
    if ((response.status === 429 || response.status >= 500) && attempt < 6) {
      await sleep(attempt * 5000);
      continue;
    }
    const detail = await response.text().catch(() => '');
    throw new Error(`${label} ${response.status}${detail ? `: ${detail.slice(0, 160).replace(/\s+/g, ' ')}` : ''}`);
  }
}

/**
 * One file through Drive's OCR: uploaded as a Google document into the OCR
 * folder, exported as text, deleted. `ocrLanguage` is a hint; Google still
 * spells Hebrew 'iw' here ('he' is refused), and Hebrew pages with English
 * terms come out fine with it.
 * @param {string} token
 * @param {Buffer} buffer
 * @param {{name: string, mimeType: string, folderId: string, ocrLanguage?: string}} file
 * @returns {Promise<string>}
 */
export async function ocrThroughDrive(token, buffer, { name, mimeType, folderId, ocrLanguage = 'iw' }) {
  if (!folderId) throw new Error('no OCR folder (LIBRARY_OCR_FOLDER_ID)');
  const metadata = JSON.stringify({ name: `convert-${name}`.slice(0, 120), mimeType: GOOGLE_DOC, parents: [folderId] });
  const start = await call(
    token,
    `${UPLOAD}?${new URLSearchParams({ uploadType: 'resumable', fields: 'id', ocrLanguage, supportsAllDrives: 'true' })}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=UTF-8', 'x-upload-content-type': mimeType, 'x-upload-content-length': String(buffer.length) },
      body: metadata,
    },
    'drive upload start',
  );
  const location = start.headers.get('location');
  if (!location) throw new Error('drive upload: no session');
  const done = await call(token, location, { method: 'PUT', headers: { 'content-type': mimeType, 'content-length': String(buffer.length) }, body: buffer }, 'drive upload');
  const { id } = await done.json();
  try {
    const exported = await call(token, `${API}/files/${id}/export?${new URLSearchParams({ mimeType: 'text/plain' })}`, {}, 'drive export');
    return (await exported.text()).replace(/^﻿/, '');
  } finally {
    // The copy is gone the moment the text is out.
    await fetch(`${API}/files/${id}?supportsAllDrives=true`, { method: 'DELETE', headers: { authorization: `Bearer ${token}` } }).catch(() => {});
  }
}

/**
 * A PDF in parts of `pagesPerPart` pages, each a PDF of its own.
 * @returns {Promise<{buffer: Buffer, firstPage: number, lastPage: number}[]>}
 */
export async function splitPdf(buffer, pagesPerPart = OCR_PAGES_PER_PART) {
  const { PDFDocument } = await import('pdf-lib');
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

/**
 * A scanned PDF read by OCR, part by part. Each part's text becomes one
 * "page" numbered by the part's first page, so a citation points to
 * within a dozen pages of the passage.
 * @param {string} token
 * @param {Buffer} buffer
 * @param {{name: string, folderId: string, onPart?: (done: number, total: number) => void}} options
 * @returns {Promise<{pages: {page: number, text: string}[], pageCount: number}>}
 */
export async function ocrPdf(token, buffer, { name, folderId, onPart }) {
  const parts = await splitPdf(buffer);
  const pages = [];
  for (const [index, part] of parts.entries()) {
    const text = await ocrThroughDrive(token, part.buffer, { name: `${name}.part${index + 1}.pdf`, mimeType: 'application/pdf', folderId });
    const clean = text.replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    if (clean) pages.push({ page: part.firstPage, text: clean });
    onPart?.(index + 1, parts.length);
  }
  return { pages, pageCount: parts.length ? parts[parts.length - 1].lastPage : 0 };
}

/**
 * An old Word file (.doc), an RTF or anything else Drive turns into a
 * document: the same road as OCR, without the OCR — Drive converts on the
 * way in and the text comes out.
 */
export async function convertThroughDrive(token, buffer, { name, mimeType, folderId }) {
  const text = await ocrThroughDrive(token, buffer, { name, mimeType, folderId });
  const clean = text.replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return { pages: clean ? [{ page: null, text: clean }] : [], pageCount: null };
}

/** An image read by OCR: one page. */
export async function ocrImage(token, buffer, { name, mimeType, folderId }) {
  const text = await ocrThroughDrive(token, buffer, { name, mimeType, folderId });
  const clean = text.replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return { pages: clean ? [{ page: null, text: clean }] : [], pageCount: null };
}
