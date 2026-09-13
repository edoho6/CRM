// Contact sheets of the pictures the manifest holds, for the look a person
// gives them before they are committed: twenty to a sheet, each with its
// number and the entry's English name, written to test-results/medicine/images.
//
//   node scripts/medicine/image-sheets.mjs [--since=<ISO date>]
//
// The numbers map to entries in sheet-index.json; a picture refused by eye
// goes into medicine-image-rejects.json by its Commons title, and the next
// run of images.mjs drops it.
import fs from 'node:fs';
import path from 'node:path';
import { args, cacheDir, log, readJson, reportDir, root } from './lib.mjs';
import { loadSharp } from '../shrink-herb-images.mjs';

const imagesDir = path.join(root, 'apps', 'web', 'public', 'medicine', 'images');
const manifestPath = path.join(root, 'apps', 'web', 'features', 'medicine', 'medicine-images.json');
const outDir = path.join(reportDir, 'images');
const COLUMNS = 4;
const ROWS = 5;
const TILE_W = 300;
const TILE_H = 240;
const LABEL_H = 34;

function escapeXml(text) {
  return String(text).replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]);
}

async function main() {
  const sharp = loadSharp();
  if (!sharp) throw new Error('sharp is needed');
  const options = args();
  const since = options.since ? new Date(String(options.since)).getTime() : 0;
  const manifest = readJson(manifestPath, {});
  const compiled = readJson(path.join(cacheDir, 'compiled.json'));
  const names = {};
  for (const entry of compiled?.entries ?? []) if (entry.wikidata_id) names[entry.wikidata_id] = entry.name_en;
  const items = Object.entries(manifest)
    .filter(([, m]) => new Date(m.checkedAt).getTime() >= since)
    .map(([qid, m]) => ({ qid, ...m, name: names[qid] ?? qid }))
    .sort((a, b) => a.name.localeCompare(b.name));
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  const index = [];
  const perSheet = COLUMNS * ROWS;
  for (let s = 0; s * perSheet < items.length; s += 1) {
    const batch = items.slice(s * perSheet, (s + 1) * perSheet);
    const composites = [];
    for (let i = 0; i < batch.length; i += 1) {
      const item = batch[i];
      const number = s * perSheet + i + 1;
      index.push({ number, qid: item.qid, name: item.name, title: item.title, file: item.file, licence: item.licence, description: item.description ?? null });
      const col = i % COLUMNS;
      const row = Math.floor(i / COLUMNS);
      const left = col * TILE_W;
      const top = row * (TILE_H + LABEL_H);
      try {
        const picture = await sharp(path.join(imagesDir, item.file))
          .resize({ width: TILE_W - 8, height: TILE_H - 8, fit: 'contain', background: '#f3f4f6' })
          .toBuffer();
        composites.push({ input: picture, left: left + 4, top: top + 4 });
      } catch (error) {
        log(`sheet: ${item.file} — ${error.message}`);
      }
      const label = Buffer.from(
        `<svg width="${TILE_W}" height="${LABEL_H}"><rect width="100%" height="100%" fill="#ffffff"/><text x="6" y="22" font-family="Arial, sans-serif" font-size="15" fill="#111827">${number}. ${escapeXml(item.name.slice(0, 30))}</text></svg>`,
      );
      composites.push({ input: label, left, top: top + TILE_H });
    }
    const height = Math.ceil(batch.length / COLUMNS) * (TILE_H + LABEL_H);
    await sharp({ create: { width: COLUMNS * TILE_W, height, channels: 3, background: '#e5e7eb' } })
      .composite(composites)
      .png()
      .toFile(path.join(outDir, `sheet-${s + 1}.png`));
  }
  fs.writeFileSync(path.join(outDir, 'sheet-index.json'), JSON.stringify(index, null, 2));
  log(`sheets: ${items.length} pictures on ${Math.ceil(items.length / perSheet)} sheets → ${path.relative(root, outDir)}`);
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exitCode = 1;
});
