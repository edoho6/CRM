// WhatsApp through 019, which fronts Meta's WhatsApp Business Platform.
//
// A message the clinic starts must be a template Meta approved — free text
// is allowed only within a day of the patient writing to the clinic. So a
// row that names its template goes as one (the variables from `params`,
// numbered as Meta numbers them), and a row without one is tried as free
// text: it reaches a patient who wrote recently, and for anyone else the
// service answers reason 7 or 8, which becomes `needs_template` on the row —
// the Messages screen says so, and the manual path is still there.
//
// Both numbers are international without a plus; the clinic's own is the
// number verified in its 019 account.

import { israeliInternational } from './phone.ts';
import type { FetchLike, Provider, QueuedMessage, SendResult } from './types.ts';

export const WHATSAPP_019_MESSAGE_ENDPOINT = 'https://019sms.co.il/whatsapp-api/send-whatsapp-message';
export const WHATSAPP_019_TEMPLATE_ENDPOINT = 'https://019sms.co.il/whatsapp-api/send-whatsapp-template';

export interface Whatsapp019Options {
  token: string;
  /** The clinic's WhatsApp number as verified with the service: `972…`. */
  source: string;
  fetch: FetchLike;
}

interface ServiceAnswer {
  success?: boolean;
  ans?: { status?: string; unique?: string | number; reason?: number | string };
  reason?: number | string;
  message?: string;
}

/** Meta's variables, as the service takes them: `{"1": …, "2": …}` in order. */
export function dynamicFields(params: readonly string[] | null | undefined): Record<string, string> {
  const fields: Record<string, string> = {};
  (params ?? []).forEach((value, index) => {
    // A variable may not carry a line break; the service refuses the whole message.
    fields[String(index + 1)] = value.replace(/\s*\n\s*/g, ' ');
  });
  return fields;
}

/** Reasons that mean "not inside the day the patient wrote": send a template instead. */
const NEEDS_TEMPLATE_REASONS = new Set([7, 8]);

export function whatsapp019ErrorCode(answer: ServiceAnswer): string {
  const reason = Number(answer.ans?.reason ?? answer.reason);
  if (NEEDS_TEMPLATE_REASONS.has(reason)) return 'needs_template';
  return Number.isFinite(reason) && reason !== 0 ? `provider_${reason}` : 'provider_error';
}

export function createWhatsapp019Provider(options: Whatsapp019Options): Provider {
  return {
    name: '019-whatsapp',
    async send(message: QueuedMessage): Promise<SendResult> {
      const destination = israeliInternational(message.recipient);
      if (!destination) return { ok: false, errorCode: message.recipient ? 'foreign_number' : 'no_recipient' };

      const templateId = message.whatsappTemplateId?.trim();
      const url = templateId ? WHATSAPP_019_TEMPLATE_ENDPOINT : WHATSAPP_019_MESSAGE_ENDPOINT;
      const payload = templateId
        ? {
            source: options.source,
            destination,
            templateId,
            dynamicFieldsObject: dynamicFields(message.params),
          }
        : { source: options.source, destination, message: message.body };

      const response = await options.fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${options.token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) return { ok: false, errorCode: `http_${response.status}` };

      let data: ServiceAnswer;
      try {
        data = (await response.json()) as ServiceAnswer;
      } catch {
        return { ok: false, errorCode: 'provider_error' };
      }
      if (data.success && data.ans?.status === 'OK') {
        return { ok: true, providerId: data.ans.unique === undefined ? undefined : String(data.ans.unique) };
      }
      return { ok: false, errorCode: whatsapp019ErrorCode(data) };
    },
  };
}
