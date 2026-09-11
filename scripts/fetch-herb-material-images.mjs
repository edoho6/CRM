/**
 * The dried medicinal material — the thing on the dispensary shelf — for
 * every herb in the starter catalogue, in preference to the living plant.
 *
 * A practitioner recognises 黃芪 as pale sliced root, not as a vetch in
 * flower. So this pass runs before scripts/fetch-herb-images.mjs counts: for
 * each herb it asks Wikimedia Commons (and, budget permitting, Openverse) for
 * a photograph of the material, found through the Chinese name in both
 * scripts, the pinyin and the Latin pharmaceutical name, together with the
 * words people write on such photographs — dried, slices, decoction pieces,
 * 饮片, 药材. A photograph is kept only when
 *
 *   - its licence is CC0 / public domain, CC BY, or CC BY-SA (the file is
 *     shown as received, so share-alike binds nothing), read from the source
 *     itself (Commons' own metadata; for Openverse, the licence link on the
 *     landing page), never from a search result alone;
 *   - its title, description or categories name this herb — the Chinese
 *     name, the pharmaceutical name, the species or the pinyin — so a
 *     sliced root of some other plant cannot slip in;
 *   - it reads as material rather than plant: markers of the dried,
 *     processed form score it up, words of the living plant score it down,
 *     and photographs of shops, dishes, teas, capsules, pages, herbaria and
 *     people are refused outright.
 *
 * The two commercial-only databases people use to identify material (HKBU
 * CMMID, PolyU) are a reference for what the material should look like when
 * the picks are reviewed by eye; nothing is taken from them.
 *
 * A herb with a material photograph replaces its plant photograph in the
 * manifest (form: "material"); one without keeps the plant photograph, marked
 * form: "plant", or stays without a picture. A pick that turns out wrong on
 * review goes into herb-reference-rejects.json by page URL and is never
 * chosen again.
 *
 * Usage: node scripts/fetch-herb-material-images.mjs [--only=Huang Qi,Dang Gui]
 *        [--dry] [--refresh] [--no-openverse] [--sheets]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  readCatalogue,
  classifyLicence,
  speciesOf,
  isPlantName,
  slugOf,
  sleep,
  download,
  writeCredits,
  UA,
  outDir,
  manifestPath,
} from './fetch-herb-images.mjs';
import { loadSharp } from './shrink-herb-images.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rejectsPath = path.join(root, 'apps', 'web', 'features', 'inventory', 'herb-reference-rejects.json');

const args = new Set(process.argv.slice(2));
const only =
  [...args]
    .find((a) => a.startsWith('--only='))
    ?.slice(7)
    .split(',')
    .map((s) => s.trim()) ?? null;
const dry = args.has('--dry');
const reject =
  [...args]
    .find((a) => a.startsWith('--reject='))
    ?.slice(9)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean) ?? [];
const refresh = args.has('--refresh');
const useOpenverse = !args.has('--no-openverse');
const sheets = args.has('--sheets');
/** --verbose prints every candidate with its verdict, for tuning the judge. */
const verbose = args.has('--verbose');

/* ---- what a material photograph says about itself ------------------------ */

/** Words of the dispensed form. Latin part names count as such because a plant photograph is never captioned "Radix". */
const STRONG =
  /dried|\bdry\b|slice|饮片|飲片|藥材|药材|decoction|中藥|中药|生藥|生药|herbal (medicine|slices?|goods)|chinese (herbal |traditional )?medicine/i;
const PART =
  /\b(radix|rhizoma|herba|cortex|fructus|semen|flos|folium|ramulus|caulis|pericarpium|bulbus|tuber|sclerotium|spica|thallus|exocarpium|lignum|resina|stigma|arillus|pollen|calyx|plumula|medulla|cacumen|pseudobulbus|concha|cornu|carapax|plastrum|periostracum|ootheca|squama|gelatinum|excrementum|corium|endothelium|receptaculum|galla|fel|venenum|massa|faeces|spora)\b/i;
/**
 * The harvested part. A peel, a slough, a sclerotium or a resin is material by
 * its nature; a root, a seed or a twig may still be on the plant in the
 * photograph, so those count for less and need another sign.
 */
const PIECE_STRONG =
  /\b(peels?|rind|husks?|shells?|exuviae?|moult|slough|sclerotia|sclerotium|resin|gum|mineral|ore|processed|prepared|roasted|charred|calcined|stir-fried|honey-fried|decoction pieces?)\b|皮|殼|壳|炒|炙|煅|製|制/i;
