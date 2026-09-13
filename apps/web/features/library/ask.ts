import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  LIBRARY_DISCLAIMER_HE,
  LIBRARY_LIMITS,
  LIBRARY_NO_SOURCES_HE,
  LIBRARY_REFUSED_PII_HE,
  LIBRARY_REFUSED_QUOTA_HE,
  checkGrounding,
  findPii,
  rrfMerge,
  type LibraryAnswer,
  type LibraryCitation,
  type LibraryStatus,
} from '@clinic/domain';
import { LIBRARY_MODEL, LibraryUnavailableError, callClaude, parseJsonReply } from './claude';
import { ANSWER_SYSTEM, REVIEW_SYSTEM, answerPrompt, reviewPrompt, type PromptPassage } from './prompts';
import { embedQuery } from './voyage';

/**
 * One question, answered from the library and nothing else.
 *
 * The order is the point: the daily quota and the identifier check come
 * before any provider is called, so a question with a patient's number in
 * it never leaves the server; retrieval comes before the model, so the
 * model only ever sees passages the library holds; and the grounding
 * checks come after the model, so an answer that cites nothing, cites a
 * passage that was not retrieved, states a number the passages do not, or
 * fails the second reading is replaced by "the sources do not answer
 * this". The log gets the outcome and the sources — never the words.
 */

export interface AskTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface AskInput {
  question: string;
  history: AskTurn[];
}

export interface RetrievedSource {
  sourceId: string;
  title: string;
  url: string | null;
  page: number | null;
}

export interface AskResult extends LibraryAnswer {
  /** Everything retrieved, cited or not, so a "not found" still points at what came closest. */
  retrieved: RetrievedSource[];
}

interface SearchRow {
  via: 'vector' | 'text';
  chunk_id: string;
  source_id: string;
  title: string;
  url: string | null;
  kind: string;
  page: number | null;
  heading: string | null;
  content: string;
  score: number;
}

interface LogSource {
  source_id: string;
  title: string;
  url: string | null;
  page: number | null;
  cited: boolean;
}

const reply = (status: LibraryStatus, answer: string, citations: LibraryCitation[] = [], retrieved: RetrievedSource[] = []): AskResult => ({
  status,
  answer,
  citations,
  disclaimer: LIBRARY_DISCLAIMER_HE,
  retrieved,
});

