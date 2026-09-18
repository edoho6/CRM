/**
 * The model call.
 *
 * Plain `fetch` against the Messages API rather than an SDK: one endpoint, one
 * request shape, and a dependency whose whole job would be to build this object.
 *
 * The key is read from the environment on the server and never leaves it — it is
 * not a `NEXT_PUBLIC_` variable, so it cannot reach the browser bundle even by
 * accident, and the assistant reports itself unavailable when it is unset rather
 * than failing at the moment someone asks a question.
 */

import type { OutboundRequest } from './outbound';

export const ANTHROPIC_KEY_VAR = 'ANTHROPIC_API_KEY';

/**
 * Sonnet rather than the largest model: the work is picking one query out of a
 * list of eleven and writing two sentences about the result. Latency and cost
 * matter more here than depth, and this is not a clinical judgement.
 */
const MODEL = 'claude-sonnet-5';

const ENDPOINT = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';

export function isAssistantConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

export interface ToolSpec {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string };

export interface Message {
  role: 'user' | 'assistant';
  content: string | ContentBlock[];
}

/**
 * The four token counts, kept apart because they are billed apart: plain input,
 * a cache write (dearer than input), a cache read (a tenth of it), and output.
 * Added together they cannot be priced, which is exactly the mistake the
 * library's own log made.
 */
export interface ModelUsage {
  input: number;
  cacheWrite: number;
  cacheRead: number;
  output: number;
}

export interface ModelReply {
  stopReason: string | null;
  content: ContentBlock[];
  usage: ModelUsage;
}

export class AssistantUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AssistantUnavailableError';
  }
}

/**
 * The only call to the API. It takes an `OutboundRequest` — a type only
 * `outbound.ts` can build — so nothing reaches Anthropic without passing the
 * allowlist and the name check there.
 */
export async function callModel(
  request: OutboundRequest,
  signal?: AbortSignal,
): Promise<ModelReply> {
  const { system, messages, tools } = request;
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) throw new AssistantUnavailableError('not_configured');

  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': API_VERSION,
    },
    body: JSON.stringify({
      model: MODEL,
      // Enough for a short answer over a small table. The assistant explains a
      // result; it does not write reports.
      max_tokens: 1024,
      // The instructions and all twenty-one query definitions are the same on
      // every call, for every clinic, and they are most of the request. Marking
      // the end of the system block caches everything above it — the tools too,
      // since they are sent before it — so the second call of a question (the
      // one that reads the table back) pays a tenth for the part that did not
      // change. Five minutes rather than an hour: the pair of calls in one
      // question is seconds apart and always hits, while questions themselves
      // are days apart in a single clinic, and an hour-long entry costs more to
      // write than it would save there.
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      tools,
      messages,
    }),
    signal,
  });

  if (!response.ok) {
    // The body can carry the practitioner's question back in an error message,
    // so it is read for the status only and never logged.
    throw new AssistantUnavailableError(`http_${response.status}`);
  }

  const payload = (await response.json()) as {
    stop_reason?: string | null;
    content?: ContentBlock[];
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
    };
  };

  const u = payload.usage ?? {};
  return {
    stopReason: payload.stop_reason ?? null,
    content: payload.content ?? [],
    usage: {
      input: u.input_tokens ?? 0,
      cacheWrite: u.cache_creation_input_tokens ?? 0,
      cacheRead: u.cache_read_input_tokens ?? 0,
      output: u.output_tokens ?? 0,
    },
  };
}

/** The model this call uses, for the log. */
export const ASSISTANT_MODEL = MODEL;