const PIECE =
  /\b(peels?|rind|husks?|shells?|exuviae?|moult|slough|roots?|rhizomes?|bark|seeds?|kernels?|tubers?|bulbs?|sclerotia|sclerotium|resin|gum|mineral|ore|crystals?|twigs?|stems?|pieces?|cut|chopped|processed|prepared|roasted|fried|charred|calcined|stir-fried|honey-fried)\b|皮|根|殼|壳|壳|籽|仁|炒|炙|煅|製|制/i;
const WEAK = /medicin|pharmac|\bherbs?\b|\btcm\b|materia medica|草藥|草药/i;
/** The living plant, or a botanical setting. Scored after the herb's own name is removed, because 花 is in 金銀花. */
const PLANT =
  /flower|bloom|blossom|\bleaf\b|leaves|\bplants?\b|habit|habitus|inflorescence|seedling|growing|garden|botanic|arboretum|greenhouse|\btrees?\b|\bshrubs?\b|\bwild\b|meadow|in situ|forest|hillside|植物|開花|开花|花期|葉子|叶子|果實|果实|樹|树|苗/i;
/** Not a photograph of one material at all. */
const REFUSE =
  /capsule|tablet|pill|膠囊|胶囊|soup|\bstew|湯|汤|\btea\b|茶|dish|cook|recipe|\bliquor\b|wine|\bbeer\b|酒|packag|\blabel|museum|herbier|herbarium|specimen sheet|illustration|drawing|painting|engraving|\bbook\b|manuscript|chart|\btext\b|\bscan|cosplay|\bshops?\b|\bstore\b|market|street|building|apothecary|pharmacy|laboratory|\bbill\b|logo|stamp|\bmap\b|poster|comic|game|anime|figure|actor|person|portrait|\bwoman\b|\bman\b|people|festival|ceremony|temple|restaurant|kitchen|noodle|candy|snack|cake|dessert|jam\b|juice|smoothie|extract|tincture|oil\b|powder|essence|granule|supplement|bottle|jar\b|\bbag\b|display|exhibit|collection|餅|饼|糕|蜜餞|蜜饯|preserved|candied|sweet|jelly|drink|beverage|syrup|honey|sugar|糖|chocolate|ice cream|salad|meal|lunch|dinner|breakfast|food\b|饮料|飲料|paste|sauce|cream|soap|cosmetic|perfume|incense|menthol|camphor|borneol|essential oil|crystal|古墳|出土|遺跡|遗迹|廟|庙|寺|神社|祭|飾|金具|壺|壶|tomb|kofun|excavat|archaeolog|artefact|artifact|burial|shrine|vermicelli|noodle|dumpling|congee|porridge|jelly|抽出|精製|精制|提取|成分|萃取|woodcut|lithograph|etching|wellcome|folio|codex|treatise|encyclop|dictionary|diagram|plate\b|print\b|seedling|sapling|nursery|plantation|farm|field|orchard|harvest(ing|er)?\b|flowering|blooming|bud\b|buds\b|碑|stele|inscription|monument|memorial|dry[- ]stone|stone wall|pedra seca|\bwall\b|statue|sculpture|carving|castle|palace|城|zoo|wildlife|safari|grazing|herd\b|river ?bed|車|waterwheel|collar|\bstays\b|自制|homemade|zongzi|粽|大観|印画|journal|geological|satellite|orbit|panoramio|landscape|mountain|ridge|尾根|valley|lake|pond|dune|\bfield\b|bonsai|garden|park\b|公園|活動|場地|館|苑|portrait|ceremony|president|minister|meeting|dish|stir-fried|cooked|\bmeal\b/i;
/** Creatures that are not the herb — for a plant herb only; a cicada's slough or a beetle *is* the material. */
const REFUSE_FOR_PLANTS = /\bnests?\b|nesting|\bbees?\b|\bwasps?\b|\bbirds?\b|beetle|\binsects?\b|caterpillar|larva|\bbugs?\b|spider|butterfl|moth\b|donkey|\bdeer\b|\bstag\b|cattle|\bcow\b|horse|goat|sheep|hive|apiary/i;

/**
 * Names under which Commons files know a species that the catalogue lists by
 * an older or a different name. Only the well-known cases; a photograph
 * captioned with a name not here is simply not found.
 */
