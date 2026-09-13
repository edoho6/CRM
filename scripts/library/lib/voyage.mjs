// Embeddings for the passages, from Voyage AI — the same model the app uses
// for the question (apps/web/features/library/voyage.ts), so both live in
// one space. Batched, retried when the service asks for a pause, and
// cached by the passage's own hash so a re-run pays only for new text.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { readJson, sleep, writeJson } from '../../medicine/lib.mjs';

export const VOYAGE_MODEL = 'voyage-3-large';
export const DIMENSIONS = 1024;
const ENDPOINT = 'https://api.voyageai.com/v1/embeddings';
/** Voyage takes up to 128 texts a call; the token ceiling per call is far above what 128 passages hold. */
const BATCH = 64;

export const hashText = (text) => crypto.createHash('sha1').update(text).digest('hex');

async function embedBatch(key, texts, inputType) {
  for (let attempt = 1; ; attempt += 1) {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({ input: texts, model: VOYAGE_MODEL, input_type: inputType, output_dimension: DIMENSIONS }),
    });
    if (response.ok) {
      const payload = await response.json();
      const vectors = (payload.data ?? []).sort((a, b) => a.index - b.index).map((d) => d.embedding);
      if (vectors.length !== texts.length) throw new Error('voyage returned the wrong number of vectors');
      return { vectors, tokens: payload.usage?.total_tokens ?? 0 };
    }
    if ((response.status === 429 || response.status >= 500) && attempt < 6) {
      const wait = Number(response.headers.get('retry-after')) || attempt * 10;
      await sleep(wait * 1000);
      continue;
    }
    throw new Error(`voyage ${response.status}`);
  }
}

/**
 * Vectors for many texts, in order. `cacheDir` holds one small file per
 * text hash; a text seen before costs nothing.
 * @param {string} key
 * @param {readonly string[]} texts
 * @param {{cacheDir: string, inputType?: 'document' | 'query', onProgress?: (done: number, total: number) => void}} options
 */
export async function embedTexts(key, texts, { cacheDir, inputType = 'document', onProgress } = {}) {
  fs.mkdirSync(cacheDir, { recursive: true });
  const out = new Array(texts.length);
  const missing = [];
  texts.forEach((text, index) => {
    const cached = readJson(path.join(cacheDir, `${hashText(text)}.json`));
    if (cached && cached.model === VOYAGE_MODEL && Array.isArray(cached.embedding) && cached.embedding.length === DIMENSIONS) out[index] = cached.embedding;
    else missing.push(index);
  });
  let tokens = 0;
  for (let i = 0; i < missing.length; i += BATCH) {
    const indexes = missing.slice(i, i + BATCH);
    const { vectors, tokens: used } = await embedBatch(key, indexes.map((index) => texts[index]), inputType);
    tokens += used;
    indexes.forEach((index, j) => {
      out[index] = vectors[j];
      writeJson(path.join(cacheDir, `${hashText(texts[index])}.json`), { model: VOYAGE_MODEL, embedding: vectors[j] });
    });
    onProgress?.(Math.min(i + BATCH, missing.length), missing.length);
    await sleep(200);
  }
  return { embeddings: out, cached: texts.length - missing.length, tokens };
}
