// SMS through 019 (019sms.co.il), an Israeli service with prepaid credit and
// an English sender name of up to eleven letters and digits.
//
// One request per message: POST https://019sms.co.il/api with a Bearer
// token. The service answers `status: 0` when it will send, and a number
// otherwise; the number is folded here into a short code the Messages
// screen can explain — nothing of the service's text is kept.

import { israeliLocal } from './phone.ts';
import type { FetchLike, Provider, QueuedMessage, SendResult } from './types.ts';

export const SMS_019_ENDPOINT = 'https://019sms.co.il/api';

/** The service's limit for one message, in characters. */
export const SMS_MAX_CHARS = 1005;

export interface Sms019Options {
  username: string;
  token: string;
  /** Up to eleven English letters and digits — what the patient sees as the sender. */
  sender: string;
  fetch: FetchLike;
}

/** The service's status numbers, folded into codes the app can explain. */
export function sms019ErrorCode(status: number): string {
  switch (status) {
    case 3:
    case 10:
    case 11:
      return 'auth_failed';
    case 4:
      return 'no_credit';
    case 5:
      return 'no_permission';
    case 6:
      return 'provider_error';
    case 8:
      return 'blocked';
    case 9:
      return 'bad_number';
    case 989:
      return 'too_long';
    case 992:
      return 'bad_sender';
    default:
      return `provider_${status}`;
  }
}

/** The request body, exactly as the service documents it. */
export function sms019Payload(options: Pick<Sms019Options, 'username' | 'sender'>, phone: string, body: string) {
  return {
    sms: {
      user: { username: options.username },
      source: options.sender,
      destinations: { phone: [{ _: phone }] },
      message: body,
    },
  };
}

export function createSms019Provider(options: Sms019Options): Provider {
  return {
    name: '019-sms',
    async send(message: QueuedMessage): Promise<SendResult> {
      const phone = israeliLocal(message.recipient);
      if (!phone) return { ok: false, errorCode: message.recipient ? 'foreign_number' : 'no_recipient' };
      if (message.body.length > SMS_MAX_CHARS) return { ok: false, errorCode: 'too_long' };

      const response = await options.fetch(SMS_019_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${options.token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(sms019Payload(options, phone, message.body)),
      });
      if (!response.ok) return { ok: false, errorCode: `http_${response.status}` };

      let data: { status?: number | string; shipment_id?: string | number };
      try {
        data = (await response.json()) as typeof data;
      } catch {
        return { ok: false, errorCode: 'provider_error' };
      }
      const status = Number(data.status);
      if (status === 0) {
        return { ok: true, providerId: data.shipment_id === undefined ? undefined : String(data.shipment_id) };
      }
      return { ok: false, errorCode: sms019ErrorCode(Number.isFinite(status) ? status : -1) };
    },
  };
}
