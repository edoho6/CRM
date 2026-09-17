'use server';

import { getClinicScope } from '@/lib/session';
import { actionError, actionOk, type ActionResult } from '@/lib/errors';
import {
  ASSISTANT_MODEL,
  AssistantUnavailableError,
  callModel,
  isAssistantConfigured,
  type ContentBlock,
  type Message,
  type ModelUsage,
  type ToolSpec,
} from './anthropic';
import { QueryFailedError, QUERIES, QUERY_BY_NAME, type QueryResult } from './queries';

/**
 * The assistant turn: a question in, an answer and the tables behind it out.
 *
 * The loop is deliberately short — the model may call at most three queries
 * before it has to answer. A question that needs more than three of these is a
 * question this assistant should not be trying to answer, and an unbounded loop
 * against a paid API is a bill waiting to happen.
 *
 * Everything the model can reach is in `queries.ts`, which is the whole security
 * story: it cannot compose a query, only choose one and hand it two numbers.
 */

const MAX_STEPS = 3;

/**
 * Questions one person may ask in a clinic's day.
 *
 * Every question is two calls to a paid API, and until now nothing counted
 * them. The number is far above ordinary use — this is a question asked a few
 * times a week, not a few times an hour — so it is felt only by a loop or a
 * script, which is what it is here to stop. The library's own ceiling is sixty.
 */
const DAILY_QUOTA = 60;

/** One query the assistant ran, returned so the screen can show the real table. */
export interface AssistantTable {
  query: string;
  result: QueryResult;
}

export interface AssistantAnswer {
  text: string;
  tables: AssistantTable[];
}

const SYSTEM = `You help a practitioner understand the data in their own Chinese-medicine clinic
management system. You are given a fixed set of queries; choose the one that answers the question
and call it. You cannot write queries of your own, and there is nothing else you can see.

Answer in the language the question was asked in — Hebrew or English.

Rules:
- Answer only from what a query returned. If no query fits the question, say plainly which kinds of
  question you can answer instead. Never estimate, extrapolate, or fill a gap from general knowledge.
- Be brief: two or three sentences. The full table is shown to the practitioner beside your answer,
  so do not repeat it row by row — say what it means.
- State the period you are talking about, since the practitioner may have meant a different one.
- You are not a clinical tool. If asked what to prescribe, whether a treatment is working for a
  patient, or anything requiring clinical judgement, say that is outside what you do and that the
  record is where that belongs. Reporting a number that happens to be clinical — how often a point
  was used — is fine; advising on care is not.
- If a result is empty, say so directly rather than apologising at length.`;

function toolSpecs(): ToolSpec[] {
  return QUERIES.map((query) => ({
    name: query.name,
    description: query.description,
    input_schema: query.parameters as unknown as Record<string, unknown>,
  }));
}

export async function askAssistant(question: string): Promise<ActionResult<AssistantAnswer>> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));

  if (!isAssistantConfigured()) return actionError(new Error('assistant_not_configured'));

  const trimmed = question.trim();
  if (!trimmed) return actionError(new Error('validation'));
  // A question is a sentence. Anything longer is either a paste or an attempt to
  // fill the context with instructions, and neither is a question about the data.
  if (trimmed.length > 500) return actionError(new Error('question_too_long'));

  const messages: Message[] = [{ role: 'user', content: trimmed }];
  const tables: AssistantTable[] = [];
  const started = Date.now();
  const spent: ModelUsage = { input: 0, cacheWrite: 0, cacheRead: 0, output: 0 };

  /** What it cost, never what was asked. A log that falls over must not take the answer with it. */
  const log = async (status: 'answered' | 'refused_quota' | 'error') => {
    try {
      await scope.supabase.rpc('assistant_log_query', {
        p_status: status,
        p_model: status === 'refused_quota' ? null : ASSISTANT_MODEL,
        p_input_tokens: spent.input,
        p_cache_write_tokens: spent.cacheWrite,
        p_cache_read_tokens: spent.cacheRead,
        p_output_tokens: spent.output,
        p_latency_ms: Date.now() - started,
      });
    } catch {
      // Older database, or a log that refused. Neither is the practitioner's problem.
    }
  };

  // The ceiling, before anything costs.
  const { data: askedToday } = await scope.supabase.rpc('assistant_questions_today');
  if (Number(askedToday ?? 0) >= DAILY_QUOTA) {
    await log('refused_quota');
    return actionError(new Error('assistant_quota'));
  }

  try {
    for (let step = 0; step < MAX_STEPS; step += 1) {
      const reply = await callModel({ system: SYSTEM, messages, tools: toolSpecs() });
      spent.input += reply.usage.input;
      spent.cacheWrite += reply.usage.cacheWrite;
      spent.cacheRead += reply.usage.cacheRead;
      spent.output += reply.usage.output;

      const toolUses = reply.content.filter(
        (block): block is Extract<ContentBlock, { type: 'tool_use' }> => block.type === 'tool_use',
      );

      if (toolUses.length === 0) {
        const text = reply.content
          .filter(
            (block): block is Extract<ContentBlock, { type: 'text' }> => block.type === 'text',
          )
          .map((block) => block.text)
          .join('\n')
          .trim();

        await log('answered');
        return actionOk({ text: text || '', tables });
      }

      messages.push({ role: 'assistant', content: reply.content });

      const results: ContentBlock[] = [];
      for (const use of toolUses) {
        const query = QUERY_BY_NAME.get(use.name);
        if (!query) {
          // The model named something that is not in the list. Told plainly, so
          // it picks a real one rather than inventing an answer.
          results.push({
            type: 'tool_result',
            tool_use_id: use.id,
            content: 'No such query. Choose one of the queries you were given.',
          });
          continue;
        }

        // A query that fails is told to the model as a failure, not as an empty
        // result — otherwise it would report "you saw nobody in September" with
        // every appearance of having checked.
        let result: QueryResult;
        try {
          result = await query.run(scope.supabase, use.input ?? {});
        } catch (queryError) {
          if (!(queryError instanceof QueryFailedError)) throw queryError;
          results.push({
            type: 'tool_result',
            tool_use_id: use.id,
            content:
              'That query failed against the database. Say you could not check, and do not ' +
              'guess at the answer.',
          });
          continue;
        }

        tables.push({ query: query.name, result });
        results.push({
          type: 'tool_result',
          tool_use_id: use.id,
          content: JSON.stringify(result),
        });
      }

      messages.push({ role: 'user', content: results });
    }

    // Out of steps with no answer. Better to say so than to return the last
    // half-formed thing the model said on its way to a fourth query.
    await log('error');
    return actionError(new Error('assistant_gave_up'));
  } catch (error) {
    // The tokens were spent whether or not an answer came back, so they are
    // recorded either way — a bill that only counts successes is not a bill.
    await log('error');
    if (error instanceof AssistantUnavailableError) {
      return actionError(new Error('assistant_unavailable'));
    }
    return actionError(error instanceof Error ? error : new Error('assistant_failed'));
  }
}

/** Whether to offer the assistant at all, checked before the screen renders. */
export async function assistantAvailable(): Promise<boolean> {
  return isAssistantConfigured();
}
