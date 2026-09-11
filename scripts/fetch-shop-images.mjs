/**
 * Pictures for the price comparison — from open sources, never from the shops.
 *
 *   node scripts/fetch-shop-images.mjs --categories-only
 *   node scripts/fetch-shop-images.mjs [--min-stores=2] [--limit=60] [--only=<text>] [--refresh] [--verbose]
 *
 * The shops' own product photographs are theirs; the comparison shows a
 * picture from Wikimedia Commons under CC0 / CC BY / CC BY-SA instead
 * (scripts/lib/commons.mjs refuses anything else), verified at the source and
 * downscaled, never edited. First a picture per product, when one can be
 * found that names its brand; otherwise one per category, which is what most
 * rows will show — a needle is a needle. Herbs, granules and formulas reuse
 * the catalogue's own reference photographs where the product name is a
 * pinyin name the catalogue knows.
 *
 * Products are read from the database as the test clinic's account (the
 * shared rows are the same for every clinic; no patient data is anywhere
 * near this). Output: apps/web/public/shop-images/*.jpg, the manifest
 * apps/web/features/prices/shop-images.json, and CREDITS.md beside the files.
 * Every picture in the manifest is reviewed by eye before it is committed.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSharp } from './shrink-herb-images.mjs';
import { commonsSearch, download, sleep, slugOf, stats, thumbnailOf } from './lib/commons.mjs';
import { CATEGORY_TERMS } from '../supabase/functions/_shared/shop-prices/taxonomy.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'apps', 'web', 'public', 'shop-images');
const manifestPath = path.join(root, 'apps', 'web', 'features', 'prices', 'shop-images.json');
const herbManifestPath = path.join(root, 'apps', 'web', 'features', 'inventory', 'herb-reference-images.json');
const creditsPath = path.join(outDir, 'CREDITS.md');

const args = new Set(process.argv.slice(2));
const option = (name, fallback) => [...args].find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const categoriesOnly = args.has('--categories-only');
const refresh = args.has('--refresh');
const verbose = args.has('--verbose');
const minStores = Number(option('min-stores', '2'));
const limit = Number(option('limit', '60'));
const only = option('only', null);

/** Two queries per category: the plain name, and the name beside the words of the thing. */
const CATEGORY_QUERIES = {
  needles: ['acupuncture needles', 'disposable acupuncture needles', 'acupuncture needle guide tube'],
  moxa: ['moxa sticks', 'moxibustion moxa'],
  cupping: ['cupping glass', 'glass cupping cups', 'cupping cups set'],
  guasha: ['gua sha stone', 'guasha jade', 'gua sha tool jade'],
  ear_seeds: ['auriculotherapy', 'ear acupuncture seeds', 'vaccaria seeds'],
  tdp_lamps: ['TDP lamp infrared', 'TDP mineral lamp', 'far infrared heat lamp therapy'],
  electro: ['electroacupuncture', 'electro-acupuncture stimulator', 'acupuncture electrical stimulation device'],
  granules: ['tcm granules', 'herbal granules concentrated', 'chinese medicine granules'],
  formulas: ['chinese patent medicine', 'liu wei di huang wan', 'chinese herbal pills'],
  raw_herbs: ['chinese herbal medicine', 'traditional chinese medicine herbs', 'dried herbs chinese pharmacy'],
  consumables: ['cotton swabs', 'medical gauze', 'alcohol swab pads'],
  accessories: ['medical tweezers stainless steel', 'surgical tweezers', 'forceps stainless steel'],
};

/**
 * What a picture's title, description or categories must say to be the
 * thing: two words where one is not enough — "tdp" alone found a canal-side
 * art installation, "herbs" a seed catalogue from 1901.
 */
const IDENTITY = {
  needles: /acupuncture needle/i,
  moxa: /moxa|moxibustion|mugwort|artemisia/i,
  cupping: /cupping/i,
  guasha: /gua ?sha|guasha/i,
  ear_seeds: /auricul|ear seed|vaccaria|ear acupuncture/i,
  tdp_lamps: /(tdp|infrared|infra-red).{0,40}(lamp|heat|therap|mineral)|(lamp|heater).{0,40}(tdp|infrared)/i,
  electro: /electro.?acupuncture|stimulator/i,
  granules: /granul.{0,60}(herb|tcm|chinese|medicin)|(herb|tcm|chinese|medicin).{0,60}granul/i,
  formulas: /(pill|patent).{0,40}(chinese|herbal|medicine)|(chinese|herbal).{0,40}(pill|patent)|\bwan\b/i,
  raw_herbs: /(dried|medicinal|chinese|traditional).{0,30}herb|herbal medicine|materia medica|中药|草药|药材|藥材/i,
  consumables: /cotton (swab|pad|ball|wool)|gauze|alcohol (swab|pad|prep)|medical glove|nitrile glove/i,
  accessories: /acupuncture.{0,30}(tray|kit|set|equipment|supplies)|tweezers|forceps/i,
};