const ALIASES = {
  'Poria cocos': ['Wolfiporia extensa', 'Wolfiporia cocos', 'Pachyma hoelen'],
  'Polygonum multiflorum': ['Fallopia multiflora', 'Reynoutria multiflora'],
  'Ligusticum chuanxiong': ['Ligusticum sinense', 'Conioselinum anthriscoides'],
  'Cimicifuga foetida': ['Actaea cimicifuga'],
  'Astragalus membranaceus': ['Astragalus mongholicus', 'Astragalus propinquus'],
  'Bupleurum chinense': ['Bupleurum falcatum'],
  'Dolichos lablab': ['Lablab purpureus'],
  'Areca catechu': ['Areca nut', 'betel nut'],
  'Citrus reticulata': ['Citrus unshiu', 'tangerine peel', 'mandarin peel'],
  'Crataegus pinnatifida': ['hawthorn'],
  'Glycyrrhiza uralensis': ['liquorice root', 'licorice root'],
  'Zingiber officinale': ['ginger'],
  'Panax ginseng': ['ginseng root'],
  'Lycium barbarum': ['goji', 'wolfberr'],
  'Ziziphus jujuba': ['jujube'],
  'Nelumbo nucifera': ['lotus'],
  'Angelica sinensis': ['dong quai', 'dang gui', 'danggui', 'dongquai'],
  'Wolfiporia extensa': ['Poria cocos'],
};

/** "astragalus" → "astragal": the genus and its Latin genitive ("Astragali") in one stem, for genera the catalogue has once. */
function genusStem(genus) {
  return genus.replace(/(us|um|is|es|ia|a|e)$/i, '');
}

/** All the ways a file might name this herb, each as a regular expression on lower-cased text. */
function identityTerms(herb, traditional, speciesShared, genusShared) {
  const terms = [];
  const push = (label, re, strip = [re]) => terms.push({ label, re, strip });
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Not preceded by another Han character: 蘇木 inside a person's name
  // (馬合蘇木) and 牛膝 inside 川牛膝 — a different species — are not this
  // herb. A character after it is fine: 丹参片 is slices of it.
  push('chinese', new RegExp('(?<!\\p{Script=Han})' + esc(herb.chinese), 'u'));
  if (traditional && traditional !== herb.chinese)
    push('chinese', new RegExp('(?<!\\p{Script=Han})' + esc(traditional), 'u'));
  // Every word of the pharmaceutical name, in any order: "Radix Astragali" and "Astragali Radix".
  const words = herb.pharmaceutical
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2 && !['et', 'seu', 'cum', 'vel'].includes(w));
  if (words.length)
    push(
      'pharmaceutical',
      new RegExp(words.map((w) => `(?=[\\s\\S]*\\b${esc(w)}\\b)`).join('') + '[\\s\\S]*'),
      // Stripped word by word: the matcher above spans the whole text.
      words.map((w) => new RegExp(`\\b${esc(w)}\\b`, 'g')),
    );
  // The species, unless several herbs come from it — bark and twig of the same
  // cinnamon are different materials, and only their own names tell them apart.
  const species = speciesOf(herb.botanical).toLowerCase();
  if (!speciesShared && /^[a-z]+ [a-z-]+/.test(species)) {
    const [genus, epithet] = species.split(' ');
    push('species', new RegExp(`\\b${esc(genus)}[\\s-]?${esc(epithet)}\\b`));
  }
  if (!genusShared && /^[a-z]+ [a-z-]+/.test(species)) {
    const stem = genusStem(species.split(' ')[0]);
    if (stem.length >= 5) push('genus', new RegExp(`\\b${esc(stem)}\\w*`));
  }
  for (const alias of speciesShared ? [] : (ALIASES[speciesOf(herb.botanical)] ?? [])) {
    const a = alias.toLowerCase();
    // A species alias is a whole binomial; an English word may be a stem ("wolfberr").
    const binomial = /^[A-Z][a-z]+ [a-z]+$/.test(alias);
    push(
      'alias',
      binomial
        ? new RegExp(`\\b${esc(a).replace(' ', '[\\s-]?')}\\b`)
        : new RegExp(`\\b${esc(a)}`),
    );
  }
  const english = herb.english.toLowerCase().trim();
  if (english.length >= 6 && english.includes(' ')) push('english', new RegExp(`\\b${esc(english)}\\b`));
  const pinyin = herb.pinyin.toLowerCase();
  const joined = pinyin.replace(/\s+/g, '');
  if (joined.length >= 5) push('pinyin', new RegExp(`\\b${esc(joined)}\\b`));
  push('pinyin', new RegExp(`\\b${esc(pinyin)}\\b`));
  return terms;
}

/**
 * How much a file looks like a photograph of this herb's dried material.
 * null when it is not this herb, or is not material at all.
 */
