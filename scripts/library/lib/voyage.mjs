// Embeddings for the passages, from Voyage AI — the same model the app uses
// for the question (apps/web/features/library/voyage.ts), so both live in
// one space. Batched by count and by tokens, retried when the service asks
// for a pause, halved when it finds a batch too large (all of that in the
// shared module the scheduled refresh uses too), and cached by the
// passage's own hash so a re-run pays only for new text.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { readJson, sleep, writeJson } from '../../medicine/lib.mjs';
import { DIMENSIONS, VOYAGE_MODEL, embedAll } from '../../../supabase/functions/_shared/library/voyage.ts';

export { DIMENSIONS, VOYAGE_MODEL };

export const hashText = (text) => crypto.createHash('sha1').update(text).digest('hex');

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
  // A few hundred at a time, so a long book shows progress and a failure late in it costs little.
  const STEP = 256;
  for (let i = 0; i < missing.length; i += STEP) {
    const indexes = missing.slice(i, i + STEP);
    const { vectors, tokens: used } = await embedAll(key, indexes.map((index) => texts[index]), { inputType, sleep });
    tokens += used;
    indexes.forEach((index, j) => {
      out[index] = vectors[j];
      writeJson(path.join(cacheDir, `${hashText(texts[index])}.json`), { model: VOYAGE_MODEL, embedding: vectors[j] });
    });
    onProgress?.(Math.min(i + STEP, missing.length), missing.length);
  }
  return { embeddings: out, cached: texts.length - missing.length, tokens };
}
