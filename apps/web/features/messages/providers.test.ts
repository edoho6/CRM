import { describe, expect, it } from 'vitest';
import { israeliInternational, israeliLocal } from '@messaging/phone.ts';
import { buildTemplateMap, skipReason, templateIdFor } from '@messaging/policy.ts';
import { SMS_019_ENDPOINT, createSms019Provider, sms019ErrorCode, sms019Payload } from '@messaging/sms-019.ts';
import type { FetchLike, QueuedMessage } from '@messaging/types.ts';
import {
  WHATSAPP_019_MESSAGE_ENDPOINT,
  WHATSAPP_019_TEMPLATE_ENDPOINT,
  createWhatsapp019Provider,
  dynamicFields,
} from '@messaging/whatsapp-019.ts';

// The sender's adapters, run against a fake service: what they send, and
// what they make of what comes back. No real request leaves this file.

function message(overrides: Partial<QueuedMessage> = {}): QueuedMessage {
  return {
    id: 'm1',
    clinic_id: 'c1',
    channel: 'sms',
    template_key: 'appointment_reminder',
    recipient: '050-123-4567',
    body: 'שלום דנה, תזכורת לתור',
    subject: null,
    link_url: null,
    appointment_id: null,
    params: null,
    clinicSynthetic: false,
    ...overrides,
  };
}

/** A fetch that answers with one fixed body and records what it was asked. */
function fakeFetch(status: number, body: unknown) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetch: FetchLike = async (url, init) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  };
  return { fetch, calls };
}

describe('Israeli phone numbers', () => {
  it('folds every spelling of an Israeli mobile into the local and the international form', () => {
    for (const raw of ['050-123-4567', '0501234567', '+972-50-123-4567', '+972 50 123 4567', '972501234567', '00972501234567', '501234567']) {
      expect(israeliLocal(raw), raw).toBe('0501234567');
      expect(israeliInternational(raw), raw).toBe('972501234567');
    }
  });

  it('keeps a landline and refuses anything foreign or malformed', () => {
    expect(israeliLocal('03-6123456')).toBe('036123456');
    expect(israeliInternational('+972-3-612-3456')).toBe('97236123456');
    expect(israeliLocal('+44 20 7946 0958')).toBeNull();
    expect(israeliLocal('12345')).toBeNull();
    expect(israeliLocal('')).toBeNull();
    expect(israeliLocal(null)).toBeNull();
  });
});

describe('SMS through 019', () => {
  const options = { username: 'clinic', token: 'secret-token', sender: 'Herbalist' };

  it('posts the documented body with the local number and reports the shipment id', async () => {
    const { fetch, calls } = fakeFetch(200, { status: 0, message: 'SMS will be sent', shipment_id: 'S-77' });
    const result = await createSms019Provider({ ...options, fetch }).send(message({ recipient: '+972 50 123 4567' }));
    expect(result).toEqual({ ok: true, providerId: 'S-77' });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe(SMS_019_ENDPOINT);
    expect(calls[0]!.init?.headers).toMatchObject({ Authorization: 'Bearer secret-token' });
    expect(JSON.parse(String(calls[0]!.init?.body))).toEqual(sms019Payload(options, '0501234567', 'שלום דנה, תזכורת לתור'));
    expect(sms019Payload(options, '0501234567', 'x')).toEqual({
      sms: { user: { username: 'clinic' }, source: 'Herbalist', destinations: { phone: [{ _: '0501234567' }] }, message: 'x' },
    });
  });

  it('folds the service statuses into short codes', async () => {
    expect(sms019ErrorCode(3)).toBe('auth_failed');
    expect(sms019ErrorCode(10)).toBe('auth_failed');
    expect(sms019ErrorCode(11)).toBe('auth_failed');
    expect(sms019ErrorCode(4)).toBe('no_credit');
    expect(sms019ErrorCode(5)).toBe('no_permission');
    expect(sms019ErrorCode(8)).toBe('blocked');
    expect(sms019ErrorCode(9)).toBe('bad_number');
    expect(sms019ErrorCode(989)).toBe('too_long');
    expect(sms019ErrorCode(992)).toBe('bad_sender');
    expect(sms019ErrorCode(42)).toBe('provider_42');

    const { fetch } = fakeFetch(200, { status: 4, message: 'Not enough credit' });
    expect(await createSms019Provider({ ...options, fetch }).send(message())).toEqual({ ok: false, errorCode: 'no_credit' });
  });

  it('fails before calling for a foreign number, a missing number, or an over-long text', async () => {
    const { fetch, calls } = fakeFetch(200, { status: 0 });
    const provider = createSms019Provider({ ...options, fetch });
    expect(await provider.send(message({ recipient: '+44 20 7946 0958' }))).toEqual({ ok: false, errorCode: 'foreign_number' });
    expect(await provider.send(message({ recipient: null }))).toEqual({ ok: false, errorCode: 'no_recipient' });
    expect(await provider.send(message({ body: 'x'.repeat(1006) }))).toEqual({ ok: false, errorCode: 'too_long' });
    expect(calls).toHaveLength(0);
  });

  it('reports an HTTP failure and an unreadable answer as codes', async () => {
    const { fetch } = fakeFetch(503, {});
    expect(await createSms019Provider({ ...options, fetch }).send(message())).toEqual({ ok: false, errorCode: 'http_503' });
    const broken: FetchLike = async () => new Response('not json', { status: 200 });
    expect(await createSms019Provider({ ...options, fetch: broken }).send(message())).toEqual({ ok: false, errorCode: 'provider_error' });
  });
});

