// A course folder in Hebrew (Reidman College's "לימודים בסיסיים", 17.9) read to text,
// for the canon's teaching layer. Nothing is loaded here; course-build.mjs cuts and
// embeds, load.mjs --course loads.
//
//   node --max-old-space-size=8192 scripts/library/canon/course-read.mjs --drive-folder=<id> [--within=<path part>] [--only=<path part>]
//
// Every readable file, however its text is kept:
//   · the text layer of a PDF, Word, RTF or slides file (lib/extract.mjs);
//   · Google Vision for a scanned PDF, a PDF page with no text, an image, and a Word
//     or slides file whose text sits in pictures. Pages go to Vision as rendered
//     images (pdf.js + @napi-rs/canvas): its PDF route silently reads only part of
//     some pages;
//   · PowerPoint itself for an old .ppt (lib/powerpoint-convert.ps1), Word for an old .doc.
// Exams, quizzes and question banks are left out by name — the practitioner took them
// out of the course folder — and so are the English scan books, which are not the
// course. Resumable: a finished file is .cache/library/canon/course/full/<md5>.json.
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { args, env, log, root, sleep } from '../../medicine/lib.mjs';
import { READABLE, downloadFile, driveGet, driveSession, fetchWithRetry } from '../lib/drive.mjs';
import { NEEDS_OCR, extractText } from '../lib/extract.mjs';
import { docToDocx, wordAvailable } from '../lib/word.mjs';

const require = createRequire(import.meta.url);
const run = promisify(execFile);

export const COURSE_CACHE = path.join(root, '.cache', 'library', 'canon', 'course');
const FULL = path.join(COURSE_CACHE, 'full');
/** The practitioner's rule (17.9): no exam, quiz or question bank — as a whole word, since "אבחנה" holds "בחנ". */
export const EXAMS = /(^|[\s/_.-])(בחנים|בוחן|מבחנים|מבחן|למבחן|לבוחן|שאלות)/;
const ENGLISH_BOOKS = /Healing with Whole Foods|Close to the bone/i;
const PPT = 'application/vnd.ms-powerpoint';
const API = 'https://www.googleapis.com/drive/v3';
const FOLDER = 'application/vnd.google-apps.folder';
const PER_REQUEST = 8;

async function walk(token, id, prefix) {
  const out = [];
  let pageToken = null;
  do {
    const params = new URLSearchParams({
      q: `'${id}' in parents and trashed = false`,
      fields: 'nextPageToken, files(id, name, mimeType, md5Checksum, size)',
      pageSize: '1000',
      supportsAllDrives: 'true',
      includeItemsFromAllDrives: 'true',
    });
    if (pageToken) params.set('pageToken', pageToken);
    const payload = await (await driveGet(token, `${API}/files?${params}`)).json();
    for (const f of payload.files ?? []) {
      const p = prefix ? `${prefix}/${f.name}` : f.name;
      if (f.mimeType === FOLDER) out.push(...(await walk(token, f.id, p)));
      else
        out.push({
          ...f,
          path: p,
          ext: f.mimeType === PPT ? 'ppt' : (READABLE[f.mimeType]?.ext ?? null),
          exportAs: READABLE[f.mimeType]?.exportAs ?? null,
        });
    }
    pageToken = payload.nextPageToken ?? null;
  } while (pageToken);
  return out;
}

