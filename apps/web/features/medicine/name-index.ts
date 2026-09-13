import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { prepareMentionIndex, type MentionCandidate, type PreparedMentionCandidate } from '@clinic/domain';

/**
 * Every name the reference answers to, compiled once and kept in memory.
 *
 * The reference is the same for every clinic and changes only when the
 * platform admin imports a new corpus, so the index is read once an hour
 * for the whole server rather than once a keystroke: three thousand rows of
 * names is too much to fetch under a text field. It holds no patient data —
 * only the corpus's own names — and it is read through a member's policies,
 * so a caller without a clinic still gets nothing from the action that uses
 * it. An empty or failed read is never kept: the next call tries again.
 */

const TTL_MS = 60 * 60 * 1000;
/** PostgREST answers a thousand rows at most per request, whatever the limit says. */
const PAGE = 1000;
/** Symptoms ("pain", "fever") and lab tests are everywhere in a file's prose; a chip on each would be noise. */
const KINDS = ['condition', 'drug'] as const;

interface NameRow {
  id: string;
  slug: string;
  kind: MentionCandidate['kind'];
  name_he: string | null;
  name_en: string;
  aliases_he: string[] | null;
  aliases_en: string[] | null;
}

let cache: { at: number; index: PreparedMentionCandidate[] } | null = null;
let inflight: Promise<PreparedMentionCandidate[]> | null = null;

async function readIndex(db: SupabaseClient): Promise<PreparedMentionCandidate[]> {
  const candidates: MentionCandidate[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from('med_entries')
      .select('id, slug, kind, name_he, name_en, aliases_he, aliases_en')
      .in('kind', [...KINDS])
      .order('id')
      .range(from, from + PAGE - 1)
      .returns<NameRow[]>();
    if (error) throw error;
    for (const row of data ?? []) {
      candidates.push({
        id: row.id,
        slug: row.slug,
        kind: row.kind,
        label: row.name_he ?? row.name_en,
        // The English aliases run long on Wikidata; the first few are the ones people use.
        names: [row.name_he, row.name_en, ...(row.aliases_he ?? []), ...(row.aliases_en ?? []).slice(0, 8)].filter(
          (name): name is string => Boolean(name),
        ),
      });
    }
    if (!data || data.length < PAGE) break;
  }
  return prepareMentionIndex(candidates);
}

export async function loadMedicineNameIndex(db: SupabaseClient): Promise<PreparedMentionCandidate[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.index;
  if (inflight) return inflight;
  inflight = readIndex(db)
    .then((index) => {
      if (index.length > 0) cache = { at: Date.now(), index };
      return index;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}
