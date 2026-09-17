// What the library actually returns for a question — the retrieval half of
// `/api/library/ask`, printed instead of answered.
//
// "There is no answer in the library" has two very different causes, and
// from the outside they look the same: retrieval handed the model nothing,
// or retrieval found the passage and the model or the checks dropped it.
// This prints every candidate with its score, then the gate the API applies
// (the similarity floor, the band below the best match, the passage budget),
// so the failing stage is visible rather than guessed at. It reads; it
// writes nothing and asks no model to answer.
//
// It signs in as a plain clinic member, the identity the app itself uses —
// `library_search` checks membership inside itself — and takes the password
// from apps/web/.env.test.local, never from the command line.
import path from 'node:path';
import { createRequire } from 'node:module';
import { env, log, root } from '../medicine/lib.mjs';
import { LIBRARY_LIMITS, checkGrounding, citationNumbers, distinctByContent, narrowedQuery, rrfMerge } from '../../packages/domain/src/library.ts';
import { ANSWER_SYSTEM, PLAN_SYSTEM, REVIEW_SYSTEM, answerPrompt, planPrompt, reviewPrompt } from '../../apps/web/features/library/prompts.ts';
import { DIMENSIONS, VOYAGE_MODEL } from '../../supabase/functions/_shared/library/voyage.ts';

const { createClient } = createRequire(path.join(root, 'apps', 'web', 'package.json'))('@supabase/supabase-js');

const args = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const found = args.find((a) => a.startsWith(`--${name}=`));
  return found ? found.slice(name.length + 3) : fallback;
};
const has = (name) => args.includes(`--${name}`);
const questions = args.filter((a) => !a.startsWith('--'));
const LIMIT = Number(flag('limit', '20'));
const SHOW = Number(flag('show', '12'));

if (questions.length === 0) {
  console.log(`Usage: node scripts/library/probe.mjs "שאלה" ["שאלה נוספת" …]

  --limit=20     rows each search asks the database for (the API asks 20)
  --show=12      candidates printed per search
  --no-plan      skip the planner: search the question as it was typed
  --words="…"    search words to use instead of the planner's
  --en="…"       the English twin to use instead of the planner's
  --text-or      also try the word search with the terms OR'd, to show what an
                 "all terms in one passage" query is missing
  --effort=low   the answer's and judge's effort (low | medium | high | xhigh | max)
  --judge=<model>  the model that judges the answer (default claude-sonnet-5)
  --judge-effort=  effort for the judge; leave unset for Haiku 4.5, which rejects it
  --answer       carry on past retrieval: write the answer and run the checks,
                 the same prompts and model the API uses, and print which stage
                 would have withheld it
`);
  process.exit(1);
}

const short = (text, n = 110) => String(text ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
/** Stage timings, because the route is cut off at sixty seconds. */
const timings = [];
async function timed(label, run) {
  const started = Date.now();
  const value = await run();
  timings.push([label, Date.now() - started]);
  return value;
}
const num = (value) => (typeof value === 'number' ? value.toFixed(3) : '     ');

/**
 * A model call, the same shape the API makes: plain fetch, no `temperature`
 * (the Claude 5 models refuse it), the key from the environment.
 */
async function callClaude({ system, content, maxTokens, model = 'claude-sonnet-5', effort }) {
  const key = env('ANTHROPIC_API_KEY');
  if (!key) throw new Error('ANTHROPIC_API_KEY is not set (apps/web/.env.local)');
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content }],
      // Sonnet 5 thinks adaptively at effort "high" when neither is given,
      // which is where the route's minute goes; `--effort` measures the rest.
      ...(effort ? { output_config: { effort } } : {}),
    }),
  });
  if (!response.ok) return { text: '', status: response.status };
  const payload = await response.json();
  return { text: (payload.content ?? []).map((part) => part.text ?? '').join(''), status: 200 };
}

const readJsonReply = (text) => {
  const match = String(text ?? '').match(/\{[\s\S]*\}/);
  try {
    return JSON.parse(match ? match[0] : text);
  } catch {
    return null;
  }
};