async function main() {
  const options = args();
  const folderId = String(options['drive-folder'] ?? env('CANON_DRIVE_FOLDER_ID') ?? '');
  if (!folderId) throw new Error('--drive-folder=<id> (the canon folder on Drive) is needed');
  const within = options.within ? String(options.within) : 'לימודים בסיסיים';
  const only = options.only ? String(options.only) : null;

  const { createCanvas } = require('@napi-rs/canvas');
  const JSZip = require('jszip');
  const sharp = require('sharp');
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const session = driveSession(env('GOOGLE_SERVICE_ACCOUNT_FILE'));
  fs.mkdirSync(FULL, { recursive: true });
  let visionPages = 0;

  async function vision(images) {
    const body = JSON.stringify({
      requests: images.map((b) => ({
        image: { content: b.toString('base64') },
        features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
        imageContext: { languageHints: ['he', 'en'] },
      })),
    });
    for (let attempt = 1; ; attempt += 1) {
      const response = await fetchWithRetry('https://vision.googleapis.com/v1/images:annotate', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${await session.token()}`,
          'content-type': 'application/json',
        },
        body,
      });
      if (response.ok) {
        visionPages += images.length;
        return (await response.json()).responses.map((r) =>
          r.error ? { error: r.error.message } : { text: r.fullTextAnnotation?.text ?? '' },
        );
      }
      if (response.status === 401 && attempt === 1) {
        await session.renew();
        continue;
      }
      if ((response.status === 429 || response.status >= 500) && attempt < 8) {
        await sleep(attempt * 5000);
        continue;
      }
      throw new Error(`vision ${response.status}`);
    }
  }

  /** Eight images a request, and under ~6.5 MB of pictures in one. */
  async function ocrImages(images) {
    const out = [];
    let group = [];
    let size = 0;
    const flush = async () => {
      if (group.length) out.push(...(await vision(group)));
      group = [];
      size = 0;
    };
    for (const img of images) {
      if (group.length >= PER_REQUEST || size + img.length > 6_500_000) await flush();
      group.push(img);
      size += img.length;
    }
    await flush();
    return out;
  }

  const toJpeg = (buffer) =>
    sharp(buffer, { limitInputPixels: false })
      .rotate()
      .resize({ width: 2200, height: 2200, fit: 'inside', withoutEnlargement: true })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: 85 })
      .toBuffer();

  async function renderPdfPages(buffer, numbers) {
    const doc = await pdfjs.getDocument({
      data: new Uint8Array(buffer),
      isEvalSupported: false,
      verbosity: 0,
    }).promise;
    const out = [];
    for (const n of numbers) {
      const page = await doc.getPage(n);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({
        scale: Math.min(3, 1800 / Math.max(base.width, base.height)),
      });
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport }).promise;
      out.push({ n, jpeg: await canvas.encode('jpeg', 85) });
      page.cleanup();
    }
    await doc.destroy();
    return out;
  }

  /** PowerPoint is started per file; a second try covers the moment it is still closing from the last one. */
  async function pptToPptx(buffer) {
    const script = fileURLToPath(new URL('../lib/powerpoint-convert.ps1', import.meta.url));
    for (let attempt = 1; ; attempt += 1) {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'herbalist-ppt-'));
      try {
        fs.writeFileSync(path.join(dir, 'in.ppt'), buffer);
        await run(
          'powershell',
          [
            '-NoProfile',
            '-NonInteractive',
            '-ExecutionPolicy',
            'Bypass',
            '-File',
            script,
            path.join(dir, 'in.ppt'),
            path.join(dir, 'out.pptx'),
          ],
          { timeout: 120_000, windowsHide: true },
        );
        return fs.readFileSync(path.join(dir, 'out.pptx'));
      } catch (error) {
        if (attempt >= 3) throw error;
        await sleep(5000);
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    }
  }

  async function mediaImages(buffer, prefix) {
    const zip = await JSZip.loadAsync(buffer);
    const out = [];
    for (const name of Object.keys(zip.files).filter(
      (n) => n.startsWith(prefix) && /\.(png|jpe?g|gif|bmp|tiff?)$/i.test(n),
    )) {
      const raw = await zip.file(name).async('nodebuffer');
      if (raw.length < 20_000) continue; // icons and bullets
      try {
        out.push(await toJpeg(raw));
      } catch {
        // not a picture sharp reads
      }
    }
    return out;
  }

  const listing = (await walk(session.token, folderId, '')).filter((f) => f.path.includes(within));
  fs.writeFileSync(path.join(COURSE_CACHE, 'listing.json'), JSON.stringify(listing, null, 1));
  const report = [];
  const seen = new Set();
  for (const file of listing) {
    if (!file.ext || file.name.startsWith('~$')) continue;
    if (only && !file.path.includes(only)) continue;
    const row = { path: file.path, ext: file.ext, md5: file.md5Checksum };
    report.push(row);
    if (EXAMS.test(file.path)) row.status = 'skipped: exam or quiz';
    else if (ENGLISH_BOOKS.test(file.path)) row.status = 'skipped: English book';
    else if (seen.has(file.md5Checksum)) row.status = 'duplicate';
    if (row.status) continue;
    seen.add(file.md5Checksum);
    const target = path.join(FULL, `${file.md5Checksum}.json`);
    if (fs.existsSync(target)) {
      Object.assign(row, JSON.parse(fs.readFileSync(target, 'utf8')).row);
      continue;
    }
    try {
      let buffer = null;
      const bytes = async () => (buffer ??= await downloadFile(session.token, file));
      let ex;
      if (file.ext === 'ppt') ex = await extractText(await pptToPptx(await bytes()), 'pptx');
      else if (file.ext === 'image') ex = { pages: [], pageCount: 1, note: NEEDS_OCR };
      else {
        try {
          ex = await extractText(await bytes(), file.ext);
        } catch (error) {
          if (file.ext !== 'doc') throw error;
          ex = { pages: [], pageCount: null, note: 'doc' };
        }
        if (file.ext === 'doc' && !ex.pages.length && (await wordAvailable()))
          ex = await extractText(await docToDocx(await bytes()), 'docx');
      }
      let pages = ex.pages.map((p) => ({ ...p, via: 'text' }));
      let ocrFailed = 0;
      if (file.ext === 'pdf' && (ex.note === NEEDS_OCR || /empty page/.test(ex.note ?? ''))) {
        const empty =
          ex.note === NEEDS_OCR
            ? Array.from({ length: ex.pageCount }, (_, i) => i + 1)
            : ex.pages.filter((p) => !p.text.trim()).map((p) => p.page);
        pages = pages.filter((p) => p.text.trim());
        for (let i = 0; i < empty.length; i += PER_REQUEST) {
          const rendered = await renderPdfPages(await bytes(), empty.slice(i, i + PER_REQUEST));
          const answers = await ocrImages(rendered.map((r) => r.jpeg));
          rendered.forEach((r, k) =>
            answers[k].error
              ? (ocrFailed += 1)
              : pages.push({ page: r.n, text: answers[k].text.trim(), via: 'ocr' }),
          );
        }
        pages.sort((a, b) => a.page - b.page);
      } else if (file.ext === 'image') {
        const [answer] = await ocrImages([await toJpeg(await bytes())]);
        if (answer.error) ocrFailed += 1;
        else pages = [{ page: 1, text: answer.text.trim(), via: 'ocr' }];
      } else if (['docx', 'pptx', 'ppt'].includes(file.ext) && !pages.some((p) => p.text.trim())) {
        const source = file.ext === 'ppt' ? await pptToPptx(await bytes()) : await bytes();
        const answers = await ocrImages(
          await mediaImages(source, file.ext === 'docx' ? 'word/media/' : 'ppt/media/'),
        );
        answers.forEach((a, k) =>
          a.error
            ? (ocrFailed += 1)
            : pages.push({ page: k + 1, text: a.text.trim(), via: 'ocr (pictures)' }),
        );
      }
      const text = pages.map((p) => p.text).join('\n');
      Object.assign(row, {
        status: text.trim() ? 'text' : 'no text',
        pages: ex.pageCount ?? pages.length,
        textPages: pages.filter((p) => p.via === 'text' && p.text.trim()).length,
        ocrPages: pages.filter((p) => p.via.startsWith('ocr')).length,
        emptyAfter: pages.filter((p) => !p.text.trim()).length,
        ocrFailed,
        chars: text.length,
        hebrew: (text.match(/[א-ת]/g) ?? []).length,
      });
      fs.writeFileSync(target, JSON.stringify({ row, pages }));
    } catch (error) {
      row.status = 'failed';
      row.error = String(error.message).slice(0, 200);
    }
    log(
      `${report.length}: ${row.status}${row.ocrPages ? `, ${row.ocrPages} by OCR` : ''} — ${file.name}`,
    );
    fs.writeFileSync(path.join(COURSE_CACHE, 'report.json'), JSON.stringify(report, null, 1));
  }
  fs.writeFileSync(path.join(COURSE_CACHE, 'report.json'), JSON.stringify(report, null, 1));
  const count = (s) => report.filter((r) => r.status === s).length;
  log(
    `done: ${count('text')} read, ${count('failed')} failed, ${count('no text')} without text, ${visionPages} pages by Vision`,
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  await main();
  process.exit(0);
}
