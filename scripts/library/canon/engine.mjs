// The canon engine for trials, from the index on disk. The engine itself — every
// prompt, rule and check — is packages/domain/src/canon.ts, the same code the app
// runs; this file supplies what the app gets from the database: the entries and
// their names, the passages and their vectors (searched here in memory, by
// meaning and by words, then reranked), and the pregnancy note. It also counts
// the cost of every call, which the app does not need.
import fs from 'node:fs';
import path from 'node:path';
import { env, root } from '../../medicine/lib.mjs';
import { CANON_CACHE } from './books.mjs';
import { TCM_GLOSSARY } from '../../../packages/domain/src/tcm-glossary.ts';
import {
  CanonNameIndex,
  answerFromCanon,
  canonNameRows,
  entryTitle,
  foldPinyin,
  pregnancyPointsNote,
  withBaraDoses,
} from '../../../packages/domain/src/canon.ts';

const INDEX = path.join(CANON_CACHE, 'index');
const DIM = 1024;

export const MODELS = { answer: 'claude-sonnet-5', small: 'claude-haiku-4-5-20251001' };
/** Dollars per million tokens: input, output, cache write (1.25×), cache read (0.1×). */
const PRICE = {
  'claude-sonnet-5': { in: 2, out: 10, write: 2.5, read: 0.2 },
  'claude-haiku-4-5-20251001': { in: 1, out: 5, write: 1.25, read: 0.1 },
  'voyage-3-large': { in: 0.18 },
  'rerank-2.5': { in: 0.05 },
};

/** Bara's fact sheets (scripts/catalogue/facts.mjs), for the second dose note. */
export function baraSheets() {
  const file = path.join(root, '.cache', 'catalogue', 'facts', 'herbs.json');
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : [];
}

/** The entries as the database holds them: parsed entries plus Bara's dose, and every name they answer to. */
export function canonForLoading() {
  const parsed = JSON.parse(fs.readFileSync(path.join(INDEX, 'entries.json'), 'utf8')).map((e) => ({
    id: e.id,
    book: e.book,
    kind: e.kind,
    page: e.page ?? null,
    associatedWith: e.associatedWith ?? null,
    names: e.names,
    sections: e.sections,
  }));
  const rows = canonNameRows(parsed);
  const entries = withBaraDoses(parsed, rows, baraSheets());
  const passages = JSON.parse(fs.readFileSync(path.join(INDEX, 'passages.json'), 'utf8'));
  const buffer = fs.readFileSync(path.join(INDEX, 'vectors.f32'));
  const vectors = new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4);
  if (vectors.length !== passages.length * DIM) throw new Error('vectors and passages differ in count — rebuild the index');
  return { entries, rows, passages, vectors, pregnancyNote: pregnancyPointsNote(entries) };
}

let INDEX_CACHE = null;
export function loadIndex() {
  if (INDEX_CACHE) return INDEX_CACHE;
  const canon = canonForLoading();
  const byId = new Map(canon.entries.map((e) => [e.id, e]));
  const names = new CanonNameIndex(canon.rows);
  // Word index for the exact-term half of the search.
  const postings = new Map();
  const lengths = new Uint16Array(canon.passages.length);
  canon.passages.forEach((p, i) => {
    const counts = new Map();
    for (const t of tokens(`${p.heading} ${p.text}`)) counts.set(t, (counts.get(t) ?? 0) + 1);
    lengths[i] = Math.min(65535, [...counts.values()].reduce((a, b) => a + b, 0));
    for (const [t, c] of counts) {
      if (!postings.has(t)) postings.set(t, []);
      postings.get(t).push(i, c);
    }
  });
  const avgLength = lengths.reduce((a, b) => a + b, 0) / canon.passages.length;
  INDEX_CACHE = { ...canon, byId, names, postings, lengths, avgLength };
  return INDEX_CACHE;
}

