/**
 * A reference photograph for every herb in the starter catalogue.
 *
 * For each botanical name in supabase/seed/herbs, asks — in this order —
 * iNaturalist, Wikimedia Commons and GBIF for a photograph of exactly that
 * species, and keeps one only when its licence plainly allows use inside
 * commercial software: CC0 or public domain first, CC BY when that is all
 * there is. Non-commercial, share-alike, "all rights reserved" and anything
 * ambiguous are refused, and the herb is left without a picture.
 *
 * Species identity is checked, not guessed: iNaturalist is asked for the
 * taxon by name and only research-grade observations of that taxon are used;
 * a Commons file must be categorised under, or titled with, the species;
 * GBIF is asked to match the name to a taxon first and its media are taken
 * only from occurrences of that taxon. A name that matches nothing, or only a
 * different species, yields nothing.
 *
 * Output: apps/web/public/herbs/<slug>.jpg and
 *         apps/web/features/inventory/herb-reference-images.json
 *         (source, author, page, licence, licence link, credit required),
 *         plus apps/web/public/herbs/CREDITS.md, the same list for people.
 *
 * Usage: node scripts/fetch-herb-images.mjs [--only=Huang Qi,Dang Gui] [--dry]
 * Re-runs are cheap: a herb already in the manifest is not asked for again
 * unless --refresh is given.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSharp, shrink } from './shrink-herb-images.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const seedDir = path.join(root, 'supabase', 'seed', 'herbs');
const outDir = path.join(root, 'apps', 'web', 'public', 'herbs');
const manifestPath = path.join(
  root,
  'apps',
  'web',
  'features',
  'inventory',
  'herb-reference-images.json',
);
const creditsPath = path.join(outDir, 'CREDITS.md');

const args = new Set(process.argv.slice(2));
const only =
  [...args]
    .find((a) => a.startsWith('--only='))
    ?.slice(7)
    .split(',')
    .map((s) => s.trim()) ?? null;
const dry = args.has('--dry');
const refresh = args.has('--refresh');
/** --retry-errors asks again for herbs whose last attempt failed on the download. */
const retryErrors = args.has('--retry-errors');
const sharp = loadSharp();

const UA = 'herbalist-clinic-catalogue/1.0 (open-licence reference images for a clinic app)';

/** Licences that plainly allow commercial use inside software, best first. */
const ACCEPTED = [
  {
    test: (s) =>
      /^cc0\b|creativecommons\.org\/publicdomain\/zero|^public domain$|^pd(m)?\b/i.test(s),
    id: 'CC0',
    url: 'https://creativecommons.org/publicdomain/zero/1.0/',
    credit: false,
    rank: 0,
  },
  {
    test: (s) => /^cc[- ]by(?![- ]?(nc|sa|nd))/i.test(s),
    id: 'CC BY',
    url: 'https://creativecommons.org/licenses/by/4.0/',
    credit: true,
    rank: 1,
  },
];

function classifyLicence(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  for (const l of ACCEPTED) if (l.test(s)) return { ...l, raw: s };
  return null;
}

/** "Astragalus membranaceus (Radix)" → "Astragalus membranaceus"; drops authors and parts. */
function speciesOf(botanical) {
  let name = botanical.split('(')[0].trim();
  name = name.replace(/\b(var|subsp|ssp|f)\.\s+\S+/g, (m) => m); // keep infraspecific epithets
  // Several species listed: the first is the one the catalogue means first.
  name = name.split(/\s+(?:or|and|\/|,)\s+/i)[0].trim();
  // Author abbreviations after the epithet (e.g. "Fisch.", "L.").
  const parts = name.split(/\s+/);
  const kept = [parts[0], parts[1]];
  if (parts[2] && /^(var|subsp|ssp|f)\.$/.test(parts[2]) && parts[3]) kept.push(parts[2], parts[3]);
  return kept.filter(Boolean).join(' ');
}

