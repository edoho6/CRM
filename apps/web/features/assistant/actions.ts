'use server';

import { getScopeWithAbility } from '@/lib/session';
import { actionError, actionOk, type ActionResult } from '@/lib/errors';
import {
  ASSISTANT_MODEL,
  AssistantUnavailableError,
  callModel,
  isAssistantConfigured,
  type ContentBlock,
  type ModelUsage,
  type ToolSpec,
} from './anthropic';
import { QueryFailedError, QUERIES, QUERY_BY_NAME, type QueryResult } from './queries';
import {
  buildOutboundRequest,
  OutboundBlockedError,
  outboundResult,
  PatientTokens,
  sanitizeFreeText,
  type KnownPatient,
  type OutboundContent,
  type OutboundMessage,
  type PatientTokenMap,
} from './outbound';
import { fetchAllRows } from '@/lib/fetch-all';

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
  /** `[PATIENT_n]` in the text → the patient, for the screen to draw the name. Never sent out. */
  patients: PatientTokenMap;
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
- If a result is empty, say so directly rather than apologising at length.
- Patients appear only as tokens such as [PATIENT_1]. Refer to a patient by their token, written
  exactly as it appears, and never guess or invent who a token stands for. Names are shown to the
  practitioner by the system, not by you.
- A result marked "withheld" was not shared with you: say you could not check that, and do not guess.`;

function toolSpecs(): ToolSpec[] {
  return QUERIES.map((query) => ({
    name: query.name,
    description: query.description,
    input_schema: query.parameters as unknown as Record<string, unknown>,
  }));
}

export async function askAssistant(question: string): Promise<ActionResult<AssistantAnswer>> {
  const scope = await getScopeWithAbility('reports');
  if (!scope) return actionError(new Error('unauthorized'));

  if (!isAssistantConfigured()) return actionError(new Error('assistant_not_configured'));

  const trimmed = question.trim();
  if (!trimmed) return actionError(new Error('validation'));
  // A question is a sentence. Anything longer is either a paste or an attempt to
  // fill the context with instructions, and neither is a question about the data.
  if (trimmed.length > 500) return actionError(new Error('question_too_long'));

  // The clinic's patients, for the name check on everything that leaves
  // (outbound.ts). Read through the caller's own rules, all of them.
  const known = await fetchAllRows<KnownPatient>((lo, hi) =>
    scope.supabase
      .from('patients')
      .select('id, first_name, last_name')
      .order('id', { ascending: true })
      .range(lo, hi),
  );
  // Without the list there is no way to know a name when one is typed; the
  // question does not leave rather than leave unchecked.
  if (known.error) return actionError(new Error('assistant_failed'));
  const tokens = new PatientTokens();

  const question0 = sanitizeFreeText(trimmed, known.data, tokens);
  if (!question0.ok) return actionError(new Error('assistant_name_in_question'));

  const messages: OutboundMessage[] = [{ role: 'user', content: question0.text }];
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

  // The ceiling, before anything costs. A count that cannot be read is not a
  // zero: the question waits rather than spend without a limit.
  const { data: askedToday, error: quotaError } = await scope.supabase.rpc(
    'assistant_questions_today',
  );
  if (quotaError) return actionError(new Error('assistant_failed'));
  if (Number(askedToday ?? 0) >= DAILY_QUOTA) {
    await log('refused_quota');
    return actionError(new Error('assistant_quota'));
  }

  let logged = false;
  try {
    for (let step = 0; step < MAX_STEPS; step += 1) {
      const reply = await callModel(
        buildOutboundRequest({ system: SYSTEM, messages, tools: toolSpecs() }, known.data, tokens),
      );
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
        logged = true;
        // The names go back into the answer here, on our side, by exact token.
        return actionOk({ text: text || '', tables, patients: tokens.mapping });
      }

      messages.push({ role: 'assistant', content: reply.content });

      const results: OutboundContent[] = [];
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
          result = await query.run(scope.supabase, use.input ?? {}, {
            timeZone: scope.context.clinic.timezone,
          });
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

        // The whole table stays on our side for the screen; the model gets the
        // allowlisted columns with patients as tokens.
        tables.push({ query: query.name, result });
        results.push({
          type: 'tool_result',
          tool_use_id: use.id,
          content: JSON.stringify(outboundResult(query.name, result, tokens)),
        });
      }

      messages.push({ role: 'user', content: results });
    }

    // Out of steps with no answer. Better to say so than to return the last
    // half-formed thing the model said on its way to a fourth query.
    return actionError(new Error('assistant_gave_up'));
  } catch (error) {
    if (error instanceof OutboundBlockedError) {
      return actionError(new Error('assistant_name_in_question'));
    }
    if (error instanceof AssistantUnavailableError) {
      return actionError(new Error('assistant_unavailable'));
    }
    return actionError(error instanceof Error ? error : new Error('assistant_failed'));
  } finally {
    // The tokens were spent whether or not an answer came back, so every path
    // that called the model is recorded — a ceiling that counts only answers
    // is no ceiling (migration 20260919110000 counts every row).
    if (!logged && (spent.input > 0 || spent.output > 0)) await log('error');
  }
}

/** Whether to offer the assistant at all, checked before the screen renders. */
export async function assistantAvailable(): Promise<boolean> {
  return isAssistantConfigured();
}