/** The planner, as the API runs it: the question alone, in English, and as search words. */
async function plan(question) {
  if (has('no-plan')) return { standalone: question, english: flag('en', ''), keywords: flag('words', '').split(/\s+/).filter(Boolean), kind: 'other', from: 'flags' };
  if (!env('ANTHROPIC_API_KEY')) return { standalone: question, english: '', keywords: [], kind: 'other', from: 'no key' };
  const spoken = await callClaude({ system: PLAN_SYSTEM, content: planPrompt(question, []), maxTokens: 400, model: 'claude-haiku-4-5-20251001' });
  if (spoken.status !== 200) {
    log(`plan: HTTP ${spoken.status} — searching the question as typed`);
    return { standalone: question, english: '', keywords: [], kind: 'other', from: `http ${spoken.status}` };
  }
  const parsed = readJsonReply(spoken.text);
  try {
    if (!parsed) throw new Error('unreadable');
    return {
      standalone: String(parsed.standalone || question),
      english: String(parsed.english || ''),
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords.map(String) : [],
      kind: String(parsed.kind || 'other'),
      from: 'planner',
    };
  } catch {
    return { standalone: question, english: '', keywords: [], kind: 'other', from: 'unreadable plan' };
  }
}

/** Question vectors, from Voyage, in the same space as the passages. */
async function embed(texts) {
  const key = env('VOYAGE_API_KEY');
  if (!key) throw new Error('VOYAGE_API_KEY is not set (apps/web/.env.local)');
  const response = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({ input: texts, model: VOYAGE_MODEL, input_type: 'query', output_dimension: DIMENSIONS }),
  });
  if (!response.ok) throw new Error(`voyage HTTP ${response.status}`);
  const payload = await response.json();
  return [...(payload.data ?? [])].sort((a, b) => (a.index ?? 0) - (b.index ?? 0)).map((row) => row.embedding);
}

async function connectAsMember() {
  const url = env('NEXT_PUBLIC_SUPABASE_URL');
  const anonKey = env('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  const email = env('SMOKE_EMAIL');
  const password = env('SMOKE_PASSWORD');
  if (!url || !anonKey) throw new Error('NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are not set (apps/web/.env.local)');
  if (!email || !password) throw new Error('SMOKE_EMAIL / SMOKE_PASSWORD are not set (apps/web/.env.test.local)');
  const supabase = createClient(url, anonKey, { auth: { persistSession: false } });
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`sign-in failed: ${error.message}`);
  return supabase;
}

/** How much library there is to search, so a thin one is not read as a bad search. */
async function librarySize(supabase) {
  const sources = await supabase.from('library_sources').select('id', { count: 'exact', head: true });
  const active = await supabase.from('library_sources').select('id', { count: 'exact', head: true }).eq('status', 'active');
  const chunks = await supabase.from('library_chunks').select('id', { count: 'estimated', head: true });
  return {
    sources: sources.count ?? null,
    active: active.count ?? null,
    chunks: chunks.count ?? null,
    error: sources.error?.message ?? chunks.error?.message ?? null,
  };
}

