import { describe, expect, it } from 'vitest';
import { readNdjson } from '../features/library/ndjson';

function streamOf(pieces: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const piece of pieces) controller.enqueue(piece);
      controller.close();
    },
  });
}

async function collect(stream: ReadableStream<Uint8Array>): Promise<unknown[]> {
  const out: unknown[] = [];
  for await (const event of readNdjson(stream)) out.push(event);
  return out;
}

describe('readNdjson', () => {
  it('yields one object per line however the bytes are cut, and the last line without a newline', async () => {
    const text = '{"type":"stage","stage":"searching"}\n{"type":"stage","stage":"reading","passages":3}\n{"type":"done","reply":{"answer":"שלום"}}';
    const bytes = new TextEncoder().encode(text);
    // Cut inside the Hebrew word: "ש" is two bytes, and the cut falls between them.
    const cut = bytes.indexOf(0xd7, bytes.length - 12) + 1;
    const pieces = [bytes.slice(0, 10), bytes.slice(10, 60), bytes.slice(60, cut), bytes.slice(cut)];
    expect(await collect(streamOf(pieces))).toEqual([
      { type: 'stage', stage: 'searching' },
      { type: 'stage', stage: 'reading', passages: 3 },
      { type: 'done', reply: { answer: 'שלום' } },
    ]);
  });

  it('skips blank lines and handles an empty body', async () => {
    expect(await collect(streamOf([new TextEncoder().encode('\n\n{"a":1}\n\n')]))).toEqual([{ a: 1 }]);
    expect(await collect(streamOf([]))).toEqual([]);
  });
});
