// The sender's shapes.
//
// Everything under _shared/messaging is plain TypeScript with explicit `.ts`
// imports and nothing from Deno or Node, so the same files are run by the
// Edge Function and by vitest in apps/web (through the `@messaging/*`
// alias). Only "erasable" syntax is used here for that reason: no enums, no
// parameter properties.

export type Channel = 'sms' | 'whatsapp' | 'email' | 'push';

/** One row of `message_log` as the sender reads it, with what the send needs beside it. */
export interface QueuedMessage {
  id: string;
  clinic_id: string;
  channel: Channel;
  template_key: string;
  recipient: string | null;
  body: string;
  subject: string | null;
  link_url: string | null;
  appointment_id: string | null;
  /** The template's variable values, in order ({{1}}..{{5}}); null for a body-only message. */
  params: string[] | null;
  /** The approved WhatsApp template for this kind, when the clinic pasted one. */
  whatsappTemplateId?: string | null;
  /** The row's clinic is a sandbox of fictional patients: nothing real may be sent to it. */
  clinicSynthetic: boolean;
}

export interface SendResult {
  ok: boolean;
  providerId?: string;
  /** A short code, never the service's full response: `no_credit`, `bad_number`, `http_503`. */
  errorCode?: string;
}

export interface Provider {
  /** Recorded on the row as `provider` when the send succeeds. */
  name: string;
  send(message: QueuedMessage): Promise<SendResult>;
}

/** `fetch`, handed in so a test can answer instead of the service. */
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;