async function probe(supabase, question) {
  console.log(`\n${'='.repeat(78)}\n${question}\n${'='.repeat(78)}`);
  timings.length = 0;
  const p = await timed('plan', () => plan(question));
  const twin = p.english.trim() && p.english.trim() !== p.standalone.trim() ? p.english.trim() : null;
  const words = p.keywords.length ? p.keywords.join(' ') : (twin ?? question);
  console.log(`plan (${p.from}): kind=${p.kind}`);
  console.log(`  standalone: ${short(p.standalone, 140)}`);
  console.log(`  english:    ${twin ? short(twin, 140) : '— (same as the question)'}`);
  console.log(`  words:      ${words}`);

  const embeddings = await timed('embed', () => embed(twin ? [p.standalone, twin] : [p.standalone]));
  const searches = [];
  for (const [index, embedding] of embeddings.entries()) {
    const { data, error } = await timed(`search ${index + 1}`, () => supabase.rpc('library_search', { p_embedding: embedding, p_query: index === 0 ? words : '', p_limit: LIMIT, p_key: env('LIBRARY_SEARCH_KEY') }));
    if (error) throw new Error(`library_search: ${error.message}`);
    searches.push({ label: index === 0 ? `as asked + words "${words}"` : 'english twin', rows: data ?? [] });
  }

  // The same folding the API does, so the last line here is the number of
  // passages the model would have been handed.
  const byId = new Map();
  const vectorScore = new Map();
  const textHits = new Set();
  const rankings = [];
  for (const search of searches) {
    const byMeaning = [];
    const byWords = [];
    for (const row of search.rows) {
      byId.set(row.chunk_id, byId.get(row.chunk_id) ?? row);
      if (row.via === 'vector') {
        byMeaning.push(row.chunk_id);
        vectorScore.set(row.chunk_id, Math.max(vectorScore.get(row.chunk_id) ?? 0, row.score));
      } else {
        byWords.push(row.chunk_id);
        textHits.add(row.chunk_id);
      }
    }
    rankings.push(byMeaning);
    if (byWords.length) rankings.push(byWords);
    const vectors = search.rows.filter((r) => r.via === 'vector');
    const texts = search.rows.filter((r) => r.via === 'text');
    console.log(`\n— ${search.label}: ${vectors.length} by meaning, ${texts.length} by words`);
    for (const row of vectors.slice(0, SHOW)) {
      console.log(`   ${num(row.score)}  ${short(row.title, 46).padEnd(46)} ${row.page ? `p.${row.page}`.padEnd(7) : ''.padEnd(7)} ${short(row.heading ?? row.content, 70)}`);
    }
    if (texts.length === 0 && search.label.includes('words')) console.log('   (the word search returned nothing — every term must appear in one passage)');
    for (const row of texts.slice(0, SHOW)) {
      console.log(`   text   ${short(row.title, 46).padEnd(46)} ${row.page ? `p.${row.page}`.padEnd(7) : ''.padEnd(7)} ${short(row.heading ?? row.content, 70)}`);
    }
  }

  // The app's own relaxation, mirrored: when the words found nothing, the
  // first three terms are asked for again, all of them still required.
  const narrowed = textHits.size === 0 ? narrowedQuery(p.keywords) : null;
  if (narrowed) {
    const retry = await timed('narrowed', () => supabase.rpc('library_search', { p_embedding: embeddings[0], p_query: narrowed, p_limit: LIBRARY_LIMITS.narrowPassages, p_key: env('LIBRARY_SEARCH_KEY') }));
    if (retry.error) log(`narrowed search: ${retry.error.message}`);
    const byFewerWords = [];
    for (const row of (retry.data ?? []).filter((r) => r.via === 'text')) {
      byId.set(row.chunk_id, byId.get(row.chunk_id) ?? row);
      byFewerWords.push(row.chunk_id);
      textHits.add(row.chunk_id);
    }
    if (byFewerWords.length) rankings.push(byFewerWords);
    console.log(`
— the words narrowed to "${narrowed}": ${byFewerWords.length} by words`);
    for (const id of byFewerWords.slice(0, SHOW)) {
      const row = byId.get(id);
      console.log(`   text   ${short(row.title, 46).padEnd(46)} ${row.page ? `p.${row.page}`.padEnd(7) : ''.padEnd(7)} ${short(row.heading ?? row.content, 70)}`);
    }
  }

  // What an OR'd word search would have found, when asked for: the same
  // terms, any one of them enough. It shows what the AND query passed over.
  if (has('text-or') && p.keywords.length > 1) {
    const { data, error } = await supabase.rpc('library_search', { p_embedding: embeddings[0], p_query: p.keywords.join(' or '), p_limit: LIMIT, p_key: env('LIBRARY_SEARCH_KEY') });
    if (error) log(`text-or: ${error.message}`);
    else {
      const texts = (data ?? []).filter((r) => r.via === 'text');
      console.log(`\n— the same words, any one of them: ${texts.length} by words`);
      for (const row of texts.slice(0, SHOW)) console.log(`   text   ${short(row.title, 46).padEnd(46)} ${row.page ? `p.${row.page}`.padEnd(7) : ''.padEnd(7)} ${short(row.heading ?? row.content, 70)}`);
    }
  }

  const best = Math.max(0, ...vectorScore.values());
  const asksForList = p.kind === 'list';
  const band = asksForList ? LIBRARY_LIMITS.listSimilarityBand : LIBRARY_LIMITS.similarityBand;
  const budget = asksForList ? LIBRARY_LIMITS.listPassages : LIBRARY_LIMITS.passages;
  const merged = rrfMerge(rankings).map((entry) => byId.get(entry.id));
  const passed = merged.filter((row) => {
    const similarity = vectorScore.get(row.chunk_id);
    if (similarity === undefined) return textHits.has(row.chunk_id);
    return similarity >= LIBRARY_LIMITS.minSimilarity && similarity >= best - band;
  });
  const evidence = distinctByContent(passed).slice(0, budget);
  const floor = Math.max(LIBRARY_LIMITS.minSimilarity, best - band);
  console.log(`\nthe gate: best match ${num(best)}; a passage needs ${num(LIBRARY_LIMITS.minSimilarity)} and no more than ${band} below the best → ${num(floor)}`);
  console.log(`  ${merged.length} candidates → ${passed.length} passed the gate → ${evidence.length} handed to the model (budget ${budget})`);
  const lost = merged.filter((row) => !passed.includes(row) && vectorScore.has(row.chunk_id));
  if (lost.length) {
    console.log(`  dropped by the gate, closest first:`);
    for (const row of lost.slice(0, SHOW)) console.log(`   ${num(vectorScore.get(row.chunk_id))}  ${short(row.title, 46).padEnd(46)} ${short(row.heading ?? row.content, 70)}`);
  }
  if (evidence.length === 0) console.log('  → the API answers "there is nothing in the library on this", without asking the model to answer at all');
  if (!has('answer') || evidence.length === 0) return;

  // Past retrieval: the answer and the checks, so a question that had its
  // evidence and still came back as "nothing in the library" shows which
  // stage withheld it — the model declining, the markers, or the strikes.
  const passages = evidence.map((row, index) => ({
    n: index + 1,
    title: row.title,
    page: row.page,
    url: row.url,
    content: row.heading ? `${row.heading}\n${row.content}` : row.content,
  }));
  const spoken = await timed('answer', () => callClaude({ system: ANSWER_SYSTEM, content: answerPrompt(question, [], passages), maxTokens: 8000, effort: flag('effort', null) }));
  if (spoken.status !== 200) {
    console.log(`\nanswer: HTTP ${spoken.status}`);
    return;
  }
  const draft = readJsonReply(spoken.text);
  if (!draft) {
    console.log(`\nanswer: the reply could not be read as JSON (${spoken.text.length} characters) → the API falls back to general knowledge`);
    return;
  }
  const answer = typeof draft.answer === 'string' ? draft.answer.trim() : '';
  const general = typeof draft.general === 'string' ? draft.general.trim() : '';
  const markers = citationNumbers(answer);
  console.log(`\nanswer: answered=${draft.answered} · ${answer.length} characters · markers ${markers.length ? markers.join(',') : 'none'} · general ${general.length} characters`);
  if (draft.answered !== true || !answer) {
    console.log('  → the model declined: the API shows the general-knowledge box, or "nothing in the library" when that is empty too');
    if (general) console.log(`  general: ${short(general, 200)}`);
    return;
  }
  const grounding = checkGrounding(answer, passages.map((p) => ({ n: p.n, content: p.content, title: p.title, page: p.page })));
  console.log(`  grounding: ${grounding.ok ? 'clean' : grounding.problems.map((p) => `${p.kind} ${p.detail}`).join(', ')}`);
  if (markers.length === 0 || answer.length < 120) {
    console.log('  → below the floor (no markers, or under 120 characters): the API withholds the whole answer');
  }
  const verdict = await timed('judge', () => callClaude({ system: REVIEW_SYSTEM, content: reviewPrompt(answer, passages), maxTokens: 4000, model: flag('judge', 'claude-sonnet-5'), effort: flag('judge-effort', null) }));
  if (verdict.status !== 200) console.log(`  the judge: HTTP ${verdict.status} — the API treats an unreadable verdict as nothing named`);
  const read = readJsonReply(verdict.text);
  const issues = Array.isArray(read?.issues) ? read.issues.filter((i) => i && typeof i.quote === 'string' && i.quote.trim()) : [];
  console.log(`  the judge: faithful=${read?.faithful} · ${issues.length} sentence(s) named`);
  for (const issue of issues.slice(0, 6)) console.log(`     ✂ ${short(issue.quote, 90)}\n       (${short(issue.why, 80)})`);
  const total = timings.reduce((sum, [, ms]) => sum + ms, 0);
  console.log(`  time: ${timings.map(([label, ms]) => `${label} ${(ms / 1000).toFixed(1)}s`).join(' · ')} → ${(total / 1000).toFixed(1)}s of the route's 60s ceiling${total > 55000 ? ' — AT OR OVER IT' : ''}`);
  console.log(`\n  --- the answer as written ---\n${answer.split('\n').map((line) => `  ${line}`).join('\n')}`);
}

const supabase = await connectAsMember();
try {
  const size = await librarySize(supabase);
  if (size.error) log(`library size: ${size.error}`);
  console.log(`library: ${size.sources ?? '?'} sources (${size.active ?? '?'} active), about ${size.chunks ?? '?'} passages`);
  for (const question of questions) await probe(supabase, question);
} finally {
  // Local only: the default signs this account out everywhere, including a
  // crawl running in another terminal.
  await supabase.auth.signOut({ scope: 'local' });
}
