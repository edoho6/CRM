// Embeddings for passages, from Voyage AI — the same model the app uses
// for a question (apps/web/features/library/voyage.ts), so both live in
// one space. One batch per call, retried when the service asks for a
// pause. The loading scripts wrap this with a cache on disk; the scheduled
// refresh calls it as it is.

export const VOYAGE_MODEL = 'voyage-3-large';
export const DIMENSIONS = 1024;
const ENDPOINT = 'https://api.voyageai.com/v1/embeddings';
/** Voyage takes up to 128 texts a call; the token ceiling per call is far above what 64 passages hold. */
export const VOYAGE_BATCH = 64;

export interface EmbedBatchResult {
  vectors: number[][];
  tokens: number;
}

export interface EmbedOptions {
  inputType?: 'document' | 'query';
  fetchImpl?: (url: string, init: RequestInit) => Promise<Response>;
  sleep?: (ms: number) => Promise<void>;
}

export async function embedBatch(key: string, texts: readonly string[], options: EmbedOptions = {}): Promise<EmbedBatchResult> {
  const fetchImpl = options.fetchImpl ?? ((url, init) => fetch(url, init));
  const sleep = options.sleep ?? ((ms) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  for (let attempt = 1; ; attempt += 1) {
    const response = await fetchImpl(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({ input: texts, model: VOYAGE_MODEL, input_type: options.inputType ?? 'document', output_dimension: DIMENSIONS }),
    });
    if (response.ok) {
      const payload = (await response.json()) as { data?: { index: number; embedding: number[] }[]; usage?: { total_tokens?: number } };
      const vectors = (payload.data ?? []).sort((a, b) => a.index - b.index).map((d) => d.embedding);
      if (vectors.length !== texts.length) throw new Error('voyage returned the wrong number of vectors');
      return { vectors, tokens: payload.usage?.total_tokens ?? 0 };
    }
    if ((response.status === 429 || response.status >= 500) && attempt < 10) {
      // A free-tier key allows a few requests a minute; wait as told, or longer each time.
      const wait = Number(response.headers.get('retry-after')) || Math.min(120, attempt * 15);
      await sleep(wait * 1000);
      continue;
    }
    throw new Error(`voyage ${response.status}`);
  }
}

/** Vectors for many texts, in order, batch after batch. */
export async function embedAll(key: string, texts: readonly string[], options: EmbedOptions = {}): Promise<EmbedBatchResult> {
  const vectors: number[][] = [];
  let tokens = 0;
  for (let i = 0; i < texts.length; i += VOYAGE_BATCH) {
    const batch = await embedBatch(key, texts.slice(i, i + VOYAGE_BATCH), options);
    vectors.push(...batch.vectors);
    tokens += batch.tokens;
  }
  return { vectors, tokens };
}
