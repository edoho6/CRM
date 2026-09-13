// Step 6 — a picture for an entry, from Wikimedia Commons, by the file
// Wikidata names for it (P18).
//
//   node scripts/medicine/images.mjs [--limit=N] [--kinds=condition,drug] [--refresh]
//
// Only three licences pass: CC0 or public domain, CC BY, CC BY-SA — the same
// rule as the herb photographs, and for the same reason (shown as it is,
// with its credit, a picture is not adapted). The file is refused when its
// description or categories say it shows a person: the reference wants an
// illustration, a micrograph, an X-ray, a diagram — never a patient's face.
// What the words cannot catch, the eye does: `medicine-image-rejects.json`
// lists files a person looked at and refused, and they are never chosen
// again. Every accepted file is checked against Commons itself, not against
// a search engine's summary of it.
//
// Output: apps/web/public/medicine/images/<qid>.jpg (640 px on the long side)
//         apps/web/features/medicine/medicine-images.json — file, title,
//           author, page, licence, licence link, credit required, size
//         apps/web/public/medicine/images/CREDITS.md — the same list for people
// build.mjs folds the manifest into each entry's `image`.
import fs from 'node:fs';
import path from 'node:path';
import { args, cacheDir, log, readJson, root, sleep, writeJson } from './lib.mjs';
import { classifyLicence, UA } from '../lib/commons.mjs';
import { loadSharp, shrink } from '../shrink-herb-images.mjs';

const outDir = path.join(root, 'apps', 'web', 'public', 'medicine', 'images');
const manifestPath = path.join(root, 'apps', 'web', 'features', 'medicine', 'medicine-images.json');
const rejectsPath = path.join(root, 'apps', 'web', 'features', 'medicine', 'medicine-image-rejects.json');
const creditsPath = path.join(outDir, 'CREDITS.md');

/** Words in a description or a category that say the picture is of a person. */
const PERSON = /\b(patient|patients|man|men|woman|women|boy|boys|girl|girls|child|children|baby|babies|infant|face|faces|portrait|portraits|person|people|nude|self-portrait|selfie)\b/i;
/** Categories Commons files people under. */
const PERSON_CATEGORY = /\b(people|men|women|children|faces|portraits|patients|nude|human faces)\b/i;
/** Formats Commons renders to a raster thumbnail; anything else (pdf, ogv, djvu) is not a picture. */
const PICTURE = /^image\/(jpeg|png|gif|webp|svg\+xml|tiff)$/i;

const options = args();
const limit = Number(options.limit ?? 0) || Infinity;
const kinds = new Set(String(options.kinds ?? 'condition,drug,symptom,lab_test').split(',').map((k) => k.trim()).filter(Boolean));