function judge(text, herb, terms) {
  const lower = text.toLowerCase();
  const matched = terms.find((t) => t.re.test(lower));
  if (!matched) return verbose ? { reason: 'not named' } : null;
  const refused = lower.match(REFUSE) ?? (herb.plant ? lower.match(REFUSE_FOR_PLANTS) : null);
  if (refused) return verbose ? { reason: 'refused: ' + refused[0] } : null;
  let rest = lower;
  for (const t of terms) for (const re of t.strip) rest = rest.replace(re, ' ');
  rest = rest.replace(new RegExp(herb.chinese.split('').join('|'), 'g'), ' ');
  let score = 0;
  if (STRONG.test(rest)) score += 3;
  if (PART.test(lower)) score += 2;
  if (PIECE_STRONG.test(rest)) score += 2;
  else if (PIECE.test(rest)) score += 1;
  if (WEAK.test(rest)) score += 1;
  // A cicada slough or a mineral has no living form to be confused with: a
  // file simply named after it is a photograph of the material.
  if (!herb.plant && matched.label === 'chinese' && terms[0].re.test(text.split(' \n ')[0].toLowerCase()))
    score += 2;
  const plant = rest.match(PLANT);
  if (plant) score -= 3;
  if (score < 2) return verbose ? { reason: `score ${score}${plant ? ' plant: ' + plant[0] : ''}` } : null;
  return { score, matched: matched.label };
}

/* ---- simplified → traditional --------------------------------------------- */

/** The names in the seed are simplified; Hong Kong and Taiwan uploads are captioned in traditional. Wikipedia's converter knows both. */
async function toTraditional(names) {
  const out = new Map();
  const batches = [];
  for (let i = 0; i < names.length; i += 80) batches.push(names.slice(i, i + 80));
  for (const batch of batches) {
    const url =
      'https://zh.wikipedia.org/w/api.php?' +
      new URLSearchParams({
        action: 'parse',
        text: batch.join('|'),
        contentmodel: 'wikitext',
        variant: 'zh-hant',
        prop: 'text',
        format: 'json',
        disablelimitreport: '1',
      });
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    const json = await res.json();
    const converted = json.parse.text['*'].replace(/<[^>]+>/g, '').trim().split('|');
    if (converted.length === batch.length) batch.forEach((n, i) => out.set(n, converted[i].trim()));
    await sleep(500);
  }
  return out;
}

/* ---- Wikimedia Commons ---------------------------------------------------- */

/**
 * The search itself goes through rest.php: api.php's search is rate-limited
 * to a handful of calls a minute per client and answered with a minute's
 * pause, while the REST endpoint — the same index — is not. The files' own
 * metadata (licence, size, description, categories) is then read in one
 * api.php call, which is a plain page query and not limited the same way.
 */
async function commonsSearch(query) {
  const restUrl =
    'https://commons.wikimedia.org/w/rest.php/v1/search/page?' +
    new URLSearchParams({ q: `filetype:bitmap ${query}`, limit: '25' });
  let found;
  for (let attempt = 0; ; attempt += 1) {
    const restRes = await fetch(restUrl, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
    const restText = await restRes.text();
    try {
      found = JSON.parse(restText);
      break;
    } catch {
      // The search index allows about ten queries a minute; over that it
      // answers in plain text. A minute's pause is the whole remedy.
      if (attempt >= 2 || !/too many requests/i.test(restText)) throw new Error(restText.slice(0, 60));
      throttled += 1;
      await sleep(65000);
    }
  }
  const titles = (found.pages ?? [])
    .map((page) => (page.title.startsWith('File:') ? page.title : `File:${page.title}`))
    .filter((title) => /\.(jpe?g|png|webp)$/i.test(title));
  if (titles.length === 0) return [];
  const url =
    'https://commons.wikimedia.org/w/api.php?' +
    new URLSearchParams({
      action: 'query',
      titles: titles.join('|'),
      prop: 'imageinfo|categories',
      cllimit: '50',
      // No thumbnail width here: asking for one renders twenty-five thumbnails
      // per query, and that is what gets a client throttled. The one file
      // chosen gets its 900 px rendering afterwards, in thumbnailOf().
      iiprop: 'url|extmetadata|mime|size',
      maxlag: '5',
      format: 'json',
    });
  let data;
  for (let attempt = 0; ; attempt += 1) {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
    const text = await res.text();
    try {
      data = JSON.parse(text);
      break;
    } catch {
      // Commons throttles bursts with a plain-text reply; waiting is the whole remedy.
      if (attempt >= 3 || !/too many requests|maxlag/i.test(text)) throw new Error(text.slice(0, 60));
      throttled += 1;
      await sleep(60000);
    }
  }
  const out = [];
  for (const p of Object.values(data.query?.pages ?? {})) {
    const info = p.imageinfo?.[0];
    const skip = (why) => verbose && console.log(`      [${query}] skipped (${why}) · ${p.title.slice(5, 95)}`);
    if (!info || !/^image\/(jpeg|png|webp)$/.test(info.mime ?? '')) {
      skip('not a bitmap');
      continue;
    }
    if (Math.max(info.width ?? 0, info.height ?? 0) < 300) {
      skip('too small');
      continue;
    }
    const meta = info.extmetadata ?? {};
    const licence = classifyLicence(meta.LicenseShortName?.value);
    if (!licence) {
      skip('licence ' + (meta.LicenseShortName?.value ?? '?'));
      continue;
    }
    const categories = (p.categories ?? []).map((c) => c.title.replace(/^Category:/, ''));
    const description = (meta.ImageDescription?.value ?? '').replace(/<[^>]+>/g, ' ');
    const title = p.title.replace(/^File:/, '');
    out.push({
      source: 'Wikimedia Commons',
      title,
      text: [title, description, ...categories].join(' \n '),
      author: (meta.Artist?.value ?? '').replace(/<[^>]+>/g, '').trim() || 'unknown',
      page: info.descriptionurl,
      licence: licence.id,
      licenceRank: licence.rank,
      licenceRaw: meta.LicenseShortName?.value,
      licenceUrl: meta.LicenseUrl?.value || licence.url,
      creditRequired: licence.credit,
      download: info.url,
      pixels: (info.width ?? 0) * (info.height ?? 0),
    });
  }
  return out;
}

/** The 900 px rendering of one Commons file, or the original when Commons will not render it. */
async function thumbnailOf(title, fallback) {
  const url =
    'https://commons.wikimedia.org/w/api.php?' +
    new URLSearchParams({ action: 'query', titles: 'File:' + title, prop: 'imageinfo', iiprop: 'url', iiurlwidth: '900', format: 'json' });
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    const data = await res.json();
    return Object.values(data.query?.pages ?? {})[0]?.imageinfo?.[0]?.thumburl || fallback;
  } catch {
    return fallback;
  }
}