function isPlantName(botanical) {
  return (
    /^[A-Z][a-z]+ [a-z][a-z-]+/.test(botanical) &&
    !/\(mineral|Colla|Succus/i.test(botanical) === true
  );
}

function slugOf(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

/* ---- iNaturalist -------------------------------------------------------- */

async function fromINaturalist(species) {
  const taxa = await getJson(
    `https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(species)}&per_page=10`,
  );
  const wanted = species.toLowerCase();
  // Exact name — accepted or a synonym iNaturalist itself matched — at species rank or below.
  const taxon = (taxa.results ?? []).find(
    (t) =>
      ['species', 'subspecies', 'variety', 'hybrid'].includes(t.rank) &&
      (t.name?.toLowerCase() === wanted || t.matched_term?.toLowerCase() === wanted),
  );
  if (!taxon) return null;
  await sleep(350);
  const obs = await getJson(
    `https://api.inaturalist.org/v1/observations?taxon_id=${taxon.id}&photo_license=cc0,cc-by&quality_grade=research&photos=true&per_page=12&order_by=votes`,
  );
  for (const o of obs.results ?? []) {
    // Belt and braces: the observation's own identified taxon must be ours.
    if (o.taxon?.id !== taxon.id) continue;
    for (const p of o.photos ?? []) {
      const licence = classifyLicence(p.license_code);
      if (!licence) continue;
      // "(c) Name, some rights reserved (CC BY), uploaded by Name" for CC BY;
      // "no rights reserved, uploaded by Name" for CC0 — the uploader is the author.
      const attribution = p.attribution ?? '';
      const uploaded = attribution.match(/uploaded by (.+)$/i)?.[1]?.trim();
      const named = attribution
        .replace(/^\(c\)\s*/i, '')
        .replace(/,\s*(some|no) rights reserved.*$/i, '')
        .trim();
      const author =
        (/^no rights reserved/i.test(attribution) ? uploaded : named || uploaded) ||
        o.user?.name ||
        o.user?.login ||
        'unknown';
      return {
        source: 'iNaturalist',
        taxon: taxon.name,
        matched: taxon.matched_term ?? taxon.name,
        author,
        page: `https://www.inaturalist.org/photos/${p.id}`,
        observation: `https://www.inaturalist.org/observations/${o.id}`,
        licence: licence.id,
        licenceRaw: p.license_code,
        licenceUrl: licence.url,
        creditRequired: licence.credit,
        download: (p.url ?? '').replace('/square.', '/medium.').replace('/small.', '/medium.'),
      };
    }
  }
  return null;
}

/* ---- Wikimedia Commons ------------------------------------------------- */

async function fromCommons(species) {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(`"${species}"`)}&gsrnamespace=6&gsrlimit=15&prop=imageinfo|categories&cllimit=50&iiprop=url|extmetadata|mime|size&iiurlwidth=900&format=json`;
  const data = await getJson(url);
  const wanted = species.toLowerCase();
  const pages = Object.values(data.query?.pages ?? {});
  const candidates = [];
  for (const p of pages) {
    const info = p.imageinfo?.[0];
    if (!info || !/^image\/(jpeg|png)$/.test(info.mime ?? '')) continue;
    if (Math.max(info.width ?? 0, info.height ?? 0) < 300) continue;
    const meta = info.extmetadata ?? {};
    const licence = classifyLicence(meta.LicenseShortName?.value);
    if (!licence) continue;
    // Identity: the file sits in the species' own category on Commons, or is
    // titled with the species. A mention in the description was not enough —
    // it matched a scanned page of a herbal that discussed the plant, and a
    // bottle of liquor named after it.
    const categories = (p.categories ?? []).map((c) =>
      c.title.replace(/^Category:/, '').toLowerCase(),
    );
    const title = p.title.replace(/^File:/, '').toLowerCase();
    const inSpeciesCategory = categories.some(
      (c) => c === wanted || c.startsWith(wanted + ' ') || c.startsWith(wanted + ' -'),
    );
    if (!inSpeciesCategory && !title.startsWith(wanted)) continue;
    // Not a picture of the plant: pages, packaging, products, maps.
    const notThePlant =
      /\b(text|page|manuscript|book|scan|liquor|wine|label|packag|product|bottle|capsule|tablet|map|logo|stamp)\b/i;
    if (notThePlant.test(title) || categories.some((c) => notThePlant.test(c))) continue;
    const author = (meta.Artist?.value ?? '').replace(/<[^>]+>/g, '').trim() || 'unknown';
    candidates.push({
      rank: licence.rank,
      pick: {
        source: 'Wikimedia Commons',
        taxon: species,
        matched: species,
        author,
        page: info.descriptionurl,
        licence: licence.id,
        licenceRaw: meta.LicenseShortName?.value,
        licenceUrl: meta.LicenseUrl?.value || licence.url,
        creditRequired: licence.credit,
        download: info.thumburl || info.url,
      },
    });
  }
  candidates.sort((a, b) => a.rank - b.rank);
  return candidates[0]?.pick ?? null;
}

/* ---- GBIF -------------------------------------------------------------- */

async function fromGbif(species) {
  const match = await getJson(
    `https://api.gbif.org/v1/species/match?name=${encodeURIComponent(species)}&strict=true`,
  );
  if (
    !match.usageKey ||
    !['EXACT'].includes(match.matchType) ||
    !['SPECIES', 'SUBSPECIES', 'VARIETY'].includes(match.rank)
  )
    return null;
  const key = match.acceptedUsageKey ?? match.usageKey;
  await sleep(250);
  const occ = await getJson(
    `https://api.gbif.org/v1/occurrence/search?taxonKey=${key}&mediaType=StillImage&license=CC0_1_0&license=CC_BY_4_0&limit=20`,
  );
  for (const o of occ.results ?? []) {
    for (const m of o.media ?? []) {
      if (m.type !== 'StillImage' || !m.identifier) continue;
      const licence = classifyLicence(
        m.license?.includes('zero') ? 'CC0' : m.license?.includes('/by/') ? 'CC BY' : '',
      );
      if (!licence) continue;
      return {
        source: 'GBIF',
        taxon: match.scientificName,
        matched: species,
        author: m.creator || m.rightsHolder || o.recordedBy || 'unknown',
        page: m.references || `https://www.gbif.org/occurrence/${o.key}`,
        licence: licence.id,
        licenceRaw: m.license,
        licenceUrl: licence.url,
        creditRequired: licence.credit,
        download: m.identifier,
      };
    }
  }
  return null;
}

