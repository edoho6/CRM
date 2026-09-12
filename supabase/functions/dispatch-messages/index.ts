// The sender.
//
// Runs inside Supabase (Edge Functions), on a schedule, and works through the
// queue in `message_log`: every row still `queued` whose channel has a
// provider connected is handed to that provider and marked `sent` or
// `failed`. A channel with no provider is left alone — the row stays queued,
// and the Messages screen offers it to a person to send by hand.
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
//   SMS_PROVIDER              — none yet; the adapter below is the seam
//
// Nothing about a patient is logged here. A failed send records a short
// error code on the row and nothing else.

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

type Channel = 'sms' | 'whatsapp' | 'email' | 'push';

interface QueuedMessage {
  id: string;
  channel: Channel;
  template_key: string;
  recipient: string | null;
  body: string;
  subject: string | null;
  link_url: string | null;
  appointment_id: string | null;
}

interface SendResult {
  ok: boolean;
  providerId?: string;
  errorCode?: string;
}

interface Provider {
  name: string;
  send(message: QueuedMessage): Promise<SendResult>;
}

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

/**
 * SMS and WhatsApp: no provider is connected yet. When one is chosen, this is
 * the only place that changes — return an object like the email one above,
 * keyed on the provider's environment variables.
 */
function smsProvider(): Provider | null {
  return null;
}

function whatsappProvider(): Provider | null {
  return null;
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
    const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${header}.${claims}`));
    const assertion = `${header}.${claims}.${base64url(signature)}`;
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
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
 * The run
 * ------------------------------------------------------------------------ */

Deno.serve(async (request) => {
  const secret = Deno.env.get('DISPATCH_SECRET');
  if (!secret || request.headers.get('x-dispatch-secret') !== secret) {
    return new Response('Forbidden', { status: 403 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  const providers: Record<Channel, Provider | null> = {
    email: resendProvider(),
    sms: smsProvider(),
    whatsapp: whatsappProvider(),
    push: pushProvider(supabase),
  };
  const channels = (Object.keys(providers) as Channel[]).filter((channel) => providers[channel]);
  if (channels.length === 0) {
    return Response.json({ sent: 0, failed: 0, note: 'no provider connected' });
  }

  const { data, error } = await supabase
    .from('message_log')
    .select('id, channel, template_key, recipient, body, subject, link_url, appointment_id')
    .eq('status', 'queued')
    .in('channel', channels)
    .order('created_at', { ascending: true })
    .limit(100);
  if (error) return Response.json({ error: 'read_failed' }, { status: 500 });

  let sent = 0;
  let failed = 0;
  for (const message of (data ?? []) as QueuedMessage[]) {
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
      sent += 1;
    } else {
      await supabase
        .from('message_log')
        .update({ status: 'failed', provider: provider.name, error_code: result.errorCode ?? 'failed' })
        .eq('id', message.id);
      failed += 1;
    }
  }

  return Response.json({ sent, failed });
});