/**
 * Search returns its twenty-five best matches, and for a well-photographed
 * plant those are all the plant. So the name is asked for on its own and
 * again next to the words of the material, which pulls the dried form up
 * from the back of the list.
 */
function commonsQueries(herb, traditional) {
  // Searches are limited to about ten a minute, so each one has to earn its
  // place: the name in both scripts, the name beside "dried" (Hong Kong and
  // Taiwan uploads, which are most of the material photographs, are captioned
  // in traditional characters), the species beside "dried", and the Latin
  // pharmaceutical name.
  const q = new Set();
  q.add(`"${herb.chinese}"`);
  if (traditional && traditional !== herb.chinese) q.add(`"${traditional}"`);
  q.add(`${traditional || herb.chinese} dried`);
  const species = speciesOf(herb.botanical);
  if (/^[A-Z][a-z]+ [a-z-]+/.test(species)) q.add(`"${species}" dried`);
  q.add(`"${herb.pharmaceutical}"`);
  return [...q];
}

/* ---- Openverse ------------------------------------------------------------ */

/** Anonymous Openverse allows 200 calls a day; the counter is read off every reply. */
let openverseLeft = Infinity;
/** Gateway timeouts in a row: after three, Openverse is left alone for the rest of the run rather than costing a minute a herb. */
let openverseFailures = 0;
/** How often Commons asked for a pause; printed per herb so a slow run explains itself. */
let throttled = 0;

async function openverseSearch(query) {
  if (openverseLeft < 8 || openverseFailures >= 3) return [];
  const url =
    'https://api.openverse.org/v1/images/?' +
    new URLSearchParams({ q: query, license: 'cc0,by,by-sa,pdm', page_size: '20', mature: 'false' });
  let res;
  try {
    res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(8000) });
  } catch (e) {
    openverseFailures += 1;
    throw new Error(`openverse ${e.name === 'TimeoutError' ? 'timeout' : e.message}`);
  }
  const left = Number(res.headers.get('x-ratelimit-available-anon_sustained'));
  if (Number.isFinite(left)) openverseLeft = left;
  if (!res.ok) {
    if (res.status >= 500) openverseFailures += 1;
    throw new Error(`openverse ${res.status}`);
  }
  openverseFailures = 0;
  let json;
  try {
    json = await res.json();
  } catch {
    return [];
  }
  return (json.results ?? []).map((r) => ({
    source: r.source === 'flickr' ? 'Flickr' : r.source === 'wikimedia' ? 'Wikimedia Commons' : `Openverse (${r.source})`,
    provider: r.source,
    title: r.title ?? '',
    text: [r.title ?? '', ...(r.tags ?? []).map((t) => t.name)].join(' \n '),
    author: r.creator || 'unknown',
    page: r.foreign_landing_url,
    claimed: `${r.license} ${r.license_version ?? ''}`.trim(),
    download: r.url,
    pixels: (r.width ?? 0) * (r.height ?? 0),
  }));
}