/* ---- main -------------------------------------------------------------- */

function readCatalogue() {
  const herbs = [];
  for (const file of fs.readdirSync(seedDir).sort()) {
    const text = fs.readFileSync(path.join(seedDir, file), 'utf8');
    for (const m of text.matchAll(
      /upsert_herb\('([^']*)','([^']*)','([^']*)','([^']*)','([^']*)'/g,
    )) {
      herbs.push({
        pinyin: m[1],
        chinese: m[2],
        botanical: m[3],
        pharmaceutical: m[4],
        english: m[5],
      });
    }
  }
  return herbs;
}

async function download(url, file) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`download ${res.status}`);
  const type = res.headers.get('content-type') ?? '';
  if (!/^image\/(jpeg|png)/.test(type)) throw new Error(`not an image: ${type}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  // Anything up to twenty megabytes is welcome when it can be shrunk here;
  // without sharp the cap has to be what the repository can carry.
  if (buffer.length > (sharp ? 20_000_000 : 1_500_000))
    throw new Error(`too large: ${Math.round(buffer.length / 1024)} KB`);
  fs.writeFileSync(file, buffer);
  let longest = null;
  if (sharp) ({ longest } = await shrink(sharp, file));
  if (longest !== null && longest < 300) {
    fs.unlinkSync(file);
    throw new Error(`too small: ${longest} px`);
  }
  return { bytes: fs.statSync(file).size, longest };
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const manifest = fs.existsSync(manifestPath)
    ? JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
    : {};
  const herbs = readCatalogue().filter((h) => !only || only.includes(h.pinyin));
  const summary = { found: 0, kept: 0, skippedNonPlant: 0, none: 0, errors: 0 };

  for (const herb of herbs) {
    const key = herb.pinyin;
    const previous = manifest[key];
    // Any recorded error — a download that failed, a source that rate-limited — is worth another try.
    const failedDownload = Boolean(previous?.error);
    if (
      !refresh &&
      previous &&
      (previous.file || (previous.result === 'none' && !(retryErrors && failedDownload)))
    ) {
      summary.kept += 1;
      continue;
    }
    if (!isPlantName(herb.botanical)) {
      manifest[key] = {
        botanical: herb.botanical,
        result: 'not a plant',
        checkedAt: new Date().toISOString(),
      };
      summary.skippedNonPlant += 1;
      continue;
    }
    const species = speciesOf(herb.botanical);
    let pick = null;
    let error = null;
    const file = `${slugOf(species)}.jpg`;
    for (const source of [fromINaturalist, fromCommons, fromGbif]) {
      let candidate = null;
      try {
        candidate = await source(species);
      } catch (e) {
        error = `${source.name}: ${String(e.message ?? e).slice(0, 120)}`;
      }
      if (candidate && !dry) {
        try {
          const got = await download(candidate.download, path.join(outDir, file));
          candidate.bytes = got.bytes;
          candidate.longest = got.longest;
        } catch (e) {
          error = `download (${candidate.source}): ${e.message}`;
          candidate = null;
        }
      }
      if (candidate) {
        pick = candidate;
        break;
      }
      await sleep(400);
    }
    if (!pick) {
      manifest[key] = {
        botanical: herb.botanical,
        species,
        result: 'none',
        error,
        checkedAt: new Date().toISOString(),
      };
      if (error && /^download/.test(error)) summary.errors += 1;
      else summary.none += 1;
      console.log(
        `  -   ${key.padEnd(18)} ${species.padEnd(34)} no usable photo${error ? ' (' + error + ')' : ''}`,
      );
      continue;
    }
    manifest[key] = {
      botanical: herb.botanical,
      species,
      file,
      source: pick.source,
      taxon: pick.taxon,
      author: pick.author,
      page: pick.page,
      observation: pick.observation,
      licence: pick.licence,
      licenceRaw: pick.licenceRaw,
      licenceUrl: pick.licenceUrl,
      creditRequired: pick.creditRequired,
      bytes: pick.bytes,
      longest: pick.longest,
      checkedAt: new Date().toISOString(),
    };
    summary.found += 1;
    console.log(
      `  ✓   ${key.padEnd(18)} ${species.padEnd(34)} ${pick.source} · ${pick.licence} · ${pick.author}`,
    );
    await sleep(400);
  }

  if (!dry) {
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
    writeCredits(manifest);
  }
  console.log(
    `\n${herbs.length} herbs: ${summary.found} new photos, ${summary.kept} already done, ${summary.none} without a usable photo, ${summary.skippedNonPlant} not plants, ${summary.errors} download errors`,
  );
}

function writeCredits(manifest) {
  const lines = [
    '# Reference photographs · credits',
    '',
    'Every photograph here is used under a licence that permits use inside commercial software.',
    'CC0 needs no credit; CC BY requires the credit shown. Refused: NC, SA, ND, all rights reserved, unclear.',
    '',
    '| Herb | Species | Source | Author | Licence | Page |',
    '|---|---|---|---|---|---|',
  ];
  for (const [pinyin, e] of Object.entries(manifest).sort()) {
    if (!e.file) continue;
    lines.push(
      `| ${pinyin} | ${e.species} | ${e.source} | ${e.author} | [${e.licence}](${e.licenceUrl}) | [page](${e.page}) |`,
    );
  }
  fs.writeFileSync(creditsPath, lines.join('\n') + '\n');
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
