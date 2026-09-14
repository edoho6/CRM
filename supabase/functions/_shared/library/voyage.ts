// Embeddings for passages, from Voyage AI — the same model the app uses
// for a question (apps/web/features/library/voyage.ts), so both live in
// one space. Batches are bounded by an estimate of their tokens as well as
// by count, because Voyage takes at most 120,000 tokens in one request and
// a dense text runs far more tokens per character than English prose; a
// batch it still refuses as too large is halved and sent again. A request
// refused for rate is retried after the pause Voyage asks for. The loading
// scripts wrap this with a cache on disk; the scheduled refresh calls it as
// it is.

export const VOYAGE_MODEL = 'voyage-3-large';
export const DIMENSIONS = 1024;
const ENDPOINT = 'https://api.voyageai.com/v1/embeddings';
/** Voyage takes up to 128 texts a call. */
export const VOYAGE_BATCH = 64;
/** Voyage takes at most 120,000 tokens a call; the estimate below is rough, so the aim is lower. */
export const VOYAGE_BATCH_TOKENS = 80_000;

export interface EmbedBatchResult {
  vectors: number[][];
  tokens: number;
}

export interface EmbedOptions {
  inputType?: 'document' | 'query';
  fetchImpl?: (url: string, init: RequestInit) => Promise<Response>;
  sleep?: (ms: number) => Promise<void>;
}

/** A generous guess: two and a half characters to a token, so a dense text still fits. */
export function estimateVoyageTokens(text: string): number {
  return Math.ceil(text.length / 2.5);
}

/** Texts in batches that keep under both limits, in order. */
export function batchTexts(texts: readonly string[], maxTexts = VOYAGE_BATCH, maxTokens = VOYAGE_BATCH_TOKENS): string[][] {
  const batches: string[][] = [];
  let current: string[] = [];
  let tokens = 0;
  for (const text of texts) {
    const cost = estimateVoyageTokens(text);
    if (current.length > 0 && (current.length >= maxTexts || tokens + cost > maxTokens)) {
      batches.push(current);
      current = [];
      tokens = 0;
    }
    current.push(text);
    tokens += cost;
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

const TOO_LARGE = /max allowed tokens|too many tokens|token.*batch|batch.*token/i;

export async function embedBatch(key: string, texts: readonly string[], options: EmbedOptions = {}): Promise<EmbedBatchResult> {
  const fetchImpl = options.fetchImpl ?? ((url, init) => fetch(url, init));
  const sleep = options.sleep ?? ((ms) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  for (let attempt = 1; ; attempt += 1) {
    let response: Response;
    try {
      response = await fetchImpl(ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
        body: JSON.stringify({ input: texts, model: VOYAGE_MODEL, input_type: options.inputType ?? 'document', output_dimension: DIMENSIONS }),
      });
    } catch (error) {
      // The network dropped: the same patience as for a pause the service asks for.
      if (attempt >= 10) throw new Error(`voyage network: ${error instanceof Error ? error.message : String(error)}`);
      await sleep(Math.min(120, attempt * 15) * 1000);
      continue;
    }
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
    // Voyage says what it refused (a batch too large, a bad input): the reason travels with the error.
    const detail = await response.text().catch(() => '');
    throw new Error(`voyage ${response.status}${detail ? `: ${detail.replace(/\s+/g, ' ').slice(0, 200)}` : ''}`);
  }
}

/** One batch, halved and halved again if Voyage finds it too large. */
async function embedBatchOrHalve(key: string, texts: readonly string[], options: EmbedOptions): Promise<EmbedBatchResult> {
  try {
    return await embedBatch(key, texts, options);
  } catch (error) {
    if (texts.length < 2 || !(error instanceof Error) || !TOO_LARGE.test(error.message)) throw error;
    const middle = Math.ceil(texts.length / 2);
    const first = await embedBatchOrHalve(key, texts.slice(0, middle), options);
    const second = await embedBatchOrHalve(key, texts.slice(middle), options);
    return { vectors: [...first.vectors, ...second.vectors], tokens: first.tokens + second.tokens };
  }
}

/** Vectors for many texts, in order, batch after batch. */
export async function embedAll(key: string, texts: readonly string[], options: EmbedOptions = {}): Promise<EmbedBatchResult> {
  const vectors: number[][] = [];
  let tokens = 0;
  for (const batch of batchTexts(texts)) {
    const result = await embedBatchOrHalve(key, batch, options);
    vectors.push(...result.vectors);
    tokens += result.tokens;
  }
  return { vectors, tokens };
}
