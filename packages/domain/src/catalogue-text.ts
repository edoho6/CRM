// The catalogue's clinical text comes in two languages: the Hebrew in the
// row's own columns, the English in `text_en` under the same field names
// (migration 57). A screen asks for a field in the reader's language and
// gets the Hebrew back when the English is missing — an entry a
// practitioner wrote by hand has one language, and it must not vanish in
// the English interface.

export type CatalogueLocale = 'he' | 'en';

export interface CatalogueSourceRef {
  name: 'bara' | 'americandragon' | string;
  url: string;
  title?: string | null;
}

export interface CatalogueTextRow {
  text_en?: Record<string, unknown> | null;
  sources?: unknown;
}

/** The field in the reader's language, or the Hebrew when there is no English for it. */
export function localizedField<Row extends CatalogueTextRow>(
  row: Row,
  field: string & keyof Row,
  locale: string,
): string | null {
  const hebrew = row[field];
  const own = typeof hebrew === 'string' && hebrew.trim() ? hebrew : null;
  if (locale !== 'en') return own;
  const english = row.text_en?.[field];
  return typeof english === 'string' && english.trim() ? english : own;
}

/** The sources a row carries, as a clean list — a value that is not a list of {name, url} is ignored. */
export function catalogueSources(row: CatalogueTextRow): CatalogueSourceRef[] {
  if (!Array.isArray(row.sources)) return [];
  return row.sources.filter(
    (entry): entry is CatalogueSourceRef =>
      Boolean(entry) &&
      typeof entry === 'object' &&
      typeof (entry as CatalogueSourceRef).name === 'string' &&
      typeof (entry as CatalogueSourceRef).url === 'string' &&
      /^https?:\/\//.test((entry as CatalogueSourceRef).url),
  );
}
