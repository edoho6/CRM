// The library's files, read, cut into passages, embedded and loaded.
//
//   node scripts/library/ingest.mjs                 # the Drive folder in .env.local
//   node scripts/library/ingest.mjs --folder "C:\path\to\folder"
//   node scripts/library/ingest.mjs --dry           # read and cut, load nothing
//   node scripts/library/ingest.mjs --limit=20      # the first twenty files only
//   node scripts/library/ingest.mjs --only=word     # files whose path contains the word
//   node scripts/library/ingest.mjs --refresh       # even files that have not changed
//
// From Drive it needs GOOGLE_SERVICE_ACCOUNT_FILE (the key file's path) and
// LIBRARY_DRIVE_FOLDER_ID in apps/web/.env.local; the folder must be shared
// with the service account. Embeddings need VOYAGE_API_KEY. Loading asks for
// the platform admin's email and password at the terminal, like the
// medicine import, and never keeps them.
//
// What is read: PDF, Word (.docx and .doc), RTF, slides, spreadsheets,
// EPUB, plain text and Markdown, and Google's own documents, slides and
// sheets. A scanned PDF or an image has no text to read, so it goes through
// Drive's OCR (lib/convert.mjs) when LIBRARY_OCR_FOLDER_ID names a folder
// the service account may write in; without one, such files are counted and
// named, and left for later.
//
// A file that has not changed since the last run (same content hash) is
// skipped; a file that is gone from the folder is removed from the library
// when the whole folder was read. .cache/library holds the hashes, the
// extracted text (so OCR runs once) and the embeddings, so a re-run pays
// only for what is new.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { args, cacheDir as medicineCache, env, log, readJson, writeJson } from '../medicine/lib.mjs';
import { chunkPages } from './lib/chunk.mjs';
import { convertThroughDrive, ocrImage, ocrPdf } from './lib/convert.mjs';
import { downloadFile, driveToken, listFolder, READABLE } from './lib/drive.mjs';
import { EXTENSION_KINDS, EXTENSION_MIME, NEEDS_OCR, extractText, titleOf } from './lib/extract.mjs';
import { connectAsAdmin, removeSource, uploadSource } from './lib/upload.mjs';
import { embedTexts } from './lib/voyage.mjs';

const cacheDir = path.join(path.dirname(medicineCache), 'library');
const manifestPath = path.join(cacheDir, 'manifest.json');
const textDir = path.join(cacheDir, 'text');
/** Bumped when the readers change, so cached text is read again. */
const EXTRACT_VERSION = 2;

const options = args();
const limit = Number(options.limit ?? 0) || Infinity;
const dry = Boolean(options.dry);
const refresh = Boolean(options.refresh);
const only = options.only ? String(options.only) : null;

function walkLocal(folder) {
  const files = [];
  const visit = (dir, prefix) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.name.startsWith('.') || entry.name.startsWith('~$')) continue;
      const full = path.join(dir, entry.name);
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) visit(full, rel);
      else {
        const extension = entry.name.split('.').pop().toLowerCase();
        const ext = EXTENSION_KINDS[extension];
        if (ext) files.push({ locator: `file:${rel}`, path: rel, ext, mimeType: EXTENSION_MIME[extension] ?? null, read: async () => fs.readFileSync(full), modified: fs.statSync(full).mtime.toISOString() });
      }
    }
  };
  visit(folder, '');
  return files;
}

