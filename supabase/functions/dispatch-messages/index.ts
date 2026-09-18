// The sender.
//
// Runs inside Supabase (Edge Functions) and works through two queues:
//
//   message_log       — reminders, alerts and the automated messages,
//                       queued by the hourly jobs; taken on the schedule
//                       (every five minutes, with the secret) and handed
//                       to the provider of each row's channel. A channel
//                       with no provider is left alone — the row stays
//                       queued, and the Messages screen offers it to a
//                       person to send by hand.
//   whatsapp_messages — what staff write in a WhatsApp thread, and the
//                       line that answers a tap on "אגיע". Taken on the
//                       schedule too, but also the moment they are written:
//                       a signed-in member of a clinic may wake the sender
//                       (the app does, right after saving), and so may the
//                       inbound function. A waking sends only this queue,
//                       and rows are claimed under a lock, so two wakings
//                       never send one twice.
//
// Why here and not in the web app: sending is a job across every clinic at
// once, and the web app has no identity that may read across clinics — by
// design, it holds no service key. This function does, because Supabase
// hands it one at runtime; it never appears in the repository, and it is
// used for exactly this one thing.
//
// Secrets, all set in the Supabase dashboard under Edge Functions → Secrets:
//   DISPATCH_SECRET           — the schedule must send it as `x-dispatch-secret`
//   RESEND_API_KEY            — enables email, via resend.com
//   EMAIL_FROM                — e.g. "Herbalist <reminders@your-domain>"
//   FCM_SERVICE_ACCOUNT_JSON  — enables phone notifications: the service
//                               account file Firebase hands out, pasted whole
//   SMS_019_USERNAME          — enables SMS through 019 (019sms.co.il): the
//   SMS_019_TOKEN               account's user name, an API token made in its
//   SMS_SENDER                  settings, and the sender name patients see
//                               (up to eleven English letters and digits)
//   WhatsApp goes through the same 019 token, from each clinic's own line
//   (clinics.whatsapp_number, entered in Settings → Messages).
//
// The adapters themselves are plain TypeScript in ../_shared/messaging, run
// by this function and tested by the web app. Nothing about a patient is
// logged here. A failed send records a short error code on the row and
// nothing else, and is never retried on its own: the reason is something a
// person fixes (credit, a number, a missing template), and the Messages
// screen shows it with the manual path beside it.

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { buildTemplateMap, skipReason, templateIdFor } from '../_shared/messaging/policy.ts';
import { createSms019Provider } from '../_shared/messaging/sms-019.ts';
import { createWebhookProvider } from '../_shared/messaging/webhook.ts';
import { createWhatsapp019Provider } from '../_shared/messaging/whatsapp-019.ts';
import type { Channel, Provider, QueuedMessage, SendResult } from '../_shared/messaging/types.ts';
import { secretEquals } from '../_shared/secret-equal.ts';

/* ---------------------------------------------------------------------------
 * Providers. One per channel; adding one is adding an object here.
 * ------------------------------------------------------------------------ */

function resendProvider(): Provider | null {
  const key = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('EMAIL_FROM');
  if (!key || !from) return null;
  return {
    name: 'resend',
    async send(message) {
      if (!message.recipient) return { ok: false, errorCode: 'no_recipient' };
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from,
          to: [message.recipient],
          subject: message.subject ?? '',
          text: message.body,
        }),
      });
      if (!response.ok) return { ok: false, errorCode: `http_${response.status}` };
      const data = (await response.json()) as { id?: string };
      return { ok: true, providerId: data.id };
    },
  };
}

/** SMS through 019, once its three secrets are set. */
function smsProvider(): Provider | null {
  const username = Deno.env.get('SMS_019_USERNAME');
  const token = Deno.env.get('SMS_019_TOKEN');
  const sender = Deno.env.get('SMS_SENDER');
  if (!username || !token || !sender) return null;
  return createSms019Provider({
    username,
    token,
    sender,
    fetch: (input, init) => fetch(input, init),
  });
}

/** WhatsApp through the same 019 token; the line is each clinic's own. */
function whatsappProvider(): Provider | null {
  const token = Deno.env.get('SMS_019_TOKEN');
  if (!token) return null;
  return createWhatsapp019Provider({ token, fetch: (input, init) => fetch(input, init) });
}

/**
 * The practitioner's own Make webhook, for the channels it names (WhatsApp
 * by default): the message is posted there as JSON and a scenario hands it
 * to ManyChat or whatever they use. Where it is set, it takes the channel;
 * 019 keeps the rest.
 */
