// Builds the canon index on disk: every book cut by its structure (parse.mjs),
// every section and prose passage embedded with Voyage (cached per text, so a
// re-run pays only for what changed), written to .cache/library/canon/index/:
//   entries.json   herbs, formulas and points with their sections
//   passages.json  the searchable passages (text, heading, entry, section)
//   vectors.f32    one normalised 1024-float vector per passage, in order
//
//   node scripts/library/canon/build.mjs [--no-embed]
import fs from 'node:fs';
import path from 'node:path';
import { env } from '../../medicine/lib.mjs';
import { embedTexts, DIMENSIONS } from '../lib/voyage.mjs';
import { BOOKS, CANON_CACHE } from './books.mjs';
import { parseFormulas, parseHerbs, parsePoints, prosePassages } from './parse.mjs';

const INDEX = path.join(CANON_CACHE, 'index');
const embed = !process.argv.includes('--no-embed');

/** Sections that say nothing a practitioner asks about: chemistry, trade grades, other-language names. */
const UNSEARCHED = new Set([
  'chemistry',
  'quality',
  'variants',
  'names',
  'product',
  'japanese',
  'korean',
  'family',
  'species',
  'first_text',
  'english',
  'alternate_names',
  'intro',
]);

const KIND_LABEL = { herb: 'Herb', formula: 'Formula', point: 'Point' };
const SECTION_LABEL = {
  properties: 'properties',
  channels: 'channels entered',
  key: 'key characteristics',
  dosage: 'dosage',
  cautions: 'cautions and contraindications',
  actions: 'actions and indications',
  combinations: 'combinations',
  comparisons: 'comparisons',
  commentary: 'commentary',
  traditional_contraindications: 'traditional contraindications',
  toxicity: 'toxicity',
  preparation: 'preparation',
  adulterants: 'adulterants',
  source: 'classical source',
  composition: 'composition and doses',
  analysis: 'analysis of the formula',
  biomedical: 'biomedical indications',
  modifications: 'modifications',
  associated: 'associated formulas',
  text: 'description',
  indications: 'indications',
  location: 'location',
  location_note: 'location note',
  needling: 'needling',
  categories: 'point category',
};

export const entryName = (e) =>
  e.kind === 'point'
    ? `${e.names.pinyin} ${e.names.code}`
    : e.kind === 'herb'
      ? `${e.names.pinyin} (${e.names.latin})`
      : `${e.names.pinyin} (${e.names.english})`;

/** A long text in pieces of about max characters, cut after a sentence or a bullet. */
function pieces(text, max = 1600) {
  if (text.length <= max) return [text];
  const out = [];
  let current = '';
  for (const part of text.split(/(?<=[.!?])\s+|\n(?=[•⚫▪>-])/)) {
    if (current && current.length + part.length > max) {
      out.push(current.trim());
      current = '';
    }
    current += `${part} `;
  }
  if (current.trim()) out.push(current.trim());
  return out;
}

const entries = [];
const passages = [];
for (const book of BOOKS) {
  const started = Date.now();
  const pages = book.pages();
  if (book.kind === 'prose') {
    passages.push(...prosePassages(pages, book.id));
  } else {
    const parse = { herbs: parseHerbs, formulas: parseFormulas, points: parsePoints }[book.kind];
    const { entries: found, loose } = parse(pages, book.id);
    entries.push(...found);
    for (const entry of found) {
      for (const [section, text] of Object.entries(entry.sections)) {
        if (UNSEARCHED.has(section)) continue;
        for (const piece of pieces(text))
          passages.push({
            book: book.id,
            page: entry.page,
            entry: entry.id,
            section,
            heading: `${KIND_LABEL[entry.kind]}: ${entryName(entry)} — ${SECTION_LABEL[section] ?? section}`,
            text: piece,
          });
      }
    }
    passages.push(...prosePassages(loose, book.id));
  }
  console.log(
    `${book.id}: ${pages.length} pages, ${entries.filter((e) => e.book === book.id).length} entries, ${passages.filter((p) => p.book === book.id).length} passages (${Date.now() - started} ms)`,
  );
}

fs.mkdirSync(INDEX, { recursive: true });
fs.writeFileSync(path.join(INDEX, 'entries.json'), JSON.stringify(entries));
fs.writeFileSync(path.join(INDEX, 'passages.json'), JSON.stringify(passages));
const chars = passages.reduce((s, p) => s + p.text.length + p.heading.length, 0);
console.log(
  `total: ${entries.length} entries, ${passages.length} passages, ${Math.round(chars / 1000)}k chars`,
);

if (embed) {
  const key = env('VOYAGE_API_KEY');
  if (!key) throw new Error('VOYAGE_API_KEY is not set');
  const texts = passages.map((p) => `${p.heading}\n${p.text}`);
  let last = 0;
  const { embeddings, cached, tokens } = await embedTexts(key, texts, {
    cacheDir: path.join(CANON_CACHE, 'embeddings'),
    onProgress: (done, total) => {
      if (done - last >= 2000 || done === total) {
        console.log(`embedded ${done} of ${total}`);
        last = done;
      }
    },
  });
  const out = new Float32Array(passages.length * DIMENSIONS);
  embeddings.forEach((vector, i) => {
    const norm = Math.hypot(...vector) || 1;
    for (let d = 0; d < DIMENSIONS; d += 1) out[i * DIMENSIONS + d] = vector[d] / norm;
  });
  fs.writeFileSync(path.join(INDEX, 'vectors.f32'), Buffer.from(out.buffer));
  console.log(`vectors: ${cached} from cache, ${tokens.toLocaleString('en-US')} tokens paid`);
}
process.exit(0);
