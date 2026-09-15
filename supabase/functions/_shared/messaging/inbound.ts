// What arrives when something happens on WhatsApp.
//
// Two dialects reach the inbound function. 019 posts one JSON object per
// event: `hook: "new"` for a message a patient sent, `hook: "update"` for
// the ticks on one the clinic sent, `hook: "system"` for a failure the
// service found after accepting a message. A practitioner's own scenario
// (ManyChat's "External Request", a Make module) posts a simpler shape,
// documented in DEPLOY.md: `event: "message"` with the sender, the text and
// the sender's name, or `event: "status"` with the message's id and where it
// stands. The second is folded into the first here, so the database knows
// one shape. Nothing of a body is read beyond what the fold needs, and
// nothing of it is logged.

export type PushHook = 'new' | 'update' | 'system';

export type PushEvent =
  | { hook: PushHook; payload: Record<string, unknown> }
  | { hook: 'ignored'; reason: 'not_object' | 'unknown_hook' | 'no_id' | 'no_sender' | 'no_line' };

const HOOKS: readonly PushHook[] = ['new', 'update', 'system'];

const STATUS_ACK: Record<string, number> = { failed: 0, sent: 1, delivered: 2, read: 3 };

function text(value: unknown): string | null {
  if (typeof value === 'number') return String(value);
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/** A unix time in seconds from a number, a numeric string, or an ISO date; null when none. */
function unixSeconds(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value > 1e11 ? Math.floor(value / 1000) : Math.floor(value);
  if (typeof value === 'string' && value.trim()) {
    if (/^\d+$/.test(value.trim())) return unixSeconds(Number(value));
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return Math.floor(parsed / 1000);
  }
  return null;
}

/**
 * A stable name for a message that arrived without one (a scenario that
 * cannot pass the service's id): the sender, the text and the minute. The
 * same message posted twice in a minute is one row, which is what a retry
 * looks like; two identical texts a minute apart are two.
 */
export function syntheticId(from: string, body: string, unixTime: number): string {
  const input = `${from}|${body}|${Math.floor(unixTime / 60)}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `gen-${hash.toString(16).padStart(8, '0')}-${Math.floor(unixTime / 60).toString(16)}`;
}

/** The practitioner's own shape, folded into the service's. */
function parseGeneric(payload: Record<string, unknown>, fallbackTo: string | null): PushEvent {
  const event = text(payload.event);
  if (event === 'message') {
    const from = text(payload.from) ?? text(payload.phone);
    if (!from) return { hook: 'ignored', reason: 'no_sender' };
    const to = text(payload.to) ?? fallbackTo;
    if (!to) return { hook: 'ignored', reason: 'no_line' };
    const body = text(payload.text) ?? text(payload.body) ?? '';
    const at = unixSeconds(payload.timestamp) ?? Math.floor(Date.now() / 1000);
    const unique = text(payload.id) ?? syntheticId(from, body, at);
    const media = text(payload.media_url);
    return {
      hook: 'new',
      payload: {
        status: 'OK',
        hook: 'new',
        unique,
        from,
        to,
        senderName: text(payload.name) ?? '',
        type: text(payload.type) ?? (media ? 'document' : 'text'),
        body,
        caption: '',
        media: media ?? false,
        timestamp: String(at),
      },
    };
  }
  if (event === 'status') {
    const unique = text(payload.id);
    if (!unique) return { hook: 'ignored', reason: 'no_id' };
    const status = text(payload.status)?.toLowerCase() ?? '';
    const ack = STATUS_ACK[status];
    if (ack === undefined) return { hook: 'ignored', reason: 'unknown_hook' };
    return { hook: 'update', payload: { status: 'OK', hook: 'update', unique, ack } };
  }
  return { hook: 'ignored', reason: 'unknown_hook' };
}

export function parsePush(raw: unknown, options: { fallbackTo?: string | null } = {}): PushEvent {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { hook: 'ignored', reason: 'not_object' };
  const payload = raw as Record<string, unknown>;
  if (typeof payload.event === 'string' && typeof payload.hook !== 'string') {
    return parseGeneric(payload, options.fallbackTo ?? null);
  }
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