function makeProvider(): { provider: Provider; channels: Set<Channel> } | null {
  const url = Deno.env.get('MAKE_OUTBOUND_URL')?.trim();
  if (!url) return null;
  const channels = new Set(
    (Deno.env.get('MAKE_OUTBOUND_CHANNELS') ?? 'whatsapp')
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter((value): value is Channel => value === 'whatsapp' || value === 'sms'),
  );
  return {
    provider: createWebhookProvider({
      url,
      secret: Deno.env.get('MAKE_OUTBOUND_SECRET'),
      name: 'make',
      fetch: (input, init) => fetch(input, init),
    }),
    channels,
  };
}

/* ---------------------------------------------------------------------------
 * Phone notifications, through Firebase Cloud Messaging (HTTP v1).
 *
 * One service account serves both apps. Google's token exchange is done here
 * with the platform's own WebCrypto — a signed JWT for an hour's access token
 * — so there is no library to hand the key to. A push row's `recipient` is a
 * user id; the phones are looked up here, and one that the service no longer
 * knows (the app was removed) is dropped so the next hourly run falls back to
 * the clinic's channel on its own.
 * ------------------------------------------------------------------------ */

interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

function base64url(input: string | ArrayBuffer): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : new Uint8Array(input);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function pemToDer(pem: string): ArrayBuffer {
  const body = pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function pushProvider(supabase: SupabaseClient): Provider | null {
  const raw = Deno.env.get('FCM_SERVICE_ACCOUNT_JSON');
  if (!raw) return null;
  let account: ServiceAccount;
  try {
    account = JSON.parse(raw) as ServiceAccount;
  } catch {
    return null;
  }
  if (!account.project_id || !account.client_email || !account.private_key) return null;

  let cached: { token: string; expiresAt: number } | null = null;
  async function accessToken(): Promise<string> {
    if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
    const now = Math.floor(Date.now() / 1000);
    const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const claims = base64url(
      JSON.stringify({
        iss: account.client_email,
        scope: 'https://www.googleapis.com/auth/firebase.messaging',
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600,
      }),
    );
    const key = await crypto.subtle.importKey(
      'pkcs8',
      pemToDer(account.private_key),
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const signature = await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      key,
      new TextEncoder().encode(`${header}.${claims}`),
    );
    const assertion = `${header}.${claims}.${base64url(signature)}`;
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }),
    });
    if (!response.ok) throw new Error(`oauth_${response.status}`);
    const data = (await response.json()) as { access_token: string; expires_in: number };
    cached = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
    return cached.token;
  }

  return {
    name: 'fcm',
    async send(message) {
      if (!message.recipient) return { ok: false, errorCode: 'no_recipient' };
      // A task alert goes to the staff app; everything else to the patient's.
      const app = message.template_key === 'task_alert' ? 'clinic' : 'portal';
      const { data: devices, error } = await supabase
        .from('device_push_tokens')
        .select('id, token')
        .eq('user_id', message.recipient)
        .eq('app', app);
      if (error) return { ok: false, errorCode: 'read_failed' };
      if (!devices || devices.length === 0) return { ok: false, errorCode: 'no_device' };

      let bearer: string;
      try {
        bearer = await accessToken();
      } catch {
        return { ok: false, errorCode: 'auth_failed' };
      }

      let delivered = 0;
      let lastStatus = 0;
      for (const device of devices as { id: string; token: string }[]) {
        const response = await fetch(
          `https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: {
                token: device.token,
                notification: { title: message.subject ?? 'Herbalist', body: message.body },
                data: message.link_url ? { url: message.link_url } : {},
                android: { priority: 'high', notification: { channel_id: 'reminders' } },
                apns: { payload: { aps: { sound: 'default' } } },
              },
            }),
          },
        );
        if (response.ok) {
          delivered += 1;
          continue;
        }
        lastStatus = response.status;
        // A token the service no longer knows is a phone that removed the
        // app: the row goes, and the clinic's channel takes over next hour.
        let gone = response.status === 404 || response.status === 410;
        if (!gone && response.status === 400) {
          const text = await response.text().catch(() => '');
          gone = /UNREGISTERED|not a valid FCM registration token/i.test(text);
        }
        if (gone) await supabase.from('device_push_tokens').delete().eq('id', device.id);
      }
      if (delivered > 0) return { ok: true };
      return { ok: false, errorCode: lastStatus ? `http_${lastStatus}` : 'no_device' };
    },
  };
}

/* ---------------------------------------------------------------------------
 * Who may wake the sender
 * ------------------------------------------------------------------------ */

/** The schedule and the inbound function carry the secret; a signed-in clinic member carries their token. */
async function callerMode(
  request: Request,
  supabase: SupabaseClient,
): Promise<'schedule' | 'member' | null> {
  const secret = Deno.env.get('DISPATCH_SECRET');
  if (secretEquals(request.headers.get('x-dispatch-secret'), secret)) return 'schedule';

  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  if (!bearer) return null;
  const { data, error } = await supabase.auth.getUser(bearer);
  if (error || !data.user) return null;
  const { data: membership } = await supabase
    .from('memberships')
    .select('id')
    .eq('user_id', data.user.id)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();
  return membership ? 'member' : null;
}

/* ---------------------------------------------------------------------------
 * The clinics of a batch: their sandbox mark, their WhatsApp line, their templates
 * ------------------------------------------------------------------------ */

interface ClinicFacts {
  is_synthetic: boolean;
  whatsapp_number: string | null;
}

async function clinicFacts(supabase: SupabaseClient, clinicIds: string[]) {
  const facts = new Map<string, ClinicFacts>();
  if (clinicIds.length === 0) return { facts, templates: buildTemplateMap([]) };
  const [{ data: clinics }, { data: templateRows }] = await Promise.all([
    supabase.from('clinics').select('id, is_synthetic, whatsapp_number').in('id', clinicIds),
    supabase
      .from('clinic_automations')
      .select('clinic_id, kind, whatsapp_template_id')
      .in('clinic_id', clinicIds),
  ]);
  for (const row of (clinics ?? []) as ({ id: string } & ClinicFacts)[]) {
    facts.set(row.id, {
      is_synthetic: row.is_synthetic === true,
      whatsapp_number: row.whatsapp_number,
    });
  }
  const templates = buildTemplateMap(
    (templateRows ?? []) as {
      clinic_id: string;
      kind: string;
      whatsapp_template_id: string | null;
    }[],
  );
  return { facts, templates };
}

/* ---------------------------------------------------------------------------
 * The message log: reminders, alerts, automations
 * ------------------------------------------------------------------------ */

interface QueuedRow {
  id: string;
  clinic_id: string;
  channel: Channel;
  template_key: string;
  recipient: string | null;
  body: string;
  subject: string | null;
  link_url: string | null;
  appointment_id: string | null;
  params: string[] | null;
}

async function sendMessageLog(
  supabase: SupabaseClient,
  providers: Record<Channel, Provider | null>,
) {
  const channels = (Object.keys(providers) as Channel[]).filter((channel) => providers[channel]);
  const counts = { sent: 0, failed: 0, skipped: 0 };
  if (channels.length === 0) return counts;

  // Claimed, not read: one statement moves the rows from queued to sending and
  // returns only the ones this run took, so two runs that overlap (or a retry
  // of this one) can never send the same message. A run that dies after
  // claiming leaves its rows in `sending`; the next claim marks them stalled
  // for a person, because they may already have gone out (migration
  // 20260919090000).
  const { data, error } = await supabase.rpc('claim_queued_messages', {
    p_channels: channels,
    p_worker: `dispatch-${crypto.randomUUID()}`,
    p_limit: 100,
  });
  if (error) throw new Error('claim_failed');

  const rows = (data ?? []) as QueuedRow[];
  const { facts, templates } = await clinicFacts(supabase, [
    ...new Set(rows.map((row) => row.clinic_id)),
  ]);

  for (const row of rows) {
    const clinic = facts.get(row.clinic_id);
    const message: QueuedMessage = {
      ...row,
      params: Array.isArray(row.params) ? row.params.map(String) : null,
      whatsappTemplateId: templateIdFor(templates, row.clinic_id, row.template_key),
      whatsappSource: clinic?.whatsapp_number ?? null,
      clinicSynthetic: clinic?.is_synthetic === true,
    };

    const reason = skipReason(message);
    if (reason) {
      await supabase
        .from('message_log')
        .update({ status: 'skipped', error_code: reason })
        .eq('id', message.id);
      counts.skipped += 1;
      continue;
    }

    const provider = providers[message.channel]!;
    let result: SendResult;
    try {
      result = await provider.send(message);
    } catch {
      result = { ok: false, errorCode: 'provider_error' };
    }

    if (result.ok) {
      // The same function the app uses for a manual send, so the appointment's
      // own mark is set in the same statement.
      await supabase.rpc('mark_message_sent', { p_id: message.id, p_provider: provider.name });
      if (result.providerId) {
        await supabase
          .from('message_log')
          .update({ provider_message_id: result.providerId })
          .eq('id', message.id);
      }
      counts.sent += 1;
    } else {
      await supabase
        .from('message_log')
        .update({
          status: 'failed',
          provider: provider.name,
          error_code: result.errorCode ?? 'failed',
        })
        .eq('id', message.id);
      counts.failed += 1;
    }

    // What the clinic said on WhatsApp belongs in the thread, whoever wrote it.
    if (message.channel === 'whatsapp' && message.template_key !== 'test_message') {
      await supabase.rpc('whatsapp_note_outbound', {
        p_clinic: message.clinic_id,
        p_phone: message.recipient,
        p_kind: message.whatsappTemplateId ? 'template' : 'text',
        p_body: message.body,
        p_template_id: message.whatsappTemplateId ?? null,
        p_params: message.params,
        p_provider_id: result.providerId ?? null,
        p_status: result.ok ? 'sent' : 'failed',
        p_error: result.ok ? null : (result.errorCode ?? 'failed'),
      });
    }
  }
  return counts;
}

/* ---------------------------------------------------------------------------
 * The WhatsApp threads: what staff wrote, and the line that answers a tap
 * ------------------------------------------------------------------------ */

interface ChatRow {
  id: string;
  clinic_id: string;
  conversation_id: string;
  body: string | null;
  template_id: string | null;
  params: string[] | null;
}

async function sendChats(supabase: SupabaseClient, provider: Provider | null) {
  const counts = { sent: 0, failed: 0 };
  const { data, error } = await supabase.rpc('whatsapp_claim_outbound', { p_limit: 50 });
  if (error) throw new Error('claim_failed');
  const rows = (data ?? []) as ChatRow[];
  if (rows.length === 0) return counts;

  const fail = async (id: string, code: string) => {
    await supabase
      .from('whatsapp_messages')
      .update({ status: 'failed', error_code: code })
      .eq('id', id);
    counts.failed += 1;
  };

  if (!provider) {
    // No token yet: the rows go back to waiting rather than failing, so the
    // thread shows them as not sent and they go once the service is connected.
    await supabase
      .from('whatsapp_messages')
      .update({ status: 'queued', claimed_at: null })
      .in(
        'id',
        rows.map((row) => row.id),
      );
    return counts;
  }

  const { data: conversations } = await supabase
    .from('whatsapp_conversations')
    .select('id, contact_key')
    .in('id', [...new Set(rows.map((row) => row.conversation_id))]);
  const contacts = new Map(
    (conversations ?? []).map((row: { id: string; contact_key: string }) => [
      row.id,
      row.contact_key,
    ]),
  );
  const { facts } = await clinicFacts(supabase, [...new Set(rows.map((row) => row.clinic_id))]);

  for (const row of rows) {
    const clinic = facts.get(row.clinic_id);
    const message: QueuedMessage = {
      id: row.id,
      clinic_id: row.clinic_id,
      channel: 'whatsapp',
      template_key: row.template_id ? 'chat_template' : 'chat',
      recipient: contacts.get(row.conversation_id) ?? null,
      body: row.body ?? '',
      subject: null,
      link_url: null,
      appointment_id: null,
      params: Array.isArray(row.params) ? row.params.map(String) : null,
      whatsappTemplateId: row.template_id,
      whatsappSource: clinic?.whatsapp_number ?? null,
      clinicSynthetic: clinic?.is_synthetic === true,
    };

    const reason = skipReason(message);
    if (reason) {
      await fail(row.id, reason);
      continue;
    }

    let result: SendResult;
    try {
      result = await provider.send(message);
    } catch {
      result = { ok: false, errorCode: 'provider_error' };
    }
    if (result.ok) {
      await supabase
        .from('whatsapp_messages')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          provider_message_id: result.providerId ?? null,
          error_code: null,
        })
        .eq('id', row.id);
      counts.sent += 1;
    } else {
      await fail(row.id, result.errorCode ?? 'failed');
    }
  }
  return counts;
}

/* ---------------------------------------------------------------------------
 * The run
 * ------------------------------------------------------------------------ */

Deno.serve(async (request) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  const mode = await callerMode(request, supabase);
  if (!mode) return new Response('Forbidden', { status: 403 });

  let only: string | null = null;
  try {
    const body = (await request.json()) as { only?: string } | null;
    only = body?.only ?? null;
  } catch {
    // An empty body is the schedule's.
  }

  const make = makeProvider();
  const providers: Record<Channel, Provider | null> = {
    email: resendProvider(),
    sms: make?.channels.has('sms') ? make.provider : smsProvider(),
    whatsapp: make?.channels.has('whatsapp') ? make.provider : whatsappProvider(),
    push: pushProvider(supabase),
  };

  try {
    // A waking by a member or by the inbound function sends the threads
    // only: the log's queue is the schedule's, so two runs never overlap on it.
    const chats = await sendChats(supabase, providers.whatsapp);
    if (mode === 'member' || only === 'whatsapp') {
      return Response.json({ chats });
    }
    const log = await sendMessageLog(supabase, providers);
    return Response.json({ ...log, chats });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'failed' },
      { status: 500 },
    );
  }
});
