import { describe, expect, it } from 'vitest';
import { LIBRARY_DISCLAIMER_HE, type LibraryAnswer } from '@clinic/domain';
import { readNdjson } from '../features/library/ndjson';
import { streamReply } from '../features/library/stream';

const answered: LibraryAnswer = { status: 'answered', answer: 'תשובה [1]', citations: [], disclaimer: LIBRARY_DISCLAIMER_HE };
const failed: LibraryAnswer & { error: string } = { status: 'error', answer: '', citations: [], disclaimer: LIBRARY_DISCLAIMER_HE, error: 'boom' };

async function events(response: Response) {
  const out: unknown[] = [];
  for await (const event of readNdjson(response.body!)) out.push(event);
  return out;
}

describe('streamReply', () => {
  it('sends the stages as they are reported, then the whole reply, and only then', async () => {
    const response = streamReply(async (onStage) => {
      onStage('searching');
      onStage('reading', { passages: 4 });
      onStage('writing');
      onStage('checking');
      return answered;
    }, () => failed);
    expect(response.headers.get('content-type')).toContain('application/x-ndjson');
    expect(response.headers.get('cache-control')).toBe('no-store');
    const lines = await events(response);
    expect(lines).toEqual([
      { type: 'stage', stage: 'searching' },
      { type: 'stage', stage: 'reading', passages: 4 },
      { type: 'stage', stage: 'writing' },
      { type: 'stage', stage: 'checking' },
      { type: 'done', reply: answered },
    ]);
    // No line before `done` carries any text of the answer.
    const beforeDone = JSON.stringify(lines.slice(0, -1));
    expect(beforeDone).not.toContain('תשובה');
  });

  it('turns a failure into a done line that still carries the disclaimer', async () => {
    const response = streamReply(async (onStage) => {
      onStage('searching');
      throw new Error('provider down');
    }, () => failed);
    const lines = await events(response);
    expect(lines).toEqual([{ type: 'stage', stage: 'searching' }, { type: 'done', reply: failed }]);
    expect((lines[1] as { reply: LibraryAnswer }).reply.disclaimer).toBe(LIBRARY_DISCLAIMER_HE);
  });
});
