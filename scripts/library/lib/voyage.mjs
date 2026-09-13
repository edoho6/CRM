// Embeddings for the passages, from Voyage AI — the same model the app uses
// for the question (apps/web/features/library/voyage.ts), so both live in
// one space. Batched, retried when the service asks for a pause, and
// cached by the passage's own hash so a re-run pays only for new text. The
// call itself is the shared module the scheduled refresh uses too.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { readJson, sleep, writeJson } from '../../medicine/lib.mjs';

import { DIMENSIONS, VOYAGE_MODEL, embedBatch as embedBatchShared, VOYAGE_BATCH as BATCH } from '../../../supabase/functions/_shared/library/voyage.ts';

export { DIMENSIONS, VOYAGE_MODEL };

export const hashText = (text) => crypto.createHash('sha1').update(text).digest('hex');

const embedBatch = (key, texts, inputType) => embedBatchShared(key, texts, { inputType, sleep });

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
