import manifest from './herb-reference-images.json';

/**
 * The reference photograph that ships with the catalogue, for a herb that
 * has no photograph of its own.
 *
 * Every clinic's catalogue is its own rows, but a plant looks the same in
 * every clinic, so the photographs live once, in the app, keyed by the
 * species. A clinic's own upload (`herbs.image_url`) always wins; this is
 * only what shows until there is one. The licences are CC0 or CC BY —
 * chosen by scripts/fetch-herb-images.mjs, which refuses anything else —
 * and CC BY needs its credit shown, which `credit` carries.
 */
export interface ReferenceImage {
  /** Path under the site root. */
  src: string;
  species: string;
  source: string;
  author: string;
  page: string;
  licence: string;
  licenceUrl: string;
  creditRequired: boolean;
}

interface ManifestEntry {
  botanical?: string;
  species?: string;
  file?: string;
  source?: string;
  author?: string;
  page?: string;
  licence?: string;
  licenceUrl?: string;
  creditRequired?: boolean;
  result?: string;
}

const entries = manifest as Record<string, ManifestEntry>;

/** "Astragalus membranaceus (Radix)" → "astragalus membranaceus". */
function speciesKey(botanical: string | null | undefined): string {
  if (!botanical) return '';
  const name = botanical.split('(')[0]?.trim() ?? '';
  const parts = name.split(/\s+/);
  return [parts[0], parts[1]].filter(Boolean).join(' ').toLowerCase();
}

const bySpecies = new Map<string, ManifestEntry>();
const byPinyin = new Map<string, ManifestEntry>();
for (const [pinyin, entry] of Object.entries(entries)) {
  if (!entry.file) continue;
  byPinyin.set(pinyin.toLowerCase(), entry);
  const key = speciesKey(entry.species ?? entry.botanical);
  if (key && !bySpecies.has(key)) bySpecies.set(key, entry);
}

export function referenceImageFor(herb: {
  botanical_name?: string | null;
  pinyin_name?: string | null;
}): ReferenceImage | null {
  const entry =
    bySpecies.get(speciesKey(herb.botanical_name)) ??
    byPinyin.get((herb.pinyin_name ?? '').trim().toLowerCase());
  if (!entry?.file) return null;
  return {
    src: `/herbs/${entry.file}`,
    species: entry.species ?? entry.botanical ?? '',
    source: entry.source ?? '',
    author: entry.author ?? '',
    page: entry.page ?? '',
    licence: entry.licence ?? '',
    licenceUrl: entry.licenceUrl ?? '',
    creditRequired: entry.creditRequired === true,
  };
}
