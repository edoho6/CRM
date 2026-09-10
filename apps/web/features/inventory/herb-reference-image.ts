import manifest from './herb-reference-images.json';

/**
 * The reference photograph that ships with the catalogue, for a herb that
 * has no photograph of its own.
 *
 * Every clinic's catalogue is its own rows, but a plant looks the same in
 * every clinic, so the photographs live once, in the app, keyed by the
 * species. A clinic's own upload (`herbs.image_url`) always wins; this is
 * only what shows until there is one. The licences are CC0 or CC BY —
 * chosen by scripts/fetch-herb-images.mjs and fetch-herb-material-images.mjs,
 * which refuse anything else — and CC BY needs its credit shown.
 *
 * `form` says what the photograph is of: the dried material as dispensed
 * (preferred, and what a practitioner recognises) or, failing that, the
 * living plant. The caption tells the two apart.
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
  form: 'material' | 'plant';
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
  form?: string;
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
  if (key && entry.form !== 'material' && !bySpecies.has(key)) bySpecies.set(key, entry);
}

export function referenceImageFor(herb: {
  botanical_name?: string | null;
  pinyin_name?: string | null;
}): ReferenceImage | null {
  // Pinyin first: twig and bark of the same cinnamon are one species and two
  // materials. The species is the fallback for a herb the clinic renamed.
  const entry =
    byPinyin.get((herb.pinyin_name ?? '').trim().toLowerCase()) ??
    bySpecies.get(speciesKey(herb.botanical_name));
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
    form: entry.form === 'material' ? 'material' : 'plant',
  };
}
