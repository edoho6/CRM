import 'server-only';

/**
 * The model call for the library, kept apart from the data assistant's so
 * neither can change the other. Same shape: plain `fetch`, the key read on
 * the server and never logged, an error carried as a status only — the
 * body could echo the practitioner's question.
 */

const ENDPOINT = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';

/**
 * Sonnet 5 answers; it is asked to quote, not to reason far, and the
 * grounding checks catch what it gets wrong. Switch to 'claude-opus-5' here
 * if the library grows to where the checks reject too much.
 */
export const LIBRARY_MODEL = 'claude-sonnet-5';

export class LibraryUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LibraryUnavailableError';
  }
}

export interface ClaudeReply {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

export async function callClaude({
  system,
  messages,
  maxTokens,
  model = LIBRARY_MODEL,
  signal,
}: {
  system: string;
  messages: { role: 'user' | 'assistant'; content: string }[];
  maxTokens: number;
  model?: string;
  signal?: AbortSignal;
}): Promise<ClaudeReply> {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) throw new LibraryUnavailableError('not_configured');

  // Now and then a reply arrives with no text in it at all (the service
  // ends the turn before writing); one such reply made an answerable
  // question "not found" at the judging step. It is asked once more; a
  // second empty reply is returned as it is, and the caller treats it as
  // no answer — never as a pass.
  let inputTokens = 0;
  let outputTokens = 0;
  for (let attempt = 1; ; attempt += 1) {
    // No `temperature`: the Claude 5 models refuse the parameter outright
    // ("deprecated for this model", HTTP 400), and every library question
    // came back as an error until it was dropped. Determinism is not lost —
    // the grounding checks, not the sampling, are what keep the answer honest.
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': API_VERSION },
      body: JSON.stringify({ model, max_tokens: maxTokens, system, messages }),
      signal,
    });
    if (!response.ok) throw new LibraryUnavailableError(`http_${response.status}`);

    const payload = (await response.json()) as {
      content?: { type: string; text?: string }[];
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    const text = (payload.content ?? [])
      .filter((block) => block.type === 'text' && typeof block.text === 'string')
      .map((block) => block.text)
      .join('\n');
    inputTokens += payload.usage?.input_tokens ?? 0;
    outputTokens += payload.usage?.output_tokens ?? 0;
    if (text.trim() !== '' || attempt >= 2) return { text, inputTokens, outputTokens };
  }
}

/** The first JSON object in a reply; the model is asked for JSON only, but it sometimes wraps it. */
export function parseJsonReply<T>(text: string): T | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}