/** Scenes and kinds of picture the comparison does not want: people, treatments, drawings, old paper, the wrong object. */
const REJECT =
  /patient|treatment|receiving|therapist|practitioner|acupuncturist|physician|doctor|nurse|hospital|surgery|operation|\bperson|\bman\b|\bwoman\b|\bpeople|\bchild|\bbaby|\bface\b|\bback\b|\bleg\b|\barm\b|\bhand\b|\bfoot\b|\bbody\b|drawing|illustration|\blogo\b|\bicon\b|diagram|\bmap\b|screenshot|\bbook|poster|advert|painting|cartoon|engraving|syringe|hypodermic|sewing|knitting|tattoo|coffee|tea ?cup|menstrual|reptile|chicken|brooder|nude|naked|museum|statue|stamp|coin|catalog|guide\b|scanned|\bscan\b|\bpage\b|document|manuscript|\b1[89]\d\d\b|wellcome|antique|historical|vintage|19th|18th|setup|concert|festival|canal|boat|ship|street|garden|flower|seed packet|homunculus|anatom|egypt|ancient|roman|metropolitan|\bmet\b|shelf|supermarket|drugstore|pharmacy shelf|philippines|session|massage/i;

function judge(item, category) {
  const text = item.text;
  if (REJECT.test(text)) return { ok: false, why: 'scene' };
  if (!IDENTITY[category].test(text)) return { ok: false, why: 'not the thing' };
  const titled = IDENTITY[category].test(item.title) ? 1 : 0;
  // Licence first (CC0 needs no credit line on a 48 px thumbnail), then a
  // title that names the thing, then size.
  const score = -10 * item.licenceRank + 5 * titled + Math.min(4, Math.log10(Math.max(item.pixels, 1)) - 4);
  return { ok: true, score };
}

async function pick(queries, category, judgeExtra = () => true) {
  const seen = new Map();
  for (const query of queries) {
    let items;
    try {
      items = await commonsSearch(query, { verbose });
    } catch (error) {
      console.log(`   search failed (${query}): ${error.message}`);
      continue;
    }
    for (const item of items) {
      if (seen.has(item.title)) continue;
      const verdict = judge(item, category);
      if (!verdict.ok || !judgeExtra(item)) {
        if (verbose) console.log(`      rejected (${verdict.why ?? 'extra'}) · ${item.title.slice(0, 80)}`);
        continue;
      }
      seen.set(item.title, { ...item, score: verdict.score });
    }
    // The search index allows about ten queries a minute.
    await sleep(7000);
  }
  return [...seen.values()].sort((a, b) => b.score - a.score)[0] ?? null;
}

async function keep(item, file, sharp) {
  const url = await thumbnailOf(item.title, item.download);
  const { bytes } = await download(url, path.join(outDir, file), sharp);
  return {
    file,
    title: item.title,
    source: item.source,
    author: item.author,
    page: item.page,
    licence: item.licence,
    licenceRaw: item.licenceRaw,
    licenceUrl: item.licenceUrl,
    creditRequired: item.creditRequired,
    bytes,
    checkedAt: new Date().toISOString(),
  };
}

