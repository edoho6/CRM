// Step 2 — MedlinePlus (US National Library of Medicine; the health topic
// summaries are public domain). One XML file holds every health topic with
// its summary, its other names and its MeSH headings — the MeSH id is what
// joins a topic to its Wikidata item.
//
//   node scripts/medicine/medlineplus.mjs
//
// Output: .cache/medicine/medlineplus/topics.json — English topics only.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { cacheDir, ensureDir, fetchBuffer, fetchPolite, htmlToText, log, writeJson } from './lib.mjs';

const INDEX = 'https://medlineplus.gov/xml.html';
const dir = path.join(cacheDir, 'medlineplus');

function attr(tag, name) {
  const match = tag.match(new RegExp(`\\s${name}="([^"]*)"`));
  return match ? decode(match[1]) : null;
}

function decode(text) {
  return String(text)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

function inner(block, tag) {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  return match ? match[1] : null;
}

function all(block, tag) {
  return [...block.matchAll(new RegExp(`<${tag}([^>]*)>([\\s\\S]*?)</${tag}>`, 'g'))].map((m) => ({ attrs: m[1], body: m[2] }));
}

/** One <health-topic> block to a plain record. */
function parseTopic(block) {
  const open = block.match(/<health-topic([^>]*)>/);
  if (!open) return null;
  const attrs = open[1];
  const language = attr(attrs, 'language');
  if (language !== 'English') return null;
  const summaryRaw = inner(block, 'full-summary');
  return {
    id: attr(attrs, 'id'),
    title: attr(attrs, 'title'),
    url: attr(attrs, 'url'),
    date_created: attr(attrs, 'date-created'),
    also_called: all(block, 'also-called').map((a) => decode(a.body).trim()),
    mesh: all(block, 'descriptor').map((d) => ({ id: attr(d.attrs, 'id'), name: decode(d.body).trim() })),
    groups: all(block, 'group').map((g) => decode(g.body).trim()),
    primary_institute: all(block, 'primary-institute').map((p) => decode(p.body).trim())[0] ?? null,
    related: all(block, 'related-topic').map((r) => ({ id: attr(r.attrs, 'id'), title: decode(r.body).trim() })),
    summary_text: summaryRaw ? htmlToText(decode(summaryRaw)) : null,
  };
}

/**
 * The compressed file: a fifth of the size, and the plain XML's 30 MB did not
 * arrive whole here. A zip with one entry, read by hand — the end-of-central-
 * directory record, the central entry, the local header, then inflate.
 */
function unzipSingle(buffer) {
  const EOCD = 0x06054b50;
  let eocd = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 66000); i -= 1) {
    if (buffer.readUInt32LE(i) === EOCD) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('MedlinePlus: not a zip file');
  const centralOffset = buffer.readUInt32LE(eocd + 16);
  if (buffer.readUInt32LE(centralOffset) !== 0x02014b50) throw new Error('MedlinePlus: no central directory');
  const method = buffer.readUInt16LE(centralOffset + 10);
  const compressedSize = buffer.readUInt32LE(centralOffset + 20);
  const localOffset = buffer.readUInt32LE(centralOffset + 42);
  if (buffer.readUInt32LE(localOffset) !== 0x04034b50) throw new Error('MedlinePlus: no local header');
  const nameLength = buffer.readUInt16LE(localOffset + 26);
  const extraLength = buffer.readUInt16LE(localOffset + 28);
  const start = localOffset + 30 + nameLength + extraLength;
  const data = buffer.subarray(start, start + compressedSize);
  return method === 8 ? zlib.inflateRawSync(data) : Buffer.from(data);
}

async function latestFile() {
  const page = await (await fetchPolite(INDEX)).text();
  const links = [...page.matchAll(/href="([^"]*mplus_topics_compressed_(\d{4}-\d{2}-\d{2})\.zip)"/g)].map((m) => ({
    url: new URL(m[1], INDEX).toString(),
    date: m[2],
  }));
  if (!links.length) throw new Error('MedlinePlus: no compressed topics file found on the XML page');
  links.sort((a, b) => (a.date < b.date ? 1 : -1));
  return links[0];
}

async function main() {
  ensureDir(dir);
  const latest = await latestFile();
  const file = path.join(dir, `mplus_topics_${latest.date}.xml`);
  if (!fs.existsSync(file)) {
    // The zip stays on disk once it arrived whole; unzipping is the cheap part.
    const zip = path.join(dir, `mplus_topics_compressed_${latest.date}.zip`);
    if (!fs.existsSync(zip)) {
      log(`medlineplus: downloading ${latest.url}`);
      fs.writeFileSync(zip, await fetchBuffer(latest.url));
    }
    fs.writeFileSync(file, unzipSingle(fs.readFileSync(zip)));
  }
  const xml = fs.readFileSync(file, 'utf8');
  const blocks = xml.split('<health-topic ').slice(1).map((chunk) => '<health-topic ' + chunk.split('</health-topic>')[0] + '</health-topic>');
  const topics = blocks.map(parseTopic).filter(Boolean);
  writeJson(path.join(dir, 'topics.json'), { file: latest.date, retrieved_at: new Date().toISOString(), topics });
  log(`medlineplus: ${topics.length} English topics from the ${latest.date} file → .cache/medicine/medlineplus/topics.json`);
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exitCode = 1;
});