async function listDrive() {
  const keyFile = env('GOOGLE_SERVICE_ACCOUNT_FILE');
  const folderId = env('LIBRARY_DRIVE_FOLDER_ID');
  if (!keyFile || !folderId) throw new Error('GOOGLE_SERVICE_ACCOUNT_FILE and LIBRARY_DRIVE_FOLDER_ID are needed (apps/web/.env.local), or pass --folder');
  if (!fs.existsSync(keyFile)) throw new Error(`the service account key file is not at ${keyFile}`);
  const { token, email } = await driveToken(keyFile);
  log(`drive: reading as ${email}`);
  const files = await listFolder(token, folderId);
  const skipped = Object.entries(files.skipped ?? {}).sort((a, b) => b[1] - a[1]);
  log(`drive: ${files.length} readable file(s) in the folder (${Object.keys(READABLE).length} kinds are read)`);
  if (skipped.length) log(`drive: left out — ${skipped.map(([kind, n]) => `${n} × ${kind}`).join(', ')}`);
  return {
    token,
    files: files
      .sort((a, b) => a.path.localeCompare(b.path))
      .map((file) => ({ locator: `drive:${file.id}`, path: file.path, ext: file.ext, mimeType: file.exportAs ?? file.mimeType, modified: file.modifiedTime, read: async () => downloadFile(token, file) })),
  };
}

/** The extracted text of a file, cached by its content hash so OCR runs once. */
function cachedText(sha256) {
  const cached = readJson(path.join(textDir, `${sha256}.json`));
  return cached && cached.version === EXTRACT_VERSION ? cached : null;
}

function cacheText(sha256, extracted) {
  fs.mkdirSync(textDir, { recursive: true });
  writeJson(path.join(textDir, `${sha256}.json`), { version: EXTRACT_VERSION, ...extracted });
}

