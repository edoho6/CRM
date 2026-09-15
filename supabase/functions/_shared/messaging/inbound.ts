// What the sending service pushes when something happens on WhatsApp.
//
// 019 posts one JSON object per event: `hook: "new"` for a message a
// patient sent, `hook: "update"` for the ticks on one the clinic sent, and
// `hook: "system"` for a failure the service found after accepting a
// message. The inbound function only has to tell those apart and hand the
// object to the database, which makes rows of it; nothing of the body is
// read here, and nothing of it is logged.

export type PushHook = 'new' | 'update' | 'system';

export type PushEvent =
  | { hook: PushHook; payload: Record<string, unknown> }
  | { hook: 'ignored'; reason: 'not_object' | 'unknown_hook' | 'no_id' };

const HOOKS: readonly PushHook[] = ['new', 'update', 'system'];

export function parsePush(raw: unknown): PushEvent {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { hook: 'ignored', reason: 'not_object' };
  const payload = raw as Record<string, unknown>;
  const hook = typeof payload.hook === 'string' ? payload.hook : '';
  if (!(HOOKS as readonly string[]).includes(hook)) return { hook: 'ignored', reason: 'unknown_hook' };
  // Every event names the message it concerns; one without an id is
  // nothing the database could attach to anything.
  if (typeof payload.unique !== 'string' || !payload.unique.trim()) return { hook: 'ignored', reason: 'no_id' };
  return { hook: hook as PushHook, payload };
}

/** Meta's opaque id for a person who hides their number: a country code, a dot, digits. */
export function isContactId(value: string): boolean {
  return /^[A-Z]{2}\.\d{4,}$/.test(value);
}
