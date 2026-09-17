import 'server-only';

import { LibraryUnavailableError } from './claude';

/**
 * The question's embedding, from Voyage AI — the same model the ingestion
 * script used for the passages (scripts/library/lib/voyage.mjs), so the two
 * live in one space. Hebrew questions meet English passages there.
 */

const ENDPOINT = 'https://api.voyageai.com/v1/embeddings';
export const VOYAGE_MODEL = 'voyage-3-large';
export const EMBEDDING_DIMENSIONS = 1024;

/**
 * The library answers only when all three keys are set: the two services, and
 * the key that opens the passage search in the database (migration 71). Without
 * that one the search returns nothing, and every question would come back "not
 * found" — so the screen says the library is not set up instead.
 */
export function isLibraryConfigured(): boolean {
  return Boolean(process.env.VOYAGE_API_KEY?.trim()) && Boolean(process.env.ANTHROPIC_API_KEY?.trim()) && Boolean(libraryKey());
}

/** The server's key to `library_search`; it never reaches the browser. */
export function libraryKey(): string | null {
  return process.env.LIBRARY_SEARCH_KEY?.trim() || null;
}

/** Several questions in one call — the question as asked and its English twin — in the order given. */
export async function embedQueries(texts: readonly string[], signal?: AbortSignal): Promise<number[][]> {
  const key = process.env.VOYAGE_API_KEY?.trim();
  if (!key) throw new LibraryUnavailableError('not_configured');
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({ input: texts, model: VOYAGE_MODEL, input_type: 'query', output_dimension: EMBEDDING_DIMENSIONS }),
    signal,
  });
  if (!response.ok) throw new LibraryUnavailableError(`voyage_http_${response.status}`);
  const payload = (await response.json()) as { data?: { embedding?: number[]; index?: number }[] };
  const rows = [...(payload.data ?? [])].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  const embeddings = rows.map((row) => row.embedding);
  if (embeddings.length !== texts.length || embeddings.some((e) => !e || e.length !== EMBEDDING_DIMENSIONS)) throw new LibraryUnavailableError('voyage_bad_reply');
  return embeddings as number[][];
}

/**
 * The documents in order of how well each answers the query, as indexes into
 * the list — Voyage's reranker reads every document against the query, which
 * the vector search alone cannot. Same service and key as the embeddings.
 */
export async function rerankDocuments(query: string, documents: readonly string[], topK: number, signal?: AbortSignal): Promise<number[]> {
  const key = process.env.VOYAGE_API_KEY?.trim();
  if (!key) throw new LibraryUnavailableError('not_configured');
  const response = await fetch('https://api.voyageai.com/v1/rerank', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({ query, documents, model: 'rerank-2.5', top_k: topK }),
    signal,
  });
  if (!response.ok) throw new LibraryUnavailableError(`voyage_rerank_http_${response.status}`);
  const payload = (await response.json()) as { data?: { index?: number }[] };
  return (payload.data ?? []).map((row) => row.index).filter((i): i is number => typeof i === 'number' && i >= 0 && i < documents.length);
}

export async function embedQuery(text: string, signal?: AbortSignal): Promise<number[]> {
  const [embedding] = await embedQueries([text], signal);
  return embedding!;
}