function readEnv(file) {
  try {
    return Object.fromEntries(
      fs
        .readFileSync(file, 'utf8')
        .split('\n')
        .map((line) => line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/))
        .filter(Boolean)
        .map((m) => [m[1], m[2].replace(/^["']|["']$/g, '')]),
    );
  } catch {
    return {};
  }
}

/** The products two or more shops carry, read through the reader's own policies. */
async function readProducts() {
  const site = readEnv(path.join(root, 'apps', 'web', '.env.local'));
  const test = readEnv(path.join(root, 'apps', 'web', '.env.test.local'));
  const base = (site.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '');
  const anon = site.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!base || !anon || !test.SMOKE_EMAIL || !test.SMOKE_PASSWORD) {
    throw new Error('apps/web/.env.local (NEXT_PUBLIC_SUPABASE_URL, _ANON_KEY) and .env.test.local (SMOKE_EMAIL, SMOKE_PASSWORD) are needed');
  }
  const session = await fetch(`${base}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anon, 'content-type': 'application/json' },
    body: JSON.stringify({ email: test.SMOKE_EMAIL, password: test.SMOKE_PASSWORD }),
  }).then((r) => r.json());
  if (!session.access_token) throw new Error('sign-in failed: ' + (session.error_description ?? session.msg ?? 'unknown'));
  const query = new URLSearchParams({
    select: 'id,fingerprint,brand,display_item,canonical_name,category,store_count',
    store_count: `gte.${minStores}`,
    order: 'store_count.desc,canonical_name.asc',
    limit: String(limit),
  });
  const res = await fetch(`${base}/rest/v1/shop_product_prices?${query}`, {
    headers: { apikey: anon, Authorization: `Bearer ${session.access_token}` },
  });
  const rows = await res.json();
  if (!Array.isArray(rows)) {
    throw new Error(`the products could not be read (${rows.code ?? res.status}): ${rows.message ?? ''} — has 27_shop_prices_to_run.sql been run?`);
  }
  return rows;
}

function writeCredits(manifest) {
  const lines = [
    '# Price comparison pictures · credits',
    '',
    'None of these pictures comes from the shops whose prices are compared. Every one is used under a',
    'licence that permits use inside commercial software: CC0 needs no credit; CC BY and CC BY-SA require',
    'the credit shown, with a link to the licence. The files are as received from the source, apart from',
    'downscaling to 640 px; none has been edited, so no adapted work exists. Refused: NC, ND, all rights',
    'reserved, unclear. A category picture stands in for every product of that category that has no',
    'picture of its own; a product picture is chosen only when the source names the brand.',
    '',
    '| Shown for | Picture | Source | Author | Licence | Page |',
    '|---|---|---|---|---|---|',
  ];
  for (const [category, e] of Object.entries(manifest.categories).sort()) {
    lines.push(`| category: ${category} | ${e.title ?? e.file} | ${e.source} | ${e.author} | [${e.licence}](${e.licenceUrl}) | [page](${e.page}) |`);
  }
  for (const [fingerprint, e] of Object.entries(manifest.products).sort()) {
    lines.push(`| product: ${fingerprint} | ${e.title ?? e.file} | ${e.source} | ${e.author} | [${e.licence}](${e.licenceUrl}) | [page](${e.page}) |`);
  }
  fs.writeFileSync(creditsPath, lines.join('\n') + '\n');
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const manifest = fs.existsSync(manifestPath)
    ? JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
    : { categories: {}, products: {} };
  manifest.categories ??= {};
  manifest.products ??= {};
  const sharp = loadSharp();
  if (!sharp) console.log('sharp not found: pictures are kept at their source size (JPEG/PNG only).');
  const save = () => {
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
    writeCredits(manifest);
  };

  // One picture per category.
  for (const [category, queries] of Object.entries(CATEGORY_QUERIES)) {
    if (only && !category.includes(only)) continue;
    if (manifest.categories[category]?.file && !refresh) continue;
    console.log(`category ${category}: ${queries.join(' / ')}`);
    const best = await pick(queries, category);
    if (!best) {
      console.log('   nothing acceptable');
      continue;
    }
    try {
      manifest.categories[category] = await keep(best, `cat-${category}.jpg`, sharp);
      console.log(`   kept ${best.title.slice(0, 70)} · ${best.licence} · ${best.author}`);
    } catch (error) {
      console.log(`   download failed: ${error.message}`);
    }
    save();
  }
  if (categoriesOnly) {
    console.log(`done (categories only)${stats.throttled ? `, throttled ${stats.throttled}×` : ''}`);
    return;
  }

  // A picture per product: the catalogue's own herb photographs by pinyin,
  // otherwise Commons, when the source names the brand.
  const herbs = fs.existsSync(herbManifestPath) ? JSON.parse(fs.readFileSync(herbManifestPath, 'utf8')) : {};
  const herbByPinyin = new Map(Object.entries(herbs).filter(([, e]) => e.file).map(([pinyin, e]) => [pinyin.toLowerCase(), e]));
  const products = await readProducts();
  console.log(`${products.length} products in ${minStores}+ shops`);
  for (const product of products) {
    if (only && !`${product.fingerprint} ${product.canonical_name}`.includes(only)) continue;
    if (manifest.products[product.fingerprint]?.file && !refresh) continue;
    if (['granules', 'raw_herbs', 'formulas'].includes(product.category)) {
      const pinyin = (product.display_item ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
      const herb = herbByPinyin.get(pinyin);
      if (herb) {
        manifest.products[product.fingerprint] = {
          herb: pinyin,
          file: `/herbs/${herb.file}`,
          title: herb.species ?? herb.botanical ?? pinyin,
          source: herb.source,
          author: herb.author,
          page: herb.page,
          licence: herb.licence,
          licenceUrl: herb.licenceUrl,
          creditRequired: herb.creditRequired,
          checkedAt: new Date().toISOString(),
        };
        console.log(`product ${product.canonical_name}: the catalogue's own photograph of ${pinyin}`);
        save();
        continue;
      }
    }
    if (!product.brand) continue;
    const brand = product.brand.toLowerCase();
    console.log(`product ${product.canonical_name}: ${brand} ${CATEGORY_TERMS[product.category]}`);
    const best = await pick([`${brand} ${CATEGORY_TERMS[product.category]}`], product.category, (item) =>
      item.text.toLowerCase().includes(brand),
    );
    if (!best) {
      console.log('   nothing that names the brand; the category picture will do');
      continue;
    }
    try {
      manifest.products[product.fingerprint] = await keep(best, `p-${slugOf(product.fingerprint).slice(0, 60)}.jpg`, sharp);
      console.log(`   kept ${best.title.slice(0, 70)} · ${best.licence} · ${best.author}`);
    } catch (error) {
      console.log(`   download failed: ${error.message}`);
    }
    save();
  }
  console.log(`done${stats.throttled ? `, throttled ${stats.throttled}×` : ''}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
