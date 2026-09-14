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

export function isLibraryConfigured(): boolean {
  return Boolean(process.env.VOYAGE_API_KEY?.trim()) && Boolean(process.env.ANTHROPIC_API_KEY?.trim());
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

export async function embedQuery(text: string, signal?: AbortSignal): Promise<number[]> {
  const [embedding] = await embedQueries([text], signal);
  return embedding!;
}
