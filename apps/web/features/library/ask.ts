import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  LIBRARY_DISCLAIMER_HE,
  LIBRARY_LIMITS,
  LIBRARY_NO_SOURCES_HE,
  LIBRARY_REFUSED_PII_HE,
  LIBRARY_REFUSED_QUOTA_HE,
  checkGrounding,
  citationNumbers,
  distinctByContent,
  dropCitations,
  findPii,
  narrowedQuery,
  removeSentences,
  removeSentencesWithNumbers,
  rrfMerge,
  type GroundingPassage,
  type LibraryAnswer,
  type LibraryCitation,
  type LibraryStage,
  type LibraryStatus,
} from '@clinic/domain';
import { LIBRARY_EFFORT, LIBRARY_MODEL, LibraryUnavailableError, callClaude, parseJsonReply } from './claude';
import { planSearch } from './plan';
import { ANSWER_SYSTEM, GENERAL_SYSTEM, REVIEW_SYSTEM, answerPrompt, generalPrompt, repairPrompt, reviewPrompt, type PromptPassage } from './prompts';
import { embedQueries } from './voyage';

/**
 * One question, answered from the library — and, where the library has
 * nothing, from the model's own knowledge under a label that says so.
 *
 * The order is the point: the daily quota and the identifier check come
 * before any provider is called, so a question with a patient's number in
 * it never leaves the server; a small planner turns the question into
 * searches (its own language, English, the words a textbook would use);
 * retrieval comes before the model, so the "answer" part only ever sees
 * passages the library holds; and the checks come after the model — every
 * citation must name a retrieved passage, every number must be in the
 * cited passages, and a second reading names the sentences the passages do
 * not support. What fails is written once more and then struck sentence by
 * sentence; what stands is shown. The "general" part is never checked and
 * is always shown as not from the library. The log gets the outcome and
 * the sources — never the words.
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

interface Issue {
  quote: string;
  why: string;
}

const reply = (status: LibraryStatus, answer: string, citations: LibraryCitation[] = [], retrieved: RetrievedSource[] = []): AskResult => ({
  status,
  answer,
  citations,
  disclaimer: LIBRARY_DISCLAIMER_HE,
  retrieved,
});

/** Told where the answer is, as it gets there — for a page that streams the wait, never the text. */
export type StageListener = (stage: LibraryStage, detail?: { passages?: number }) => void;

/** The answer's shape, as the model is asked for it. */
interface ModelAnswer {
  answered?: boolean;
  answer?: string;
  general?: string;
}

const MIN_ANSWER_CHARS = 120;

/**
 * The route is cut off at sixty seconds, and a rewrite is the one step that
 * can be left out without loosening anything: what the checks named is then
 * struck instead of written again, which is the stricter outcome, not the
 * looser one. A measured rewrite of a fourteen-passage answer takes about
 * forty seconds, so it is only started while most of the minute is left.
 */
const ROUTE_BUDGET_MS = 52_000;
const REWRITE_MS = 25_000;

