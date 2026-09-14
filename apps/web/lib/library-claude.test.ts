import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LibraryUnavailableError, callClaude } from '../features/library/claude';

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
