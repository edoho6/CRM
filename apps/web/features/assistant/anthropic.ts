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

export interface ModelReply {
  stopReason: string | null;
  content: ContentBlock[];
}

export class AssistantUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AssistantUnavailableError';
  }
}

export async function callModel({
  system,
  messages,
  tools,
  signal,
}: {
  system: string;
  messages: Message[];
  tools: ToolSpec[];
  signal?: AbortSignal;
}): Promise<ModelReply> {
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
      system,
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
  };

  return { stopReason: payload.stop_reason ?? null, content: payload.content ?? [] };
}
