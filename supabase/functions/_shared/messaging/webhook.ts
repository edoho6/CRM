// Sending through an address of the practitioner's own: a Make webhook.
//
// A clinic that already runs its WhatsApp through ManyChat and Make does
// not need a second service. The sender posts each message, as plain JSON,
// to a webhook the practitioner made in Make; a scenario there hands it to
// ManyChat (or to any SMS service they use), and the number reaches the
// patient the way it always did. What we send is the least that delivers
// the message: where, the text, and — for a message the clinic starts
// after Meta's day-long window — which approved template and its values.
//
// Make answers 200 "Accepted" the moment it takes the request; the row is
// marked sent on that, under our own id, so a later status event from the
// scenario (delivered, read, failed) can name it.

import { isContactId } from './inbound.ts';
import { israeliInternational, israeliLocal } from './phone.ts';
import type { FetchLike, Provider, QueuedMessage, SendResult } from './types.ts';

export interface WebhookOptions {
  url: string;
  /** Sent as `x-herbalist-secret`, so the scenario can refuse a request that is not ours. */
  secret?: string | null;
  /** Recorded on the row as the provider; "make" by default. */
  name?: string;
  fetch: FetchLike;
}

/** The body posted to the webhook, exactly as DEPLOY.md documents it. */
export function webhookPayload(message: QueuedMessage, to: string) {
  return {
    id: message.id,
    channel: message.channel,
    kind: message.template_key,
    to,
    to_local: israeliLocal(to),
    body: message.body,
    template_id: message.whatsappTemplateId ?? null,
    params: message.params ?? [],
    from: message.whatsappSource ?? null,
  };
}

export function createWebhookProvider(options: WebhookOptions): Provider {
  return {
    name: options.name ?? 'make',
    async send(message: QueuedMessage): Promise<SendResult> {
      const raw = message.recipient?.trim() ?? '';
      const to = isContactId(raw) ? raw : israeliInternational(raw);
      if (!to) return { ok: false, errorCode: raw ? 'foreign_number' : 'no_recipient' };

      const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
      if (options.secret) headers['x-herbalist-secret'] = options.secret;

      const response = await options.fetch(options.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(webhookPayload(message, to)),
      });
      if (!response.ok) return { ok: false, errorCode: `http_${response.status}` };

      // A scenario that answers with JSON may name the message on its side;
      // otherwise our own id is the name a later status event will use.
      let providerId = message.id;
      try {
        const text = await response.text();
        const data = JSON.parse(text) as { id?: string | number } | null;
        if (data && (typeof data.id === 'string' || typeof data.id === 'number') && String(data.id).trim()) {
          providerId = String(data.id);
        }
      } catch {
        // "Accepted", or nothing: our id stands.
      }
      return { ok: true, providerId };
    },
  };
}
