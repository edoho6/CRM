import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  CanonNameIndex,
  TCM_GLOSSARY,
  answerFromCanon,
  type CanonBlock,
  type CanonEntry,
  type CanonKind,
  type CanonModelCall,
  type CanonNameRow,
  type CanonPassage,
  type CanonTurn,
} from '@clinic/domain';
import { LIBRARY_MODEL, LIBRARY_PLAN_MODEL, LibraryUnavailableError } from './claude';
import { embedQueries, libraryKey, rerankDocuments } from './voyage';

/**
 * The library chat's engine over the canon (migration 72), for the app: the
 * engine itself is `answerFromCanon` in the domain package — the same code the
 * trial script runs — and this file hands it the database and the services.
 *
 * Every read goes through the canon's functions with the service's key
 * (`libraryKey()`), which the practitioner never holds; the tables are closed to
 * everyone but the platform admin. The name list (a few thousand rows) is kept
 * in memory for ten minutes, so a question costs no read to find its herbs.
 */

const ENDPOINT = 'https://api.anthropic.com/v1/messages';
const NAMES_TTL_MS = 10 * 60 * 1000;
/** PostgREST hands back at most this many rows a call; the name list is read a page at a time. */
const PAGE = 1000;

let names: { index: CanonNameIndex; at: number } | null = null;
let pregnancy: { text: string; at: number } | null = null;

async function nameIndex(db: SupabaseClient): Promise<CanonNameIndex> {
  if (names && Date.now() - names.at < NAMES_TTL_MS) return names.index;
  const rows: CanonNameRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .rpc('canon_name_rows', { p_key: libraryKey() })
      .range(from, from + PAGE - 1);
    if (error) throw new LibraryUnavailableError('canon_names_failed');
    const page = (data ?? []) as { kind: CanonKind; key: string; entry_id: string }[];
    for (const row of page) rows.push({ kind: row.kind, key: row.key, entryId: row.entry_id });
    if (page.length < PAGE) break;
  }
  names = { index: new CanonNameIndex(rows), at: Date.now() };
  return names.index;
}

/** Whether the canon is loaded — until it is, the chat keeps answering the old way. */
export async function canonReady(db: SupabaseClient): Promise<boolean> {
  if (process.env.LIBRARY_ENGINE === 'legacy') return false;
  try {
    return (await nameIndex(db)).size > 0;
  } catch {
    return false;
  }
}

async function entries(db: SupabaseClient, ids: readonly string[]): Promise<CanonEntry[]> {
  if (!ids.length) return [];
  const { data, error } = await db.rpc('canon_entries_get', { p_ids: ids, p_key: libraryKey() });
  if (error) throw new LibraryUnavailableError('canon_entries_failed');
  const rows = (data ?? []) as {
    id: string;
    book: string;
    kind: CanonKind;
    page: number | null;
    associated_with: string | null;
    names: CanonEntry['names'];
    sections: Record<string, string>;
  }[];
  return rows.map((row) => ({
    id: row.id,
    book: row.book,
    kind: row.kind,
    page: row.page,
    associatedWith: row.associated_with,
    names: row.names ?? {},
    sections: row.sections ?? {},
  }));
}

interface SearchRow {
  via: 'vector' | 'text';
  passage_id: number;
  entry_id: string | null;
  section: string | null;
  heading: string;
  content: string;
}

/**
 * Passages by meaning (one call per query vector) and by words (the planner's
 * short phrases, every word required, on the first call), fused by rank, then
 * put in order by the reranker, which reads each passage against the question.
 */
async function search(
  db: SupabaseClient,
  input: {
    queries: string[];
    rerankQuery: string;
    exclude: ReadonlySet<string>;
    want: number;
    course?: boolean;
  },
): Promise<CanonPassage[]> {
  const course = input.course === true;
  const vectors = await embedQueries(input.queries);
  const phrases = input.queries.slice(1, 7).filter((q) => q.length <= 80);
  const results = await Promise.all(
    vectors.map((embedding, index) =>
      // The course layer is searched by meaning alone: its Hebrew does not meet the planner's English phrases.
      db.rpc('canon_search', {
        p_embedding: embedding,
        p_phrases: index === 0 && !course ? phrases : [],
        p_limit: 40,
        p_key: libraryKey(),
        p_course: course,
      }),
    ),
  );
  if (results.some((r) => r.error)) throw new LibraryUnavailableError('canon_search_failed');
  const byId = new Map<number, SearchRow>();
  const fused = new Map<number, number>();
  for (const result of results) {
    const found = (result.data ?? []) as SearchRow[];
    const lists: SearchRow[][] = [
      found.filter((r) => r.via === 'vector'),
      found.filter((r) => r.via === 'text'),
    ];
    for (const list of lists) {
      list.forEach((row, rank) => {
        byId.set(row.passage_id, row);
        fused.set(row.passage_id, (fused.get(row.passage_id) ?? 0) + 1 / (60 + rank));
      });
    }
  }
  const candidates = [...fused.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => byId.get(id)!)
    .filter(
      (row) =>
        !input.exclude.has(
          course ? `#course:${row.passage_id}` : (row.entry_id ?? `#${row.passage_id}`),
        ),
    )
    .slice(0, 60);
  if (!candidates.length) return [];
  const order = await rerankDocuments(
    input.rerankQuery,
    candidates.map((row) => `${row.heading}\n${row.content}`.slice(0, 4000)),
    Math.min(input.want * 2, candidates.length),
  );
  return order.map((i) => {
    const row = candidates[i]!;
    return {
      id: String(row.passage_id),
      entry: row.entry_id,
      section: row.section,
      heading: row.heading,
      text: row.content,
      course,
    };
  });
}