const STOP = new Set('the and for with that this from are was were which what when how why into has have had not but its also can may use used their there than then them they these those such of in on to a an or is be by as at it'.split(' '));
function tokens(text) {
  return foldPinyin(text)
    .split(/[^a-z0-9-]+/)
    .filter((t) => t.length > 2 && !STOP.has(t));
}

async function claude(usage, { model, system, content, maxTokens, effort, label }) {
  const body = { model, max_tokens: maxTokens, system, messages: [{ role: 'user', content }] };
  if (effort) body.output_config = { effort };
  const started = Date.now();
  for (let attempt = 1; ; attempt += 1) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': env('ANTHROPIC_API_KEY'), 'anthropic-version': '2023-06-01' },
      body: JSON.stringify(body),
    });
    if ((response.status === 429 || response.status >= 500) && attempt < 5) {
      await new Promise((r) => setTimeout(r, attempt * 4000));
      continue;
    }
    if (!response.ok) throw new Error(`claude ${response.status}: ${(await response.text()).slice(0, 400)}`);
    const payload = await response.json();
    const u = payload.usage ?? {};
    const p = PRICE[model];
    const dollars = ((u.input_tokens ?? 0) * p.in + (u.output_tokens ?? 0) * p.out + (u.cache_creation_input_tokens ?? 0) * p.write + (u.cache_read_input_tokens ?? 0) * p.read) / 1e6;
    usage.calls.push({ label, model, input: u.input_tokens ?? 0, output: u.output_tokens ?? 0, cacheWrite: u.cache_creation_input_tokens ?? 0, cacheRead: u.cache_read_input_tokens ?? 0, dollars, ms: Date.now() - started, stop: payload.stop_reason });
    usage.dollars += dollars;
    const text = (payload.content ?? []).filter((b) => b.type === 'text').map((b) => b.text).join('\n');
    if (!text.trim() && attempt < 2) continue;
    return text;
  }
}

async function voyage(usage, endpoint, body, label) {
  const started = Date.now();
  for (let attempt = 1; ; attempt += 1) {
    const response = await fetch(`https://api.voyageai.com/v1/${endpoint}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${env('VOYAGE_API_KEY')}` },
      body: JSON.stringify(body),
    });
    if ((response.status === 429 || response.status >= 500) && attempt < 5) {
      await new Promise((r) => setTimeout(r, attempt * 3000));
      continue;
    }
    if (!response.ok) throw new Error(`voyage ${endpoint} ${response.status}: ${(await response.text()).slice(0, 300)}`);
    const payload = await response.json();
    const tokensUsed = payload.usage?.total_tokens ?? 0;
    const dollars = (tokensUsed * PRICE[body.model].in) / 1e6;
    usage.calls.push({ label, model: body.model, input: tokensUsed, output: 0, dollars, ms: Date.now() - started });
    usage.dollars += dollars;
    return payload;
  }
}

let COURSE_INDEX = null;
/** The Hebrew course layer (course-build.mjs), when it has been built. */
export function loadCourse() {
  if (COURSE_INDEX) return COURSE_INDEX;
  const dir = path.join(CANON_CACHE, 'course', 'index');
  if (!fs.existsSync(path.join(dir, 'vectors.f32'))) throw new Error('the course layer is not built — run course-build.mjs');
  const passages = JSON.parse(fs.readFileSync(path.join(dir, 'passages.json'), 'utf8'));
  const buffer = fs.readFileSync(path.join(dir, 'vectors.f32'));
  const vectors = new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4);
  if (vectors.length !== passages.length * DIM) throw new Error('course vectors and passages differ in count — rebuild');
  COURSE_INDEX = { passages, vectors };
  return COURSE_INDEX;
}

