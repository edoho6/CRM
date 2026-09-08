'use server';

import { getClinicScope } from '@/lib/session';
import { actionError, actionOk, type ActionResult } from '@/lib/errors';
import {
  AssistantUnavailableError,
  callModel,
  isAssistantConfigured,
  type ContentBlock,
  type Message,
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

  try {
    for (let step = 0; step < MAX_STEPS; step += 1) {
      const reply = await callModel({ system: SYSTEM, messages, tools: toolSpecs() });

      const toolUses = reply.content.filter(
        (block): block is Extract<ContentBlock, { type: 'tool_use' }> => block.type === 'tool_use',
      );

      if (toolUses.length === 0) {
        const text = reply.content
          .filter((block): block is Extract<ContentBlock, { type: 'text' }> => block.type === 'text')
          .map((block) => block.text)
          .join('\n')
          .trim();

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
    return actionError(new Error('assistant_gave_up'));
  } catch (error) {
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
