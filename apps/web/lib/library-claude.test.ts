import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LIBRARY_EFFORT, LibraryUnavailableError, callClaude } from '../features/library/claude';

/** One reply of the messages API, as the library reads it. */
const reply = (text: string | null, usage = { input_tokens: 10, output_tokens: 5 }) =>
  new Response(JSON.stringify({ content: text === null ? [{ type: 'thinking', thinking: '…' }] : [{ type: 'text', text }], usage }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

describe('callClaude', () => {
  const calls: { body: Record<string, unknown> }[] = [];
  let replies: Response[] = [];

  beforeEach(() => {
    calls.length = 0;
    process.env.ANTHROPIC_API_KEY = 'test-key';
    vi.stubGlobal('fetch', async (_url: string, init: { body: string }) => {
      calls.push({ body: JSON.parse(init.body) as Record<string, unknown> });
      const next = replies.shift();
      if (!next) throw new Error('no reply queued');
      return next;
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.ANTHROPIC_API_KEY;
  });

  it('sends no temperature — the Claude 5 models refuse it — and returns the text with its usage', async () => {
    replies = [reply('{"answered": true}')];
    const out = await callClaude({ system: 's', messages: [{ role: 'user', content: 'q' }], maxTokens: 100 });
    expect(out).toEqual({ text: '{"answered": true}', inputTokens: 10, outputTokens: 5 });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.body).not.toHaveProperty('temperature');
    expect(calls[0]!.body).toMatchObject({ model: 'claude-sonnet-5', max_tokens: 100, system: 's' });
  });

  // Sonnet 5 thinks adaptively whether or not it is asked to, and at the
  // default effort that thinking took 88 seconds to write an answer and 38
  // more to judge it — two minutes against a route cut off at sixty. The
  // effort is what brought it to 38 and 2, so it is pinned here: without it
  // every question on a deployment fails, and nothing else in the app notices.
  it('asks for the effort it is given, and for none when it is not (Haiku 4.5 answers 400 to output_config)', async () => {
    replies = [reply('{"answered": true}'), reply('{"standalone": "q"}')];
    await callClaude({ system: 's', messages: [{ role: 'user', content: 'q' }], maxTokens: 100, effort: LIBRARY_EFFORT });
    expect(calls[0]!.body).toMatchObject({ output_config: { effort: 'low' } });
    await callClaude({ system: 's', messages: [{ role: 'user', content: 'q' }], maxTokens: 100, model: 'claude-haiku-4-5-20251001' });
    expect(calls[1]!.body).not.toHaveProperty('output_config');
  });
  it('asks once more when a reply carries no text, and adds up the usage of both', async () => {
    replies = [reply(null), reply('{"faithful": true}')];
    const out = await callClaude({ system: 's', messages: [{ role: 'user', content: 'q' }], maxTokens: 100 });
    expect(out).toEqual({ text: '{"faithful": true}', inputTokens: 20, outputTokens: 10 });
    expect(calls).toHaveLength(2);
  });

  it('gives up after the second empty reply and returns it empty, never as a pass', async () => {
    replies = [reply(null), reply('   ')];
    const out = await callClaude({ system: 's', messages: [{ role: 'user', content: 'q' }], maxTokens: 100 });
    expect(out.text.trim()).toBe('');
    expect(calls).toHaveLength(2);
  });

  it('carries an HTTP failure as a status only', async () => {
    replies = [new Response('{"error":{"message":"the question, echoed"}}', { status: 400 })];
    await expect(callClaude({ system: 's', messages: [{ role: 'user', content: 'q' }], maxTokens: 100 })).rejects.toThrow(
      new LibraryUnavailableError('http_400'),
    );
  });
});