async function pregnancyNote(db: SupabaseClient): Promise<string> {
  if (pregnancy && Date.now() - pregnancy.at < NAMES_TTL_MS) return pregnancy.text;
  const { data } = await db.rpc('canon_note', { p_name: 'pregnancy_points', p_key: libraryKey() });
  pregnancy = { text: typeof data === 'string' ? data : '', at: Date.now() };
  return pregnancy.text;
}

/**
 * The four counts kept apart, because they are billed apart: plain input, a
 * cache write (dearer than input), a cache read (a tenth of it), and output.
 * They used to be summed into one number, and a question that read its notes
 * from the cache then looked exactly as expensive as one that wrote them —
 * which made the log useless for the only question anyone asks of it.
 */
export interface CanonUsage {
  input: number;
  cacheWrite: number;
  cacheRead: number;
  output: number;
}

/**
 * One model call, with the prompt cache on the blocks that ask for it. No
 * `temperature` (the Claude 5 models refuse it); `effort` only for Sonnet
 * (Haiku 4.5 answers 400 to it). An error carries a status, never a body — the
 * body could echo the practitioner's question.
 */
async function callModel(
  usage: CanonUsage,
  call: CanonModelCall,
  signal?: AbortSignal,
): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) throw new LibraryUnavailableError('not_configured');
  const model = call.model === 'answer' ? LIBRARY_MODEL : LIBRARY_PLAN_MODEL;
  const body = {
    model,
    max_tokens: call.maxTokens,
    system: call.system as string | CanonBlock[],
    messages: [{ role: 'user', content: call.content }],
    ...(call.effort && call.model === 'answer' ? { output_config: { effort: call.effort } } : {}),
  };
  for (let attempt = 1; ; attempt += 1) {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
      signal,
    });
    if ((response.status === 429 || response.status >= 500) && attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 3000));
      continue;
    }
    if (!response.ok) throw new LibraryUnavailableError(`http_${response.status}`);
    const payload = (await response.json()) as {
      content?: { type: string; text?: string }[];
      usage?: {
        input_tokens?: number;
        output_tokens?: number;
        cache_creation_input_tokens?: number;
        cache_read_input_tokens?: number;
      };
    };
    const u = payload.usage ?? {};
    usage.input += u.input_tokens ?? 0;
    usage.cacheWrite += u.cache_creation_input_tokens ?? 0;
    usage.cacheRead += u.cache_read_input_tokens ?? 0;
    usage.output += u.output_tokens ?? 0;
    const text = (payload.content ?? [])
      .filter((block) => block.type === 'text' && typeof block.text === 'string')
      .map((block) => block.text)
      .join('\n');
    // Now and then a reply comes back empty; it is asked once more.
    if (text.trim() || attempt >= 2) return text;
  }
}

export type CanonStage = 'searching' | 'reading' | 'writing' | 'checking';

export async function askCanon(
  db: SupabaseClient,
  question: string,
  history: readonly CanonTurn[],
  onStage?: (stage: CanonStage) => void,
  options: { course?: boolean } = {},
): Promise<{ answer: string; usage: CanonUsage }> {
  const usage: CanonUsage = { input: 0, cacheWrite: 0, cacheRead: 0, output: 0 };
  const index = await nameIndex(db);
  const result = await answerFromCanon(question, history, {
    model: (call) => callModel(usage, call),
    search: (input) => search(db, input),
    names: index,
    entries: (ids) => entries(db, ids),
    pregnancyNote: () => pregnancyNote(db),
    glossary: TCM_GLOSSARY,
    course: options.course === true,
    onStage,
  });
  return { answer: result.answer, usage };
}