describe('WhatsApp through 019', () => {
  const options = { token: 'secret-token', source: '972555555555' };
  const ok = { success: true, ans: { status: 'OK', unique: 'W-9', timestamp: 1, reason: 1 } };

  it('sends an approved template with the variables numbered in order', async () => {
    const { fetch, calls } = fakeFetch(200, ok);
    const result = await createWhatsapp019Provider({ ...options, fetch }).send(
      message({ channel: 'whatsapp', whatsappTemplateId: '111_972555555555_abc', params: ['דנה', 'הקליניקה', '10/09/2026', '09:30', 'https://x/c/1'] }),
    );
    expect(result).toEqual({ ok: true, providerId: 'W-9' });
    expect(calls[0]!.url).toBe(WHATSAPP_019_TEMPLATE_ENDPOINT);
    expect(JSON.parse(String(calls[0]!.init?.body))).toEqual({
      source: '972555555555',
      destination: '972501234567',
      templateId: '111_972555555555_abc',
      dynamicFieldsObject: { '1': 'דנה', '2': 'הקליניקה', '3': '10/09/2026', '4': '09:30', '5': 'https://x/c/1' },
    });
  });

  it('sends free text when no template is known, and names the need for one when the service refuses', async () => {
    const { fetch, calls } = fakeFetch(200, ok);
    await createWhatsapp019Provider({ ...options, fetch }).send(message({ channel: 'whatsapp' }));
    expect(calls[0]!.url).toBe(WHATSAPP_019_MESSAGE_ENDPOINT);
    expect(JSON.parse(String(calls[0]!.init?.body))).toEqual({ source: '972555555555', destination: '972501234567', message: 'שלום דנה, תזכורת לתור' });

    for (const reason of [7, 8]) {
      const refused = fakeFetch(200, { success: false, ans: { status: 'ERROR', reason } });
      expect(await createWhatsapp019Provider({ ...options, fetch: refused.fetch }).send(message({ channel: 'whatsapp' }))).toEqual({
        ok: false,
        errorCode: 'needs_template',
      });
    }
    const other = fakeFetch(200, { success: false, reason: 3 });
    expect(await createWhatsapp019Provider({ ...options, fetch: other.fetch }).send(message({ channel: 'whatsapp' }))).toEqual({
      ok: false,
      errorCode: 'provider_3',
    });
  });

  it('keeps a line break out of a variable, which the service refuses whole', () => {
    expect(dynamicFields(['a\nb', 'c'])).toEqual({ '1': 'a b', '2': 'c' });
    expect(dynamicFields(null)).toEqual({});
  });

  it('refuses a foreign number without calling', async () => {
    const { fetch, calls } = fakeFetch(200, ok);
    expect(await createWhatsapp019Provider({ ...options, fetch }).send(message({ channel: 'whatsapp', recipient: '+1 212 555 0100' }))).toEqual({
      ok: false,
      errorCode: 'foreign_number',
    });
    expect(calls).toHaveLength(0);
  });
});

describe('what the sender decides first', () => {
  it('sends nothing to a patient of a sandbox clinic, except the practitioner\'s own test', () => {
    expect(skipReason({ clinicSynthetic: true, template_key: 'appointment_reminder' })).toBe('synthetic_clinic');
    expect(skipReason({ clinicSynthetic: true, template_key: 'birthday' })).toBe('synthetic_clinic');
    expect(skipReason({ clinicSynthetic: true, template_key: 'test_message' })).toBeNull();
    expect(skipReason({ clinicSynthetic: false, template_key: 'appointment_reminder' })).toBeNull();
  });

  it('looks a clinic\'s template up by message kind and ignores blanks', () => {
    const map = buildTemplateMap([
      { clinic_id: 'c1', kind: 'appointment_reminder', whatsapp_template_id: ' 111_x ' },
      { clinic_id: 'c1', kind: 'birthday', whatsapp_template_id: '' },
      { clinic_id: 'c2', kind: 'birthday', whatsapp_template_id: '222_y' },
    ]);
    expect(templateIdFor(map, 'c1', 'appointment_reminder')).toBe('111_x');
    expect(templateIdFor(map, 'c1', 'birthday')).toBeNull();
    expect(templateIdFor(map, 'c2', 'birthday')).toBe('222_y');
    expect(templateIdFor(map, 'c3', 'birthday')).toBeNull();
  });
});
