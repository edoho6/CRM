// What every step of the Western medicine pipeline shares: where the cache
// and the outputs live, a polite fetch, the environment, slugs, gzip.
//
// The pipeline compiles a corpus from openly licensed sources — Wikidata
// (CC0), MedlinePlus (public domain), FDA labelling (CC0), the NHS website
// (Open Government Licence) — into supabase/seed/medicine/dataset.json.gz,
// which `import.mjs` loads through the database's med_import function.
// Everything downloaded is cached under .cache/medicine (not in git), so a
// re-run costs the sources nothing they already gave.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const cacheDir = path.join(root, '.cache', 'medicine');
export const seedDir = path.join(root, 'supabase', 'seed', 'medicine');
export const reportDir = path.join(root, 'test-results', 'medicine');
export const datasetFile = path.join(seedDir, 'dataset.json.gz');

/** Who we are to the services we read from; a contact address is what their policies ask for. */
export const UA = 'herbalist-clinic-medicine/1.0 (open-licence medical reference for a clinic app; contact edoho6@gmail.com)';

/** `KEY=value` lines from a dotenv file, quotes stripped; missing file → {}. */
export function readEnv(file) {
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (match) out[match[1]] = match[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

/** The app's local environment, then the process's: keys never live in the tree. */
export function env(name) {
  const local = readEnv(path.join(root, 'apps', 'web', '.env.local'));
  const test = readEnv(path.join(root, 'apps', 'web', '.env.test.local'));
  return process.env[name] || local[name] || test[name] || '';
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function slugOf(text) {
  return String(text)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function readJson(file, fallback = null) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function writeJson(file, value) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
}

export function readGzipJson(file, fallback = null) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString('utf8'));
}

export function writeGzipJson(file, value) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, zlib.gzipSync(Buffer.from(JSON.stringify(value), 'utf8'), { level: 9 }));
}

/** The command line as `--name=value` and `--flag` pairs. */
export function args() {
  const out = {};
  for (const arg of process.argv.slice(2)) {
    const match = arg.match(/^--([a-z0-9-]+)(?:=(.*))?$/i);
    if (match) out[match[1]] = match[2] ?? true;
  }
  return out;
}

/**
 * A fetch that behaves: identifies itself, waits when told to (429/503),
 * retries a little — also when the connection itself drops, which a large
 * download from MedlinePlus did every other time — and never throws for a
 * status: the caller reads it. A `method` and a `body` pass through, for the
 * one service that answers only to POST (the Israeli drug registry).
 */
export async function fetchPolite(url, { headers = {}, retries = 3, minDelayMs = 0, method, body } = {}) {
  let attempt = 0;
  for (;;) {
    if (minDelayMs) await sleep(minDelayMs);
    let response;
    try {
      response = await fetch(url, {
        method: method ?? (body ? 'POST' : 'GET'),
        body,
        headers: { 'User-Agent': UA, Accept: 'application/json, text/xml, */*', ...headers },
      });
    } catch (error) {
      if (attempt >= retries) throw error;
      attempt += 1;
      await sleep(2000 * attempt);
      continue;
    }
    // 502 and 504 are the Israeli registry's way of saying "not now".
    if ([429, 502, 503, 504].includes(response.status) && attempt < retries) {
      const wait = Number(response.headers.get('retry-after')) || 15;
      await sleep(wait * 1000);
      attempt += 1;
      continue;
    }
    return response;
  }
}

/** A whole body, read with the same patience: a drop mid-stream is retried too. */
export async function fetchBuffer(url, options = {}) {
  const retries = options.retries ?? 3;
  for (let attempt = 0; ; attempt += 1) {
    const response = await fetchPolite(url, options);
    if (!response.ok) throw new Error(`${response.status} for ${url}`);
    try {
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      if (attempt >= retries) throw error;
      await sleep(2000 * (attempt + 1));
    }
  }
}

export async function fetchJson(url, options) {
  const response = await fetchPolite(url, options);
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    const error = new Error(`${response.status} ${url.slice(0, 120)} ${text.slice(0, 200)}`);
    error.status = response.status;
    throw error;
  }
  return response.json();
}

/** A cached JSON fetch: the file under .cache is the answer the second time. */
export async function cachedJson(cacheFile, url, options) {
  const existing = readJson(cacheFile);
  if (existing) return existing;
  const data = await fetchJson(url, options);
  writeJson(cacheFile, data);
  return data;
}

/** HTML from a source, reduced to text with paragraph breaks kept. */
export function htmlToText(html) {
  return String(html ?? '')
    .replace(/<\s*(br|\/p|\/li|\/h[1-6]|\/div)\s*>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * The first sentence or two of a passage, for a summary line. A sentence
 * ends at . ! or ? followed by a space and a capital letter or a digit, so
 * "98.6 °F" and an exclamation inside quotation marks do not cut it short.
 */
export function firstSentences(text, max = 2, limit = 320) {
  const flat = String(text ?? '').replace(/\s+/g, ' ').trim();
  const sentences = [];
  let start = 0;
  const boundary = /[.!?]["”')]*\s+(?=[A-Z0-9])/g;
  for (const match of flat.matchAll(boundary)) {
    sentences.push(flat.slice(start, match.index + match[0].length).trim());
    start = match.index + match[0].length;
    if (sentences.length >= max) break;
  }
  if (sentences.length < max && start < flat.length) sentences.push(flat.slice(start).trim());
  const picked = sentences.slice(0, max).join(' ').trim();
  return picked.length > limit ? `${picked.slice(0, limit - 1).trimEnd()}…` : picked;
}

export function today() {
  return new Date().toISOString().slice(0, 10);
}

export function log(...parts) {
  console.log(...parts);
}