export async function askLibrary(db: SupabaseClient, input: AskInput): Promise<AskResult> {
  const started = Date.now();
  const question = input.question.trim();
  const history = input.history.slice(-LIBRARY_LIMITS.historyTurns * 2);

  const log = async (status: LibraryStatus, sources: LogSource[], usage?: { input: number; output: number }) => {
    try {
      await db.rpc('library_log_query', {
        p_status: status,
        p_sources: sources,
        p_model: usage ? LIBRARY_MODEL : null,
        p_input_tokens: usage?.input ?? null,
        p_output_tokens: usage?.output ?? null,
        p_latency_ms: Date.now() - started,
      });
    } catch {
      // The log must never take the answer down with it.
    }
  };

  // The quota, before anything costs.
  const { data: used } = await db.rpc('library_questions_today');
  if (Number(used ?? 0) >= LIBRARY_LIMITS.dailyQuota) {
    await log('refused_quota', []);
    return reply('refused_quota', LIBRARY_REFUSED_QUOTA_HE);
  }

  // A patient's identifier, in the question or in an earlier turn, stops here.
  if (findPii(question).length > 0 || history.some((turn) => findPii(turn.content).length > 0)) {
    await log('refused_pii', []);
    return reply('refused_pii', LIBRARY_REFUSED_PII_HE);
  }

  // Retrieval: by meaning and by words, folded together.
  const embedding = await embedQuery(question);
  const { data, error } = await db.rpc('library_search', { p_embedding: embedding, p_query: question, p_limit: 20 });
  if (error) throw new LibraryUnavailableError('search_failed');
  const rows = (data ?? []) as SearchRow[];
  const byId = new Map<string, SearchRow>();
  const vectorScore = new Map<string, number>();
  const vectorList: string[] = [];
  const textList: string[] = [];
  for (const row of rows) {
    byId.set(row.chunk_id, byId.get(row.chunk_id) ?? row);
    if (row.via === 'vector') {
      vectorList.push(row.chunk_id);
      vectorScore.set(row.chunk_id, row.score);
    } else {
      textList.push(row.chunk_id);
    }
  }
  const best = Math.max(0, ...vectorScore.values());
  // A passage is evidence when it is close in meaning, or when the words
  // themselves matched; anything else is noise that would only tempt the model.
  const evidence = rrfMerge([vectorList, textList])
    .map((entry) => byId.get(entry.id)!)
    .filter((row) => {
      const similarity = vectorScore.get(row.chunk_id);
      if (similarity === undefined) return textList.includes(row.chunk_id);
      return similarity >= LIBRARY_LIMITS.minSimilarity && similarity >= best - LIBRARY_LIMITS.similarityBand;
    })
    .slice(0, LIBRARY_LIMITS.passages);

  const retrieved: RetrievedSource[] = evidence.map((row) => ({ sourceId: row.source_id, title: row.title, url: row.url, page: row.page }));
  const logSources = (cited: Set<number>): LogSource[] =>
    evidence.map((row, index) => ({ source_id: row.source_id, title: row.title, url: row.url, page: row.page, cited: cited.has(index + 1) }));

  if (evidence.length === 0) {
    await log('no_sources', []);
    return reply('no_sources', LIBRARY_NO_SOURCES_HE);
  }

  const passages: PromptPassage[] = evidence.map((row, index) => ({
    n: index + 1,
    title: row.title,
    page: row.page,
    url: row.url,
    content: row.heading ? `${row.heading}\n${row.content}` : row.content,
  }));
  const asCitation = (n: number): LibraryCitation => {
    const row = evidence[n - 1]!;
    return {
      n,
      sourceId: row.source_id,
      title: row.title,
      url: row.url,
      page: row.page,
      quote: row.content.length > LIBRARY_LIMITS.quoteChars ? `${row.content.slice(0, LIBRARY_LIMITS.quoteChars).trimEnd()}…` : row.content,
    };
  };
  const allCitations = passages.map((p) => asCitation(p.n));

  // The answer.
  const first = await callClaude({
    system: ANSWER_SYSTEM,
    messages: [{ role: 'user', content: answerPrompt(question, history, passages) }],
    maxTokens: 1500,
  });
  const usage = { input: first.inputTokens, output: first.outputTokens };
  const parsed = parseJsonReply<{ answered?: boolean; answer?: string }>(first.text);
  if (!parsed || typeof parsed.answer !== 'string' || parsed.answered !== true) {
    await log('no_sources', logSources(new Set()), usage);
    return reply('no_sources', LIBRARY_NO_SOURCES_HE, allCitations, retrieved);
  }

  // Grounding: the checks that cannot be argued with, then the second reading.
  const grounding = checkGrounding(parsed.answer, passages.map((p) => ({ n: p.n, content: p.content })));
  let faithful = grounding.ok;
  if (faithful) {
    const second = await callClaude({
      system: REVIEW_SYSTEM,
      messages: [{ role: 'user', content: reviewPrompt(parsed.answer, passages) }],
      maxTokens: 400,
    });
    usage.input += second.inputTokens;
    usage.output += second.outputTokens;
    const verdict = parseJsonReply<{ faithful?: boolean }>(second.text);
    faithful = verdict?.faithful === true;
  }
  if (!faithful) {
    await log('no_sources', logSources(new Set()), usage);
    return reply('no_sources', LIBRARY_NO_SOURCES_HE, allCitations, retrieved);
  }

  const cited = new Set(grounding.ok ? citedNumbers(parsed.answer) : []);
  await log('answered', logSources(cited), usage);
  return reply(
    'answered',
    parsed.answer.trim(),
    [...cited].sort((a, b) => a - b).map(asCitation),
    retrieved,
  );
}

function citedNumbers(answer: string): number[] {
  const found = new Set<number>();
  for (const group of answer.matchAll(/\[([\d\s,]+)\]/g)) {
    for (const part of group[1].split(',')) {
      const n = Number(part.trim());
      if (Number.isInteger(n) && n > 0) found.add(n);
    }
  }
  return [...found];
}
