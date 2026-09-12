import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { MedEntry, MedLink, MedLinkedEntry } from '@clinic/db/types';

/**
 * Reads of the Western medicine reference.
 *
 * The tables are shared by every clinic — a condition is the same condition
 * everywhere — so there is no clinic_id and no writing from the app: the
 * corpus arrives through `med_import`, which the platform admin runs from
 * the pipeline (scripts/medicine). What the app does is read, through the
 * caller's own policies, so a caller without a clinic reads nothing.
 */

/** The columns a list row needs; the sections and quotes stay on the entry page. */
export const MED_LIST_COLUMNS =
  'id, kind, slug, wikidata_id, name_en, name_he, aliases_he, identifiers, status, summary_he, summary_en, cross_check';

export type MedListRow = Pick<
  MedEntry,
  'id' | 'kind' | 'slug' | 'wikidata_id' | 'name_en' | 'name_he' | 'aliases_he' | 'identifiers' | 'status' | 'summary_he' | 'summary_en' | 'cross_check'
>;

export async function loadMedicineEntry(
  db: SupabaseClient,
  by: { id?: string | null; slug?: string | null },
): Promise<MedEntry | null> {
  const query = by.id
    ? db.from('med_entries').select('*').eq('id', by.id)
    : by.slug
      ? db.from('med_entries').select('*').eq('slug', by.slug)
      : null;
  if (!query) return null;
  const { data, error } = await query.maybeSingle<MedEntry>();
  if (error) return null;
  return data;
}

/**
 * Every link that touches an entry, read from both ends, with the other end
 * named. `direction` says who makes the claim: on a drug's page "treats" is
 * outgoing (the drug treats the condition); on the condition's page the same
 * link is incoming (the condition is treated by the drug). The page groups by
 * relation and direction, so each group reads as a sentence.
 */
export async function loadMedicineLinks(db: SupabaseClient, id: string): Promise<MedLinkedEntry[]> {
  const { data: links } = await db
    .from('med_links')
    .select('from_id, to_id, relation, source')
    .or(`from_id.eq.${id},to_id.eq.${id}`)
    .limit(500)
    .returns<MedLink[]>();
  const rows = links ?? [];
  const otherIds = [...new Set(rows.map((link) => (link.from_id === id ? link.to_id : link.from_id)))];
  if (otherIds.length === 0) return [];

  const { data: entries } = await db
    .from('med_entries')
    .select('id, slug, kind, name_he, name_en')
    .in('id', otherIds)
    .returns<MedLinkedEntry['entry'][]>();
  const byId = new Map((entries ?? []).map((entry) => [entry.id, entry]));

  // The same pair can be claimed by several sources; the reader sees the
  // entry once, and the first source that named it.
  const seen = new Set<string>();
  const out: MedLinkedEntry[] = [];
  for (const link of rows) {
    const direction = link.from_id === id ? 'out' : 'in';
    const entry = byId.get(direction === 'out' ? link.to_id : link.from_id);
    if (!entry) continue;
    const key = `${link.relation}|${direction}|${entry.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ relation: link.relation, source: link.source, direction, entry });
  }
  const collator = new Intl.Collator('he');
  return out.sort((a, b) => collator.compare(a.entry.name_he ?? a.entry.name_en, b.entry.name_he ?? b.entry.name_en));
}
