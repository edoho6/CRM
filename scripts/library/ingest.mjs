// The library's files, read, cut into passages, embedded and loaded.
//
//   node scripts/library/ingest.mjs                 # the Drive folder in .env.local
//   node scripts/library/ingest.mjs --folder "C:\path\to\folder"
//   node scripts/library/ingest.mjs --dry           # read and cut, load nothing
//   node scripts/library/ingest.mjs --limit=20      # the first twenty files only
//   node scripts/library/ingest.mjs --refresh       # even files that have not changed
//
// From Drive it needs GOOGLE_SERVICE_ACCOUNT_FILE (the key file's path) and
// LIBRARY_DRIVE_FOLDER_ID in apps/web/.env.local; the folder must be shared
// with the service account. Embeddings need VOYAGE_API_KEY. Loading asks for
// the platform admin's email and password at the terminal, like the
// medicine import, and never keeps them.
//
// A file that has not changed since the last run (same content hash) is
// skipped; a file that is gone from the folder is removed from the library
// when the whole folder was read. .cache/library holds the hashes and the
// embeddings, so a re-run pays only for what is new.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { args, cacheDir as medicineCache, env, log, readJson, writeJson } from '../medicine/lib.mjs';
import { chunkPages } from './lib/chunk.mjs';
import { downloadFile, driveToken, listFolder, READABLE } from './lib/drive.mjs';
import { extractText, titleOf } from './lib/extract.mjs';
import { connectAsAdmin, removeSource, uploadSource } from './lib/upload.mjs';
import { embedTexts } from './lib/voyage.mjs';

const cacheDir = path.join(path.dirname(medicineCache), 'library');
const manifestPath = path.join(cacheDir, 'manifest.json');
const EXTENSIONS = new Set(['pdf', 'docx', 'txt', 'md']);

const options = args();
const limit = Number(options.limit ?? 0) || Infinity;
const dry = Boolean(options.dry);
const refresh = Boolean(options.refresh);

function walkLocal(folder) {
  const files = [];
  const visit = (dir, prefix) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.name.startsWith('.') || entry.name.startsWith('~$')) continue;
      const full = path.join(dir, entry.name);
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) visit(full, rel);
      else {
        const ext = entry.name.split('.').pop().toLowerCase();
        if (EXTENSIONS.has(ext)) files.push({ locator: `file:${rel}`, path: rel, ext, read: async () => fs.readFileSync(full), modified: fs.statSync(full).mtime.toISOString() });
      }
    }
  };
  visit(folder, '');
  return files;
}

async function listDrive() {
  const keyFile = env('GOOGLE_SERVICE_ACCOUNT_FILE');
  const folderId = options['drive-folder'] || env('LIBRARY_DRIVE_FOLDER_ID');
  if (!keyFile || !folderId) throw new Error('set GOOGLE_SERVICE_ACCOUNT_FILE and LIBRARY_DRIVE_FOLDER_ID in apps/web/.env.local, or pass --folder <path>');
  if (!fs.existsSync(keyFile)) throw new Error(`the service account key file is not at ${keyFile}`);
  const { token, email } = await driveToken(keyFile);
  log(`drive: reading as ${email}`);
  const files = await listFolder(token, folderId);
  log(`drive: ${files.length} readable file(s) in the folder (${Object.keys(READABLE).length} kinds are read)`);
  return files
    .sort((a, b) => a.path.localeCompare(b.path))
    .map((file) => ({ locator: `drive:${file.id}`, path: file.path, ext: file.ext, modified: file.modifiedTime, read: async () => downloadFile(token, file) }));
}

async function main() {
  const voyageKey = env('VOYAGE_API_KEY');
  if (!voyageKey) throw new Error('VOYAGE_API_KEY is not set (apps/web/.env.local)');
  fs.mkdirSync(cacheDir, { recursive: true });
  const manifest = readJson(manifestPath, { sources: {} });

  const files = options.folder ? walkLocal(String(options.folder)) : await listDrive();
  const seen = new Set(files.map((f) => f.locator));
  const todo = files.slice(0, limit);
  log(`ingest: ${files.length} file(s), ${todo.length} to look at${dry ? ' (dry run)' : ''}`);

  let supabase = null;
  const admin = async () => (supabase ??= await connectAsAdmin());
  const summary = { unchanged: 0, loaded: 0, empty: 0, failed: 0, removed: 0, chunks: 0, tokens: 0 };

  for (const file of todo) {
    try {
      const buffer = await file.read();
      const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
      const known = manifest.sources[file.locator];
      if (known && known.sha256 === sha256 && !refresh) {
        summary.unchanged += 1;
        continue;
      }
      const { pages, pageCount, note } = await extractText(buffer, file.ext);
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
      const source = {
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
      const { id, added } = await uploadSource(await admin(), source, rows);
      manifest.sources[file.locator] = { id, sha256, title: source.title, chunks: added, loadedAt: source.fetched_at };
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
  if (!dry && todo.length === files.length) {
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

  if (supabase) await supabase.auth.signOut();
  log(`ingest: done — ${summary.loaded} loaded (${summary.chunks} passages, ${summary.tokens} embedding tokens), ${summary.unchanged} unchanged, ${summary.empty} empty, ${summary.failed} failed, ${summary.removed} removed`);
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exitCode = 1;
});
