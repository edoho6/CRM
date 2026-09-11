/**
 * Wikimedia Commons, for the scripts that bring openly licensed pictures
 * into the app.
 *
 * Only three licences pass: CC0, CC BY and CC BY-SA — the ones that plainly
 * allow use inside commercial software. Share-alike is fine because a
 * picture is shown as received (downscaled, never edited), so no adapted
 * work exists. NC, ND, "all rights reserved" and anything unclear are refused
 * here, before a file is ever downloaded.
 *
 * The herb scripts (fetch-herb-images.mjs, fetch-herb-material-images.mjs)
 * predate this module and keep their own copies of these functions; their
 * runs were reviewed by eye and committed, so they are left as they were.
 */
import fs from 'node:fs';
import { shrink } from '../shrink-herb-images.mjs';

export const UA = 'herbalist-clinic-catalogue/1.0 (open-licence reference images for a clinic app)';

/** Licences that plainly allow commercial use inside software, best first. */
export const ACCEPTED = [
  {
    test: (s) => /^cc0\b|creativecommons\.org\/publicdomain\/zero|^public domain$|^pd(m)?\b/i.test(s),
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
  {
    test: (s) => /^cc[- ]by[- ]sa(?![- ]?(nc|nd))/i.test(s),
    id: 'CC BY-SA',
    url: 'https://creativecommons.org/licenses/by-sa/4.0/',
    credit: true,
    rank: 2,
  },
];

export function classifyLicence(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  for (const l of ACCEPTED) if (l.test(s)) return { ...l, raw: s };
  return null;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function slugOf(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** How often Commons asked us to slow down; printed at the end of a run. */
export const stats = { throttled: 0 };

/**
 * Commons search: up to `limit` bitmap files matching the query, with the
 * licence read from each file's own metadata. Files under a refused licence,
 * or smaller than 300 px, are not returned at all.
 */
export async function commonsSearch(query, { verbose = false, limit = 25 } = {}) {
  const restUrl =
    'https://commons.wikimedia.org/w/rest.php/v1/search/page?' +
    new URLSearchParams({ q: `filetype:bitmap ${query}`, limit: String(limit) });
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
      stats.throttled += 1;
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
      // No thumbnail width here: asking for one renders every thumbnail per
      // query, and that is what gets a client throttled. The one file chosen
      // gets its 900 px rendering afterwards, in thumbnailOf().
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
      if (attempt >= 3 || !/too many requests|maxlag/i.test(text)) throw new Error(text.slice(0, 60));
      stats.throttled += 1;
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
      description,
      categories,
      text: [title, description, ...categories].join(' \n '),
      author: (meta.Artist?.value ?? '').replace(/<[^>]+>/g, '').trim() || 'unknown',
      page: info.descriptionurl,
      licence: licence.id,
      licenceRank: licence.rank,
      licenceRaw: meta.LicenseShortName?.value,
      licenceUrl: meta.LicenseUrl?.value || licence.url,
      creditRequired: licence.credit,
      download: info.url,
      width: info.width ?? 0,
      height: info.height ?? 0,
      pixels: (info.width ?? 0) * (info.height ?? 0),
    });
  }
  return out;
}

/** The 900 px rendering of one Commons file, or the original when Commons will not render it. */
export async function thumbnailOf(title, fallback) {
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
 * Downloads one picture to `file` and shrinks it to 640 px on the long side
 * when sharp is available (it comes with Next.js). Refuses anything that is
 * not a JPEG/PNG/WebP, anything over twenty megabytes, and anything that
 * turns out smaller than 300 px.
 */
export async function download(url, file, sharp) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`download ${res.status}`);
  const type = res.headers.get('content-type') ?? '';
  if (!(sharp ? /^image\/(jpeg|png|webp)/ : /^image\/(jpeg|png)/).test(type)) throw new Error(`not an image: ${type}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length > (sharp ? 20_000_000 : 1_500_000)) throw new Error(`too large: ${Math.round(buffer.length / 1024)} KB`);
  fs.writeFileSync(file, buffer);
  let longest = null;
  if (sharp) ({ longest } = await shrink(sharp, file));
  if (longest !== null && longest < 300) {
    fs.unlinkSync(file);
    throw new Error(`too small: ${longest} px`);
  }
  return { bytes: fs.statSync(file).size, longest };
}