/**
 * Openverse's index says "CC BY"; the page it points at has to say so too.
 * Commons files are read back through the Commons API; any other page must
 * carry a link to the very licence claimed.
 */
async function verifyAtSource(item) {
  if (item.provider === 'wikimedia') {
    const title = decodeURIComponent(item.page.split('/wiki/').pop() ?? '');
    if (!title.startsWith('File:')) return null;
    const url =
      'https://commons.wikimedia.org/w/api.php?' +
      new URLSearchParams({
        action: 'query',
        titles: title,
        prop: 'imageinfo|categories',
        cllimit: '50',
        iiprop: 'url|extmetadata|mime|size',
        iiurlwidth: '900',
        format: 'json',
      });
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    const data = await res.json();
    const p = Object.values(data.query?.pages ?? {})[0];
    const info = p?.imageinfo?.[0];
    if (!info) return null;
    const meta = info.extmetadata ?? {};
    const licence = classifyLicence(meta.LicenseShortName?.value);
    if (!licence) return null;
    const categories = (p.categories ?? []).map((c) => c.title.replace(/^Category:/, ''));
    return {
      ...item,
      source: 'Wikimedia Commons',
      text: [p.title.replace(/^File:/, ''), (meta.ImageDescription?.value ?? '').replace(/<[^>]+>/g, ' '), ...categories].join(' \n '),
      author: (meta.Artist?.value ?? '').replace(/<[^>]+>/g, '').trim() || item.author,
      page: info.descriptionurl,
      licence: licence.id,
      licenceRank: licence.rank,
      licenceRaw: meta.LicenseShortName?.value,
      licenceUrl: meta.LicenseUrl?.value || licence.url,
      creditRequired: licence.credit,
      download: info.thumburl || info.url,
    };
  }
  const res = await fetch(item.page, { headers: { 'User-Agent': UA, Accept: 'text/html' }, signal: AbortSignal.timeout(10000) });
  if (!res.ok) return null;
  const html = (await res.text()).toLowerCase();
  const claimed = item.claimed.toLowerCase();
  let licence = null;
  if (/^cc0/.test(claimed) && html.includes('creativecommons.org/publicdomain/zero/')) licence = classifyLicence('CC0');
  else if (/^pdm/.test(claimed) && html.includes('creativecommons.org/publicdomain/mark/')) licence = classifyLicence('CC0');
  else if (/^by-sa\b/.test(claimed)) {
    const m = html.match(/creativecommons\.org\/licenses\/by-sa\/(\d\.\d)\//);
    if (m) licence = { ...classifyLicence('CC BY-SA'), url: `https://creativecommons.org/licenses/by-sa/${m[1]}/` };
  } else if (/^by\b/.test(claimed)) {
    const m = html.match(/creativecommons\.org\/licenses\/by\/(\d\.\d)\//);
    if (m) licence = { ...classifyLicence('CC BY'), url: `https://creativecommons.org/licenses/by/${m[1]}/` };
  }
  if (!licence) return null;
  return {
    ...item,
    licence: licence.id,
    licenceRank: licence.rank,
    licenceRaw: item.claimed,
    licenceUrl: licence.url,
    creditRequired: licence.credit,
  };
}

/* ---- main ----------------------------------------------------------------- */

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : {};
  const rejects = fs.existsSync(rejectsPath) ? JSON.parse(fs.readFileSync(rejectsPath, 'utf8')) : {};

  if (reject.length) {
    for (const key of reject) {
      const entry = manifest[key];
      if (!entry || entry.form !== 'material') {
        console.log(`  ?   ${key}: no material photograph to reject`);
        continue;
      }
      rejects[entry.page] = `${key}: rejected on review ${new Date().toISOString().slice(0, 10)}`;
      if (entry.file && fs.existsSync(path.join(outDir, entry.file))) fs.unlinkSync(path.join(outDir, entry.file));
      // Back to the plant photograph kept aside, or to nothing; either way
      // the material is searched for again next run, minus the rejected page.
      manifest[key] = entry.plant
        ? { ...entry.plant, form: 'plant' }
        : { botanical: entry.botanical, species: entry.species, result: 'none', checkedAt: entry.checkedAt };
      delete manifest[key].materialCheckedAt;
      console.log(`  ✗   ${key}: rejected ${entry.page}`);
    }
    fs.writeFileSync(rejectsPath, JSON.stringify(rejects, null, 2) + '\n');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
    writeCredits(manifest);
    return;
  }
  const all = readCatalogue();
  const speciesCount = new Map();
  const genusCount = new Map();
  for (const h of all) {
    const s = speciesOf(h.botanical);
    speciesCount.set(s, (speciesCount.get(s) ?? 0) + 1);
    const g = s.split(' ')[0].toLowerCase();
    genusCount.set(g, (genusCount.get(g) ?? 0) + 1);
  }
  const herbs = all
    .filter((h) => !only || only.includes(h.pinyin))
    .map((h) => ({ ...h, plant: isPlantName(h.botanical) }));
  // A verdict reached while the index was refusing queries is not a verdict.
  for (const entry of Object.values(manifest)) {
    if (entry.materialCheckedAt && entry.form !== 'material' && /too many requests|timeout|openverse|commons:/i.test(entry.materialError ?? '')) {
      delete entry.materialCheckedAt;
      delete entry.materialError;
    }
  }
  const traditional = await toTraditional(herbs.map((h) => h.chinese));
  const summary = { material: 0, kept: 0, none: 0, errors: 0, openverse: 0 };
  const picked = [];

  for (const herb of herbs) {
    const key = herb.pinyin;
    const started = Date.now();
    const throttledBefore = throttled;
    const elapsed = () => `${Math.round((Date.now() - started) / 1000)}s${throttled > throttledBefore ? ', paused ' + (throttled - throttledBefore) + '×' : ''}`;
    const previous = manifest[key] ?? {};
    if (!refresh && (previous.form === 'material' || previous.materialCheckedAt)) {
      summary.kept += 1;
      continue;
    }
    const trad = traditional.get(herb.chinese);
    const species = speciesOf(herb.botanical);
    const terms = identityTerms(
      herb,
      trad,
      (speciesCount.get(species) ?? 0) > 1,
      (genusCount.get(species.split(' ')[0].toLowerCase()) ?? 0) > 1,
    );
    const candidates = new Map();
    let error = null;

    for (const query of commonsQueries(herb, trad)) {
      try {
        for (const c of await commonsSearch(query)) {
          if (rejects[c.page] || candidates.has(c.page)) continue;
          let verdict = judge(c.text, herb, terms);
          if (verbose) console.log(`      [${query}] ${verdict?.score ? verdict.score + ' ' + verdict.matched : 'no (' + (verdict?.reason ?? '') + ')'} · ${c.title.slice(0, 90)}`);
          if (verdict && !verdict.score) verdict = null;
          if (verdict) candidates.set(c.page, { ...c, ...verdict, query });
        }
      } catch (e) {
        error = `commons: ${String(e.message ?? e).slice(0, 80)}`;
      }
      await sleep(8000); // ten searches a minute is what the index allows; this stays under it
    }

    if (candidates.size === 0 && useOpenverse) {
      const queries = [`"${herb.pharmaceutical}"`];
      const species = speciesOf(herb.botanical);
      if (/^[A-Z][a-z]+ [a-z-]+/.test(species)) queries.push(`${species} dried`);
      for (const query of queries) {
        try {
          for (const raw of await openverseSearch(query)) {
            if (rejects[raw.page] || candidates.has(raw.page)) continue;
            if (!judge(raw.text, herb, terms)?.score) continue;
            const verified = await verifyAtSource(raw);
            await sleep(500);
            if (!verified) continue;
            const verdict = judge(verified.text, herb, terms);
            if (verdict?.score) candidates.set(verified.page, { ...verified, ...verdict, query, viaOpenverse: true });
          }
        } catch (e) {
          error = `openverse: ${String(e.message ?? e).slice(0, 80)}`;
        }
        if (openverseFailures >= 3) break;
        await sleep(3200); // 20 a minute, anonymous
      }
    }

    const ranked = [...candidates.values()].sort(
      (a, b) => b.score - a.score || a.licenceRank - b.licenceRank || b.pixels - a.pixels,
    );
    let pick = null;
    const file = `${slugOf(herb.pinyin)}-material.jpg`;
    for (const candidate of ranked) {
      if (dry) {
        pick = candidate;
        break;
      }
      try {
        if (candidate.source === 'Wikimedia Commons')
          candidate.download = await thumbnailOf(candidate.title, candidate.download);
        const got = await download(candidate.download, path.join(outDir, file));
        pick = { ...candidate, bytes: got.bytes, longest: got.longest };
        break;
      } catch (e) {
        error = `download: ${e.message}`;
      }
    }

    const now = new Date().toISOString();
    if (!pick) {
      // Keep whatever the plant pass found; just remember the material was looked for.
      manifest[key] = { ...previous, form: previous.file ? 'plant' : undefined, materialCheckedAt: now, materialError: error ?? undefined };
      if (manifest[key].form === undefined) delete manifest[key].form;
      if (!error) delete manifest[key].materialError;
      summary.none += 1;
      if (error) summary.errors += 1;
      console.log(`  -   ${key.padEnd(18)} ${herb.chinese.padEnd(6)} no material photo${error ? ' (' + error + ')' : ''} · ${elapsed()}`);
      if (!dry) fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
      continue;
    }
    // The plant photograph this replaces is kept aside, so a pick rejected on
    // review falls back to it without another search.
    const plant =
      previous.file && previous.form !== 'material'
        ? { ...previous, form: 'plant' }
        : previous.plant;
    manifest[key] = {
      botanical: herb.botanical,
      species: speciesOf(herb.botanical),
      chinese: herb.chinese,
      pharmaceutical: herb.pharmaceutical,
      form: 'material',
      file,
      source: pick.source,
      title: pick.title,
      matched: pick.matched,
      score: pick.score,
      author: pick.author,
      page: pick.page,
      licence: pick.licence,
      licenceRaw: pick.licenceRaw,
      licenceUrl: pick.licenceUrl,
      creditRequired: pick.creditRequired,
      bytes: pick.bytes,
      longest: pick.longest,
      materialCheckedAt: now,
      checkedAt: now,
      plant,
    };
    if (!plant) delete manifest[key].plant;
    summary.material += 1;
    if (pick.viaOpenverse) summary.openverse += 1;
    picked.push(key);
    console.log(
      `  ✓   ${key.padEnd(18)} ${herb.chinese.padEnd(6)} ${pick.source} · ${pick.licence} · ${pick.title.slice(0, 70)} · ${elapsed()}`,
    );
    // Written after every herb, so a stopped run resumes where it was.
    if (!dry) fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  }

  if (!dry) {
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
    writeCredits(manifest);
    removeOrphans(manifest);
  }
  console.log(
    `\n${herbs.length} herbs: ${summary.material} material photos (${summary.openverse} via Openverse), ${summary.kept} already checked, ${summary.none} without material, ${summary.errors} errors`,
  );
  if (sheets && !dry) await contactSheets(manifest, picked.length ? picked : Object.keys(manifest));
}

/** A photograph nothing in the manifest points at any more is deleted, so the repository carries only what is shown. */
function removeOrphans(manifest) {
  const referenced = new Set(
    Object.values(manifest).flatMap((e) => [e.file, e.plant?.file]).filter(Boolean),
  );
  for (const name of fs.readdirSync(outDir)) {
    if (!/\.(jpe?g|png)$/i.test(name) || referenced.has(name)) continue;
    fs.unlinkSync(path.join(outDir, name));
    console.log(`  removed ${name} (no longer referenced)`);
  }
}

/**
 * Contact sheets for review by eye: twenty thumbnails a page, each labelled
 * with its pinyin, under test-results/herb-sheets. The judge above reads
 * captions; only a person can see that "dried root" is a photograph of a
 * pile of twigs.
 */
async function contactSheets(manifest, keys) {
  const sharp = loadSharp();
  if (!sharp) return;
  const dir = path.join(root, 'test-results', 'herb-sheets');
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const entries = keys.filter((k) => manifest[k]?.file && manifest[k].form === 'material').sort();
  const cols = 5;
  const rows = 4;
  const cell = 240;
  const label = 34;
  for (let page = 0; page * cols * rows < entries.length; page += 1) {
    const slice = entries.slice(page * cols * rows, (page + 1) * cols * rows);
    const composites = [];
    let svg = `<svg width="${cols * cell}" height="${rows * (cell + label)}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#fff"/>`;
    for (let i = 0; i < slice.length; i += 1) {
      const e = manifest[slice[i]];
      const x = (i % cols) * cell;
      const y = Math.floor(i / cols) * (cell + label);
      const buf = await sharp(fs.readFileSync(path.join(outDir, e.file)))
        .resize(cell - 8, cell - 8, { fit: 'cover' })
        .jpeg()
        .toBuffer();
      composites.push({ input: buf, left: x + 4, top: y + 4 });
      const text = `${page * cols * rows + i + 1}. ${slice[i]} ${e.chinese ?? ''}`.replace(/&/g, '&amp;').replace(/</g, '&lt;');
      svg += `<text x="${x + 6}" y="${y + cell + 22}" font-family="Segoe UI, Arial, sans-serif" font-size="17" fill="#111">${text}</text>`;
    }
    svg += '</svg>';
    const file = path.join(dir, `sheet-${String(page + 1).padStart(2, '0')}.jpg`);
    await sharp(Buffer.from(svg)).composite(composites).jpeg({ quality: 85 }).toFile(file);
    console.log(`  sheet ${file}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
