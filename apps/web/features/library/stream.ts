import type { LibraryAnswer, LibraryStage, LibraryStreamEvent } from '@clinic/domain';

/**
 * A reply streamed as newline-delimited JSON: one line per stage as the
 * answer is searched for, written and checked, then one `done` line with
 * the whole reply. The answer's text is never on the wire before the
 * checks have passed it — the stages carry no words, only where the work
 * is — so nothing the checks would strike is ever shown.
 *
 * Kept apart from the route so it can be tested with a fake run.
 */

export type StageReporter = (stage: LibraryStage, detail?: { passages?: number }) => void;

export function streamReply<T extends LibraryAnswer>(
  run: (onStage: StageReporter) => Promise<T>,
  onError: (error: unknown) => T,
  headers: Record<string, string> = {},
): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: LibraryStreamEvent) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      try {
        const reply = await run((stage, detail) => send({ type: 'stage', stage, ...detail }));
        send({ type: 'done', reply });
      } catch (error) {
        send({ type: 'done', reply: onError(error) });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: { ...headers, 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store', 'x-accel-buffering': 'no' },
  });
}