function cleanText(html) {
  return String(html ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** imageinfo for up to fifty files in one request. */
async function imageInfo(titles) {
  const url =
    'https://commons.wikimedia.org/w/api.php?' +
    new URLSearchParams({
      action: 'query',
      titles: titles.map((t) => `File:${t}`).join('|'),
      prop: 'imageinfo|categories',
      iiprop: 'url|extmetadata|size|mime',
      iiurlwidth: '900',
      iiextmetadatafilter: 'LicenseShortName|Artist|Credit|ImageDescription|ObjectName|Categories|LicenseUrl',
      cllimit: 'max',
      format: 'json',
      formatversion: '2',
    });
  const response = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!response.ok) throw new Error(`commons ${response.status}`);
  const data = await response.json();
  const byTitle = new Map();
  for (const page of data.query?.pages ?? []) {
    const info = page.imageinfo?.[0];
    if (!info) continue;
    const title = String(page.title).replace(/^File:/, '');
    byTitle.set(title, { ...info, categories: (page.categories ?? []).map((c) => String(c.title).replace(/^Category:/, '')) });
  }
  return byTitle;
}

function judge(info) {
  const meta = info.extmetadata ?? {};
  const licence = classifyLicence(meta.LicenseShortName?.value);
  if (!licence) return { ok: false, reason: `licence: ${meta.LicenseShortName?.value ?? 'unknown'}` };
  if (!PICTURE.test(info.mime ?? '')) return { ok: false, reason: `not a picture: ${info.mime}` };
  if ((info.width ?? 0) < 300 || (info.height ?? 0) < 200) return { ok: false, reason: `too small: ${info.width}×${info.height}` };
  const description = cleanText(meta.ImageDescription?.value);
  const categories = [...(info.categories ?? []), cleanText(meta.Categories?.value)].join(' | ');
  if (PERSON_CATEGORY.test(categories)) return { ok: false, reason: `person category: ${categories.slice(0, 80)}` };
  if (PERSON.test(description)) return { ok: false, reason: `person in description: ${description.slice(0, 80)}` };
  // Commons fills the artist field with a shrug when nobody claimed the file.
  const author = cleanText(meta.Artist?.value);
  return {
    ok: true,
    licence,
    author: author && !/no machine-readable author/i.test(author) ? author : null,
    credit: cleanText(meta.Credit?.value) || null,
    description: description.slice(0, 240) || null,
    thumb: info.thumburl ?? info.url,
    page: info.descriptionurl,
  };
}

async function fetchTo(url, file, sharp) {
  let response = await fetch(url, { headers: { 'User-Agent': UA } });
  if (response.status === 429) {
    // Commons renders thumbnails on demand and asks for a pause when many are asked at once.
    await sleep(30_000);
    response = await fetch(url, { headers: { 'User-Agent': UA } });
  }
  if (!response.ok) throw new Error(`download ${response.status}`);
  const type = response.headers.get('content-type') ?? '';
  if (!/^image\/(jpeg|png|webp)/.test(type)) throw new Error(`thumbnail is ${type}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > 20_000_000) throw new Error('too large');
  fs.writeFileSync(file, buffer);
  const { longest } = await shrink(sharp, file);
  if (longest !== null && longest < 300) {
    fs.unlinkSync(file);
    throw new Error(`too small after shrink: ${longest}`);
  }
  return fs.statSync(file).size;
}

function writeCredits(manifest, names) {
  const lines = [
    '# Picture credits — Western medicine reference',
    '',
    'Every picture comes from Wikimedia Commons under CC0, CC BY or CC BY-SA, shown as it is (scaled only), with the credit the licence asks for.',
    '',
    ...Object.entries(manifest)
      .sort(([a], [b]) => (names[a] ?? a).localeCompare(names[b] ?? b))
      .map(([qid, m]) => `- **${names[qid] ?? qid}** — ${m.title} · ${m.author ?? 'unknown author'} · ${m.licence} · ${m.page}`),
    '',
  ];
  fs.writeFileSync(creditsPath, lines.join('\n'));
}

async function main() {
  const compiled = readJson(path.join(cacheDir, 'compiled.json'));
  const corpus = readJson(path.join(cacheDir, 'wikidata', 'corpus.json'));
  if (!compiled || !corpus) throw new Error('run compile.mjs first');
  const sharp = loadSharp();
  if (!sharp) throw new Error('sharp is needed (it comes with Next.js) — run from the repository');
  fs.mkdirSync(outDir, { recursive: true });
  const manifest = readJson(manifestPath, {});
  const rejects = new Set(readJson(rejectsPath, []));
  const names = {};

  // Which entries want a picture: those with a P18, most-linked first, so a
  // limited run covers the entries people open.
  const inbound = {};
  for (const link of compiled.links) inbound[link.to] = (inbound[link.to] ?? 0) + 1;
  const wanted = [];
  for (const entry of compiled.entries) {
    if (!entry.wikidata_id || !kinds.has(entry.kind)) continue;
    names[entry.wikidata_id] = entry.name_he ?? entry.name_en;
    const title = (corpus.entities[entry.wikidata_id]?.claims?.image ?? [])[0];
    if (!title) continue;
    if (rejects.has(title)) {
      if (manifest[entry.wikidata_id]?.title === title) {
        // Rejected after being taken: out it goes.
        const file = path.join(outDir, manifest[entry.wikidata_id].file);
        if (fs.existsSync(file)) fs.unlinkSync(file);
        delete manifest[entry.wikidata_id];
      }
      continue;
    }
    if (manifest[entry.wikidata_id] && !options.refresh) continue;
    wanted.push({ qid: entry.wikidata_id, title, links: inbound[entry.wikidata_id] ?? 0 });
  }
  wanted.sort((a, b) => b.links - a.links);
  const todo = wanted.slice(0, limit);
  log(`images: ${todo.length} to look up (${Object.keys(manifest).length} already in the manifest, ${rejects.size} rejected by eye)`);

  const reasons = {};
  let taken = 0;
  for (let i = 0; i < todo.length; i += 50) {
    const batch = todo.slice(i, i + 50);
    let infos;
    try {
      infos = await imageInfo(batch.map((b) => b.title));
    } catch (error) {
      log(`images: ${error.message} — waiting`);
      await sleep(30_000);
      i -= 50;
      continue;
    }
    for (const item of batch) {
      const info = infos.get(item.title) ?? infos.get(item.title.replace(/_/g, ' '));
      if (!info) {
        reasons['not on commons'] = (reasons['not on commons'] ?? 0) + 1;
        continue;
      }
      const verdict = judge(info);
      if (!verdict.ok) {
        const key = verdict.reason.split(':')[0];
        reasons[key] = (reasons[key] ?? 0) + 1;
        continue;
      }
      const file = `${item.qid.toLowerCase()}.jpg`;
      try {
        const bytes = await fetchTo(verdict.thumb, path.join(outDir, file), sharp);
        manifest[item.qid] = {
          file,
          title: item.title,
          source: 'Wikimedia Commons',
          author: verdict.author,
          credit: verdict.credit,
          description: verdict.description,
          page: verdict.page,
          licence: verdict.licence.id,
          licenceRaw: verdict.licence.raw,
          licenceUrl: verdict.licence.url,
          creditRequired: verdict.licence.credit,
          bytes,
          checkedAt: new Date().toISOString(),
        };
        taken += 1;
      } catch (error) {
        reasons['download'] = (reasons['download'] ?? 0) + 1;
        log(`images: ${item.title} — ${error.message}`);
      }
      await sleep(150);
    }
    writeJson(manifestPath, manifest);
    log(`images: ${Math.min(i + 50, todo.length)}/${todo.length} looked up, ${taken} taken`);
    await sleep(1000);
  }
  writeJson(manifestPath, manifest);
  writeCredits(manifest, names);
  log(`images: ${taken} taken this run, ${Object.keys(manifest).length} in the manifest; refused: ${JSON.stringify(reasons)}`);
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exitCode = 1;
});