export async function askLibrary(db: SupabaseClient, input: AskInput, onStage?: StageListener): Promise<AskResult> {
  const started = Date.now();
  const question = input.question.trim();
  const history = input.history.slice(-LIBRARY_LIMITS.historyTurns * 2);
  const usage = { input: 0, output: 0 };
  const timeForRewrite = () => Date.now() - started + REWRITE_MS < ROUTE_BUDGET_MS;

  const log = async (status: LibraryStatus, sources: LogSource[], spent?: boolean) => {
    try {
      await db.rpc('library_log_query', {
        p_status: status,
        p_sources: sources,
        p_model: spent ? LIBRARY_MODEL : null,
        p_input_tokens: spent ? usage.input : null,
        p_output_tokens: spent ? usage.output : null,
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

  // The question, prepared: on its own, in English, and as search words.
  onStage?.('searching');
  const planned = await planSearch(question, history);
  const plan = planned.plan;
  usage.input += planned.inputTokens;
  usage.output += planned.outputTokens;

  // Retrieval: the question as asked and its English twin, each by meaning;
  // the English search words once, by words. Up to three rankings, folded.
  const twin = plan.english.trim() && plan.english.trim() !== plan.standalone.trim() ? plan.english.trim() : null;
  const embeddings = await embedQueries(twin ? [plan.standalone, twin] : [plan.standalone]);
  const words = plan.keywords.length ? plan.keywords.join(' ') : twin ?? question;
  const searches = await Promise.all(
    embeddings.map((embedding, index) => db.rpc('library_search', { p_embedding: embedding, p_query: index === 0 ? words : '', p_limit: 20 })),
  );
  if (searches.some((search) => search.error)) throw new LibraryUnavailableError('search_failed');
  const byId = new Map<string, SearchRow>();
  const vectorScore = new Map<string, number>();
  const textHits = new Set<string>();
  const rankings: string[][] = [];
  for (const search of searches) {
    const byMeaning: string[] = [];
    const byWords: string[] = [];
    for (const row of (search.data ?? []) as SearchRow[]) {
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
  }

  // The word half found nothing, which is the usual outcome: it asks for
  // every term in one passage. One more search with the first three terms,
  // all of them still required (`narrowedQuery` carries the why, and why
  // not OR). Only its word rows are taken — its vector rows are the ones
  // already collected, and counting them twice would weight the meaning
  // ranking twice in the fold below.
  const narrowed = textHits.size === 0 ? narrowedQuery(plan.keywords) : null;
  if (narrowed) {
    const retry = await db.rpc('library_search', { p_embedding: embeddings[0], p_query: narrowed, p_limit: LIBRARY_LIMITS.narrowPassages });
    const byFewerWords: string[] = [];
    for (const row of (retry.data ?? []) as SearchRow[]) {
      if (row.via !== 'text') continue;
      byId.set(row.chunk_id, byId.get(row.chunk_id) ?? row);
      byFewerWords.push(row.chunk_id);
      textHits.add(row.chunk_id);
    }
    if (byFewerWords.length) rankings.push(byFewerWords);
  }

  const best = Math.max(0, ...vectorScore.values());
  // A list question ("which herbs…") spreads its items across many sources:
  // it takes more passages and keeps ones further below the best match.
  const asksForList = plan.kind === 'list';
  const band = asksForList ? LIBRARY_LIMITS.listSimilarityBand : LIBRARY_LIMITS.similarityBand;
  const budget = asksForList ? LIBRARY_LIMITS.listPassages : LIBRARY_LIMITS.passages;
  // A passage is evidence when it is close in meaning, or when the words
  // themselves matched; anything else is noise that would only tempt the model.
  // A passage held twice (a book in two folders) counts once.
  const evidence = distinctByContent(
    rrfMerge(rankings)
      .map((entry) => byId.get(entry.id)!)
      .filter((row) => {
        const similarity = vectorScore.get(row.chunk_id);
        if (similarity === undefined) return textHits.has(row.chunk_id);
        return similarity >= LIBRARY_LIMITS.minSimilarity && similarity >= best - band;
      }),
  ).slice(0, budget);

  const retrieved: RetrievedSource[] = evidence.map((row) => ({ sourceId: row.source_id, title: row.title, url: row.url, page: row.page }));
  const logSources = (cited: Set<number>): LogSource[] =>
    evidence.map((row, index) => ({ source_id: row.source_id, title: row.title, url: row.url, page: row.page, cited: cited.has(index + 1) }));

  /** The model's own knowledge, asked for on its own when the library holds nothing. */
  const generalOnly = async (): Promise<string> => {
    onStage?.('writing');
    const spoken = await callClaude({ system: GENERAL_SYSTEM, messages: [{ role: 'user', content: generalPrompt(question, history) }], maxTokens: 6000, effort: LIBRARY_EFFORT });
    usage.input += spoken.inputTokens;
    usage.output += spoken.outputTokens;
    const parsed = parseJsonReply<{ general?: string }>(spoken.text);
    return typeof parsed?.general === 'string' ? parsed.general.trim() : '';
  };
  const generalReply = async (general: string, citations: LibraryCitation[] = []): Promise<AskResult> => {
    if (!general) {
      await log('no_sources', logSources(new Set()), usage.input > 0);
      return reply('no_sources', LIBRARY_NO_SOURCES_HE, citations, retrieved);
    }
    await log('general', logSources(new Set()), true);
    return { ...reply('general', '', citations, retrieved), general };
  };

  if (evidence.length === 0) return generalReply(await generalOnly());
  onStage?.('reading', { passages: evidence.length });

  const passages: PromptPassage[] = evidence.map((row, index) => ({
    n: index + 1,
    title: row.title,
    page: row.page,
    url: row.url,
    content: row.heading ? `${row.heading}\n${row.content}` : row.content,
  }));
  const groundingPassages: GroundingPassage[] = passages.map((p) => ({ n: p.n, content: p.content, title: p.title, page: p.page }));
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

  // The answer. The ceilings are well above what a reply needs, because
  // the model thinks before it writes and the thinking counts against the
  // same ceiling: a low one cut an answer mid-JSON and a verdict to nothing.
  const write = async (content: string): Promise<ModelAnswer | null> => {
    onStage?.('writing');
    const spoken = await callClaude({ system: ANSWER_SYSTEM, messages: [{ role: 'user', content }], maxTokens: 8000, effort: LIBRARY_EFFORT });
    usage.input += spoken.inputTokens;
    usage.output += spoken.outputTokens;
    return parseJsonReply<ModelAnswer>(spoken.text);
  };
  const usable = (draft: ModelAnswer | null): draft is ModelAnswer & { answer: string } =>
    Boolean(draft && draft.answered === true && typeof draft.answer === 'string' && draft.answer.trim());

  const first = await write(answerPrompt(question, history, passages));
  const general = typeof first?.general === 'string' ? first.general.trim() : '';
  if (!usable(first)) return generalReply(general, allCitations);

  // The second reading: which sentences do the passages not support?
  const judge = async (text: string): Promise<{ faithful: boolean; issues: Issue[] }> => {
    onStage?.('checking');
    const spoken = await callClaude({ system: REVIEW_SYSTEM, messages: [{ role: 'user', content: reviewPrompt(text, passages) }], maxTokens: 4000, effort: LIBRARY_EFFORT });
    usage.input += spoken.inputTokens;
    usage.output += spoken.outputTokens;
    const verdict = parseJsonReply<{ faithful?: boolean; issues?: unknown }>(spoken.text);
    const issues: Issue[] = Array.isArray(verdict?.issues)
      ? verdict.issues
          .map((issue): Issue | null => {
            if (typeof issue === 'string') return { quote: issue, why: '' };
            if (issue && typeof issue === 'object') {
              const { quote, why } = issue as { quote?: unknown; why?: unknown };
              return { quote: typeof quote === 'string' ? quote : '', why: typeof why === 'string' ? why : '' };
            }
            return null;
          })
          .filter((issue): issue is Issue => issue !== null && issue.quote.trim() !== '')
          .slice(0, 12)
      : [];
    // A verdict that could not be read names nothing; the grounding checks
    // above it still hold, and nothing is struck on a reading that did not happen.
    return { faithful: verdict?.faithful === true || (verdict?.faithful !== false && issues.length === 0) || (verdict === null && issues.length === 0), issues };
  };

  let answer = first.answer;
  let trimmed = 0;

  // Grounding — the checks that cannot be argued with. One rewrite with the
  // objections; what still fails is struck: a marker pointing nowhere goes,
  // a sentence stating a number the passages do not hold goes.
  onStage?.('checking');
  let grounding = checkGrounding(answer, groundingPassages);
  if (!grounding.ok) {
    const objections = grounding.problems.map((p) => (p.kind === 'number_not_in_sources' ? `the number ${p.detail} is not in the cited passages` : p.kind === 'unknown_citation' ? `the marker ${p.detail} names no passage` : p.detail));
    const again = timeForRewrite() ? await write(repairPrompt(question, history, passages, answer, objections)) : null;
    if (usable(again)) answer = again.answer;
    onStage?.('checking');
    grounding = checkGrounding(answer, groundingPassages);
    if (!grounding.ok) {
      const unknown = grounding.problems.filter((p) => p.kind === 'unknown_citation').map((p) => Number(p.detail.replace(/[[\]]/g, '')));
      if (unknown.length) answer = dropCitations(answer, unknown);
      const numbers = grounding.problems.filter((p) => p.kind === 'number_not_in_sources').map((p) => p.detail);
      const struck = removeSentencesWithNumbers(answer, numbers);
      answer = struck.text;
      trimmed += struck.removed;
    }
  }
  if (citationNumbers(answer).length === 0 || answer.trim().length < MIN_ANSWER_CHARS) return generalReply(general, allCitations);

  // The second reading. Sentences it names are struck; when a quote cannot
  // be found in the answer, the draft is written once more with the
  // objections and read a second time, and what that reading names is
  // struck. Two readings at most, one rewrite at most, and nothing unread leaves.
  let verdict = await judge(answer);
  if (!verdict.faithful && verdict.issues.length > 0) {
    const struck = removeSentences(answer, verdict.issues.map((i) => i.quote));
    if (struck.removed === verdict.issues.length) {
      answer = struck.text;
      trimmed += struck.removed;
    } else {
      const again = timeForRewrite() ? await write(repairPrompt(question, history, passages, answer, verdict.issues.map((i) => (i.why ? `${i.why}: "${i.quote}"` : i.quote)))) : null;
      if (usable(again)) {
        answer = again.answer;
        grounding = checkGrounding(answer, groundingPassages);
        if (!grounding.ok) {
          const numbers = grounding.problems.filter((p) => p.kind === 'number_not_in_sources').map((p) => p.detail);
          const unknown = grounding.problems.filter((p) => p.kind === 'unknown_citation').map((p) => Number(p.detail.replace(/[[\]]/g, '')));
          if (unknown.length) answer = dropCitations(answer, unknown);
          const cleaned = removeSentencesWithNumbers(answer, numbers);
          answer = cleaned.text;
          trimmed += cleaned.removed;
        }
        verdict = await judge(answer);
        if (!verdict.faithful && verdict.issues.length > 0) {
          const second = removeSentences(answer, verdict.issues.map((i) => i.quote));
          answer = second.text;
          trimmed += second.removed;
        }
      } else {
        answer = struck.text;
        trimmed += struck.removed;
      }
    }
  }
  if (citationNumbers(answer).length === 0 || answer.trim().length < MIN_ANSWER_CHARS) return generalReply(general, allCitations);

  const cited = new Set(citationNumbers(answer));
  await log('answered', logSources(cited), true);
  return {
    ...reply('answered', answer.trim(), [...cited].map(asCitation), retrieved),
    ...(general ? { general } : {}),
    ...(trimmed ? { trimmed } : {}),
  };
}
