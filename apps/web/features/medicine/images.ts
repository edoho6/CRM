import manifest from './medicine-images.json';

/** One picture of the reference as the manifest records it (scripts/medicine/images.mjs). */
export interface MedicineImageRecord {
  file: string;
  title: string;
  source: string;
  author: string | null;
  credit: string | null;
  description: string | null;
  page: string;
  licence: string;
  licenceRaw: string;
  licenceUrl: string;
  creditRequired: boolean;
  bytes: number;
  checkedAt: string;
}

/** Every picture the reference shows, by the Wikidata id of its entry — for the credits page. */
export function medicineImageCredits(): Array<{ qid: string; image: MedicineImageRecord & { src: string } }> {
  return Object.entries(manifest as Record<string, MedicineImageRecord>)
    .map(([qid, image]) => ({ qid, image: { ...image, src: `/medicine/images/${image.file}` } }))
    .sort((a, b) => a.image.title.localeCompare(b.image.title));
}
