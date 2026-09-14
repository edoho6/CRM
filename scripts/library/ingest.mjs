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
// What is read: PDF, Word (.docx, and .doc — through Word itself when the
// plain reader cannot open it), RTF, slides, spreadsheets, EPUB, plain text
// and Markdown, and Google's own documents, slides and sheets. A scanned
// PDF or an image has no text to read, so it goes to Google Cloud Vision
// (lib/vision.mjs) under the same service account, once the Vision API is
// enabled for the project; until then such files are counted and named in
// .cache/library/needs-ocr.json, and left for a later run.
//
// A file that has not changed since the last run (same content hash) is
// skipped; a file that is gone from the folder is removed from the library
// when the whole folder was read; a file that sits in several folders is
// loaded once, and its other copies are left out or, if an earlier run
// loaded them, removed. .cache/library holds the hashes, the extracted
// text (so OCR runs once) and the embeddings, so a re-run pays only for
// what is new.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { args, cacheDir as medicineCache, env, log, readJson, writeJson } from '../medicine/lib.mjs';
import { chunkPages } from './lib/chunk.mjs';
import { downloadFile, driveSession, listFolder, READABLE } from './lib/drive.mjs';
import { EXTENSION_KINDS, NEEDS_OCR, extractText, titleOf } from './lib/extract.mjs';
import { connectAsAdmin, removeSource, uploadSource } from './lib/upload.mjs';
import { visionImage, visionPdf } from './lib/vision.mjs';
import { embedTexts } from './lib/voyage.mjs';
import { docToDocx, wordAvailable } from './lib/word.mjs';

const cacheDir = path.join(path.dirname(medicineCache), 'library');
const manifestPath = path.join(cacheDir, 'manifest.json');
const textDir = path.join(cacheDir, 'text');
/** Bumped when the readers change, so cached text is read again. */
const EXTRACT_VERSION = 3;

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
        const ext = EXTENSION_KINDS[entry.name.split('.').pop().toLowerCase()];
        if (ext) files.push({ locator: `file:${rel}`, path: rel, ext, read: async () => fs.readFileSync(full), modified: fs.statSync(full).mtime.toISOString() });
      }
    }
  };
  visit(folder, '');
  return files;
}

function keyFileOrNull() {
  const keyFile = env('GOOGLE_SERVICE_ACCOUNT_FILE');
  return keyFile && fs.existsSync(keyFile) ? keyFile : null;
}