async function main() {
  const voyageKey = env('VOYAGE_API_KEY');
  if (!voyageKey) throw new Error('VOYAGE_API_KEY is not set (apps/web/.env.local)');
  fs.mkdirSync(cacheDir, { recursive: true });
  const manifest = readJson(manifestPath, { sources: {} });

  const source = options.folder ? { token: null, files: walkLocal(String(options.folder)) } : await listDrive();
  const ocrFolder = env('LIBRARY_OCR_FOLDER_ID') || null;
  // OCR needs a Drive token even for a local folder: the service account does the reading.
  const ocrToken = source.token ?? (ocrFolder && env('GOOGLE_SERVICE_ACCOUNT_FILE') && fs.existsSync(env('GOOGLE_SERVICE_ACCOUNT_FILE')) ? (await driveToken(env('GOOGLE_SERVICE_ACCOUNT_FILE'))).token : null);
  const ocrReady = Boolean(ocrFolder && ocrToken);
  if (!ocrReady) log('ingest: no OCR folder (LIBRARY_OCR_FOLDER_ID) — scanned PDFs and images will be counted, not read');

  const files = source.files;
  const seen = new Set(files.map((f) => f.locator));
  const todo = files.filter((f) => !only || f.path.includes(only)).slice(0, limit);
  log(`ingest: ${files.length} file(s), ${todo.length} to look at${dry ? ' (dry run)' : ''}`);

  let supabase = null;
  const admin = async () => (supabase ??= await connectAsAdmin());
  const summary = { unchanged: 0, loaded: 0, empty: 0, needsOcr: 0, ocr: 0, failed: 0, removed: 0, chunks: 0, tokens: 0 };
  const needsOcr = [];

  for (const file of todo) {
    try {
      const buffer = await file.read();
      if (buffer.length === 0) {
        summary.empty += 1;
        log(`ingest: ${file.path} — empty file`);
        continue;
      }
      const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
      const known = manifest.sources[file.locator];
      if (known && known.sha256 === sha256 && !refresh) {
        summary.unchanged += 1;
        continue;
      }
      let extracted = cachedText(sha256);
      if (!extracted) {
        try {
          extracted = await extractText(buffer, file.ext);
        } catch (error) {
          // An old Word file the local reader cannot open: Drive can. Anything else is a failure.
          if (file.ext !== 'doc') throw error;
          extracted = { pages: [], pageCount: null, note: `doc: ${error.message.slice(0, 80)}` };
        }
        if (file.ext === 'doc' && extracted.pages.length === 0 && ocrReady) {
          const read = await convertThroughDrive(ocrToken, buffer, { name: path.basename(file.path), mimeType: 'application/msword', folderId: ocrFolder });
          extracted = { pages: read.pages, pageCount: null, note: read.pages.length ? 'converted by Drive' : 'Drive found no text' };
        }
        if (extracted.pages.length === 0 && extracted.note === NEEDS_OCR) {
          if (!ocrReady) {
            summary.needsOcr += 1;
            needsOcr.push(file.path);
            log(`ingest: ${file.path} — needs OCR (no text layer); skipped for now`);
            continue;
          }
          const name = path.basename(file.path);
          const read =
            file.ext === 'image'
              ? await ocrImage(ocrToken, buffer, { name, mimeType: file.mimeType ?? 'image/jpeg', folderId: ocrFolder })
              : await ocrPdf(ocrToken, buffer, { name, folderId: ocrFolder, onPart: (done, total) => (total > 1 ? log(`ingest: ${file.path} — OCR part ${done}/${total}`) : null) });
          extracted = { pages: read.pages, pageCount: read.pageCount, note: read.pages.length ? 'read by OCR' : 'OCR found no text' };
          summary.ocr += 1;
        }
        cacheText(sha256, extracted);
      }
      const { pages, pageCount, note } = extracted;
      const chunks = chunkPages(pages);
      if (chunks.length === 0) {
        summary.empty += 1;
        log(`ingest: ${file.path} — nothing to read${note ? ` (${note})` : ''}`);
        continue;
      }
      const { embeddings, cached, tokens } = await embedTexts(voyageKey, chunks.map((c) => (c.heading ? `${c.heading}\n${c.content}` : c.content)), {
        cacheDir: path.join(cacheDir, 'embeddings'),
      });
      summary.tokens += tokens;
      const rows = chunks.map((c, i) => ({ ...c, embedding: embeddings[i] }));
      const row = {
        kind: 'file',
        locator: file.locator,
        title: titleOf(file.path),
        url: null,
        sha256,
        bytes: buffer.length,
        pages: pageCount,
        language: null,
        licence_note: null,
        fetched_at: new Date().toISOString(),
      };
      if (dry) {
        log(`ingest: ${file.path} — ${chunks.length} passage(s), ${cached} embedding(s) cached${note ? ` (${note})` : ''}`);
        continue;
      }
      const { id, added } = await uploadSource(await admin(), row, rows);
      manifest.sources[file.locator] = { id, sha256, title: row.title, chunks: added, loadedAt: row.fetched_at };
      writeJson(manifestPath, manifest);
      summary.loaded += 1;
      summary.chunks += added;
      log(`ingest: ${file.path} — ${added} passage(s) loaded${note ? ` (${note})` : ''}`);
    } catch (error) {
      summary.failed += 1;
      log(`ingest: ${file.path} — FAILED: ${error.message}`);
    }
  }

  // Gone from the folder, gone from the library — only when the whole folder was read.
  if (!dry && !only && todo.length === files.length) {
    for (const [locator, known] of Object.entries(manifest.sources)) {
      if (seen.has(locator) || !known.id) continue;
      try {
        await removeSource(await admin(), known.id, known.title);
        delete manifest.sources[locator];
        summary.removed += 1;
        log(`ingest: ${known.title} — removed (no longer in the folder)`);
      } catch (error) {
        log(`ingest: ${known.title} — could not remove: ${error.message}`);
      }
    }
    writeJson(manifestPath, manifest);
  }

  if (needsOcr.length) writeJson(path.join(cacheDir, 'needs-ocr.json'), needsOcr);
  if (supabase) await supabase.auth.signOut();
  log(
    `ingest: done — ${summary.loaded} loaded (${summary.chunks} passages, ${summary.tokens} embedding tokens), ${summary.unchanged} unchanged, ` +
      `${summary.ocr} read by OCR, ${summary.needsOcr} waiting for OCR, ${summary.empty} empty, ${summary.failed} failed, ${summary.removed} removed`,
  );
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exitCode = 1;
});