/** Passages by meaning (every query's vector) and by words (BM25), fused, then reranked. The course layer is searched by meaning alone, as the database does. */
async function searchPassages(usage, { queries, rerankQuery, exclude, want, course = false }) {
  const { passages, vectors, postings, lengths, avgLength } = course ? { ...loadCourse(), postings: new Map(), lengths: [], avgLength: 1 } : loadIndex();
  const excludedKey = (i) => (course ? `#course:${i}` : (passages[i].entry ?? `#${i}`));
  const embedded = await voyage(usage, 'embeddings', { input: queries, model: 'voyage-3-large', input_type: 'query', output_dimension: DIM }, 'embed query');
  const lists = [];
  for (const row of embedded.data ?? []) {
    const q = Float32Array.from(row.embedding);
    const norm = Math.hypot(...q) || 1;
    const scores = new Float32Array(passages.length);
    for (let i = 0; i < passages.length; i += 1) {
      let s = 0;
      const o = i * DIM;
      for (let d = 0; d < DIM; d += 1) s += vectors[o + d] * q[d];
      scores[i] = s / norm;
    }
    lists.push([...scores.keys()].sort((a, b) => scores[b] - scores[a]).slice(0, 40));
  }
  const bm = new Map();
  for (const t of new Set(queries.flatMap(tokens))) {
    const list = postings.get(t);
    if (!list || list.length / 2 > passages.length * 0.2) continue;
    const idf = Math.log(1 + (passages.length - list.length / 2 + 0.5) / (list.length / 2 + 0.5));
    for (let k = 0; k < list.length; k += 2) {
      const i = list[k];
      const tf = list[k + 1];
      bm.set(i, (bm.get(i) ?? 0) + (idf * tf * 2.2) / (tf + 1.2 * (0.25 + 0.75 * (lengths[i] / avgLength))));
    }
  }
  lists.push([...bm.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40).map(([i]) => i));
  const fused = new Map();
  for (const list of lists) list.forEach((i, rank) => fused.set(i, (fused.get(i) ?? 0) + 1 / (60 + rank)));
  const candidates = [...fused.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([i]) => i)
    .filter((i) => !exclude.has(excludedKey(i)))
    .slice(0, 60);
  if (!candidates.length) return [];
  const reranked = await voyage(
    usage,
    'rerank',
    { query: rerankQuery, documents: candidates.map((i) => `${passages[i].heading}\n${passages[i].text}`.slice(0, 4000)), model: 'rerank-2.5', top_k: Math.min(want * 2, candidates.length) },
    'rerank',
  );
  return (reranked.data ?? []).map((d) => {
    const i = candidates[d.index];
    const p = passages[i];
    return { id: String(i), entry: p.entry ?? null, section: p.section ?? null, heading: p.heading, text: p.text };
  });
}

export function findEntry(kind, name) {
  const index = loadIndex();
  const id = index.names.find(kind, name);
  return id ? index.byId.get(id) : null;
}
export { entryTitle };

export async function ask(question, history = [], { course = false } = {}) {
  const index = loadIndex();
  const usage = { calls: [], dollars: 0 };
  const started = Date.now();
  const result = await answerFromCanon(question, history, {
    model: ({ model, ...call }) => claude(usage, { ...call, model: MODELS[model] }),
    search: (input) => searchPassages(usage, input),
    names: index.names,
    entries: async (ids) => ids.map((id) => index.byId.get(id)).filter(Boolean),
    pregnancyNote: async () => index.pregnancyNote,
    glossary: TCM_GLOSSARY,
    course,
  });
  return {
    question,
    plan: result.plan,
    complex: result.complex,
    answer: result.answer,
    checks: { safety: result.safety, dosesRemoved: result.checks.dosesRemoved, pregnancyPointsRemoved: result.checks.pregnancyPointsRemoved, bookNamesRemoved: result.checks.removed, safetyFixes: result.checks.safetyFixes, namesFixed: result.checks.namesFixed },
    evidence: result.evidence,
    seconds: Math.round((Date.now() - started) / 100) / 10,
    usage,
  };
}