async function listDrive() {
  const keyFile = env('GOOGLE_SERVICE_ACCOUNT_FILE');
  const folderId = env('LIBRARY_DRIVE_FOLDER_ID');
  if (!keyFile || !folderId) throw new Error('GOOGLE_SERVICE_ACCOUNT_FILE and LIBRARY_DRIVE_FOLDER_ID are needed (apps/web/.env.local), or pass --folder');
  if (!fs.existsSync(keyFile)) throw new Error(`the service account key file is not at ${keyFile}`);
  const session = driveSession(keyFile);
  const token = Object.assign(session.token, { renew: session.renew });
  log(`drive: reading as ${await session.email()}`);
  const files = await listFolder(token, folderId);
  const skipped = Object.entries(files.skipped ?? {}).sort((a, b) => b[1] - a[1]);
  log(`drive: ${files.length} readable file(s) in the folder (${Object.keys(READABLE).length} kinds are read)`);
  if (skipped.length) log(`drive: left out — ${skipped.map(([kind, n]) => `${n} × ${kind}`).join(', ')}`);
  return {
    token,
    files: files
      .sort((a, b) => a.path.localeCompare(b.path))
      .map((file) => ({
        locator: `drive:${file.id}`,
        path: file.path,
        ext: file.ext,
        modified: file.modifiedTime,
        // Drive's own checksum, for every file it stores as bytes (a Google document has none): a
        // file whose text is already cached is never downloaded again.
        hash: file.exportAs ? null : file.md5Checksum ?? null,
        size: Number(file.size ?? 0) || null,
        read: async () => downloadFile(token, file),
      })),
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

/** Vision's own words for "not enabled" and "no billing": the run goes on without it, once told. */
const VISION_OFF = /has not been used|is disabled|billing|PERMISSION_DENIED|not been enabled/i;

async function main() {
  const voyageKey = env('VOYAGE_API_KEY');
  if (!voyageKey) throw new Error('VOYAGE_API_KEY is not set (apps/web/.env.local)');
  fs.mkdirSync(cacheDir, { recursive: true });
  const manifest = readJson(manifestPath, { sources: {} });

  const source = options.folder ? { token: null, files: walkLocal(String(options.folder)) } : await listDrive();
  // OCR runs under the service account even for a local folder.
  let visionToken = source.token ?? (keyFileOrNull() ? (() => { const s = driveSession(keyFileOrNull()); return Object.assign(s.token, { renew: s.renew }); })() : null);
  if (!visionToken) log('ingest: no service account key — scanned PDFs and images will be counted, not read');
  const word = await wordAvailable();
  if (!word) log('ingest: Word is not installed here — an old .doc the plain reader cannot open will be counted as failed');

  const files = source.files;
  const seen = new Set(files.map((f) => f.locator));
  const todo = files.filter((f) => !only || f.path.includes(only)).slice(0, limit);
  log(`ingest: ${files.length} file(s), ${todo.length} to look at${dry ? ' (dry run)' : ''}`);

  let supabase = null;
  const admin = async () => (supabase ??= await connectAsAdmin());
  const summary = { unchanged: 0, loaded: 0, empty: 0, needsOcr: 0, ocr: 0, word: 0, failed: 0, removed: 0, duplicates: 0, chunks: 0, tokens: 0 };
  const needsOcr = [];
  const failed = [];

  // One copy of each file. The same book sitting in several folders came in once per folder —
  // half of the first library was copies, each taking the search's few slots with the same
  // passage. The first path (in folder order) is the one that is loaded; every other copy is
  // left out, and a copy that an earlier run did load is removed once the kept one is in.
  // Drive's checksum decides for files it stores as bytes; a Google document has none, so it is
  // judged by the hash of its export, after reading.
  const firstByHash = new Map();
  const pathByLocator = new Map(files.map((f) => [f.locator, f.path]));
  for (const f of files) if (f.hash && !firstByHash.has(f.hash)) firstByHash.set(f.hash, f.locator);
  const copyOf = (locator, sha256) => {
    const first = firstByHash.get(sha256);
    if (!first) {
      firstByHash.set(sha256, locator);
      return null;
    }
    return first === locator ? null : first;
  };

  for (const file of todo) {
    try {
      // The bytes are fetched once, and only when something needs them.
      let buffer = null;
      const read = async () => (buffer ??= await file.read());
      // The content fingerprint: Drive's checksum when it has one, else a hash of the bytes. It is
      // what the manifest and the text cache are keyed by (the column is called sha256 either way).
      const sha256 = file.hash ?? crypto.createHash('sha256').update(await read()).digest('hex');
      const known = manifest.sources[file.locator];
      const first = copyOf(file.locator, sha256);
      if (first) {
        summary.duplicates += 1;
        const kept = manifest.sources[first];
        // Drive allows two files of one name in one folder; naming the path alone would read as "a copy of itself".
        const firstPath = pathByLocator.get(first) ?? first;
        const keptPath = firstPath === file.path ? `another file of the same name in that folder` : firstPath;
        if (!known?.id) {
          log(`ingest: ${file.path} — a copy of ${keptPath}; left out`);
        } else if (!kept?.id) {
          log(`ingest: ${file.path} — a copy of ${keptPath}, which is not loaded; kept for now`);
        } else if (dry) {
          log(`ingest: ${file.path} — a copy of ${keptPath}; would be removed`);
        } else {
          await removeSource(await admin(), known.id, known.title);
          delete manifest.sources[file.locator];
          writeJson(manifestPath, manifest);
          summary.removed += 1;
          log(`ingest: ${file.path} — a copy of ${keptPath}; removed, the copy there stays`);
        }
        continue;
      }
      if (known && known.sha256 === sha256 && !refresh) {
        summary.unchanged += 1;
        continue;
      }
      let extracted = cachedText(sha256);
      if (!extracted) {
        if ((await read()).length === 0) {
          summary.empty += 1;
          log(`ingest: ${file.path} — empty file`);
          continue;
        }
        try {
          extracted = await extractText(await read(), file.ext);
        } catch (error) {
          // An old Word file the plain reader cannot open: Word can. Anything else is a failure.
          if (file.ext !== 'doc') throw error;
          extracted = { pages: [], pageCount: null, note: `doc: ${error.message.slice(0, 80)}` };
        }
        if (file.ext === 'doc' && extracted.pages.length === 0 && word) {
          extracted = await extractText(await docToDocx(await read()), 'docx');
          extracted.note = extracted.pages.length ? 'converted by Word' : 'Word found no text';
          summary.word += 1;
        }
        if (extracted.pages.length === 0 && extracted.note === NEEDS_OCR) {
          if (!visionToken) {
            summary.needsOcr += 1;
            needsOcr.push(file.path);
            log(`ingest: ${file.path} — needs OCR (no text layer); skipped for now`);
            continue;
          }
          try {
            const ocr =
              file.ext === 'image'
                ? await visionImage(visionToken, await read())
                : await visionPdf(visionToken, await read(), { onPart: (done, total) => (total > 4 && done % 10 === 0 ? log(`ingest: ${file.path} — OCR ${done}/${total}`) : null) });
            extracted = { pages: ocr.pages, pageCount: ocr.pageCount, note: ocr.pages.length ? 'read by OCR' : 'OCR found no text' };
            summary.ocr += 1;
          } catch (error) {
            if (/Bad image data|invalid|unsupported/i.test(error.message)) {
              extracted = { pages: [], pageCount: null, note: `OCR could not read the file (${error.message.slice(0, 60)})` };
              cacheText(sha256, extracted);
              summary.empty += 1;
              log(`ingest: ${file.path} — ${extracted.note}`);
              continue;
            }
            if (!VISION_OFF.test(error.message)) throw error;
            // Not enabled, or no billing: said once, and the scans wait.
            log(`ingest: OCR is not available — ${error.message.slice(0, 200)}`);
            log('ingest: scanned PDFs and images will be counted, not read, until the Vision API is enabled (DEPLOY.md)');
            visionToken = null;
            summary.needsOcr += 1;
            needsOcr.push(file.path);
            continue;
          }
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
        bytes: buffer ? buffer.length : file.size ?? null,
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
      failed.push({ path: file.path, reason: error.message.slice(0, 200) });
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

  writeJson(path.join(cacheDir, 'needs-ocr.json'), needsOcr);
  writeJson(path.join(cacheDir, 'failed.json'), failed);
  if (supabase) await supabase.auth.signOut();
  log(
    `ingest: done — ${summary.loaded} loaded (${summary.chunks} passages, ${summary.tokens} embedding tokens), ${summary.unchanged} unchanged, ` +
      `${summary.ocr} read by OCR, ${summary.word} converted by Word, ${summary.needsOcr} waiting for OCR, ${summary.empty} empty, ${summary.failed} failed, ` +
      `${summary.duplicates} copies of other files, ${summary.removed} removed`,
  );
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exitCode = 1;
});
