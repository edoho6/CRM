import 'server-only';

import { parsePlan, planFallback, type SearchPlan } from '@clinic/domain';
import { LIBRARY_MODEL, LIBRARY_PLAN_MODEL, LibraryUnavailableError, callClaude, parseJsonReply } from './claude';
import { PLAN_SYSTEM, planPrompt, type PromptTurn } from './prompts';

/**
 * The question, prepared for the search: on its own (a follow-up like "and
 * in pregnancy?" needs its earlier turns), in English (the passages
 * mostly are), with the words a textbook would use for the word index,
 * and whether it asks for one thing or for a list. A small, fast model
 * does this; when it fails or answers nonsense, the question is searched
 * as it came, which is what happened before the planner existed.
 */
export async function planSearch(question: string, history: readonly PromptTurn[]): Promise<{ plan: SearchPlan; inputTokens: number; outputTokens: number }> {
  const attempt = async (model: string) =>
    callClaude({ system: PLAN_SYSTEM, messages: [{ role: 'user', content: planPrompt(question, history) }], maxTokens: 600, model });
  try {
    let reply;
    try {
      reply = await attempt(LIBRARY_PLAN_MODEL);
    } catch (error) {
      // A key that does not know the small model falls back to the one that answers.
      if (error instanceof LibraryUnavailableError && /^http_(404|400)$/.test(error.message)) reply = await attempt(LIBRARY_MODEL);
      else throw error;
    }
    return { plan: parsePlan(parseJsonReply<unknown>(reply.text), question), inputTokens: reply.inputTokens, outputTokens: reply.outputTokens };
  } catch {
    return { plan: planFallback(question), inputTokens: 0, outputTokens: 0 };
  }
}
