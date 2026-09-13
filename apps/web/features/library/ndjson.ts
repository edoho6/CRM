/**
 * Newline-delimited JSON, read as it arrives.
 *
 * A streamed reply is one JSON object per line. The network hands the
 * lines over in pieces of its own choosing — a line split in two, three
 * lines in one piece, a Hebrew letter cut between two bytes — so the
 * pieces are decoded as a stream and cut only at the newlines that have
 * actually arrived. Whatever is left when the body ends is one last line.
 */
export async function* readNdjson(body: ReadableStream<Uint8Array>): AsyncGenerator<unknown, void, undefined> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffered = '';
  try {
    for (;;) {
      const { value, done } = await reader.read();
      buffered += decoder.decode(value ?? new Uint8Array(), { stream: !done });
      let newline = buffered.indexOf('\n');
      while (newline >= 0) {
        const line = buffered.slice(0, newline).trim();
        buffered = buffered.slice(newline + 1);
        if (line) yield JSON.parse(line) as unknown;
        newline = buffered.indexOf('\n');
      }
      if (done) break;
    }
    const last = buffered.trim();
    if (last) yield JSON.parse(last) as unknown;
  } finally {
    reader.releaseLock();
  }
}
