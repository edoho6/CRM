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
//   DISPATCH_SECRET   — the schedule must send it as `x-dispatch-secret`
//   RESEND_API_KEY    — enables email, via resend.com
//   EMAIL_FROM        — e.g. "Herbalist <reminders@your-domain>"
//   SMS_PROVIDER      — none yet; the adapter below is the seam
//
// Nothing about a patient is logged here. A failed send records a short
// error code on the row and nothing else.

import { createClient } from 'npm:@supabase/supabase-js@2';

type Channel = 'sms' | 'whatsapp' | 'email';

interface QueuedMessage {
  id: string;
  channel: Channel;
  recipient: string | null;
  body: string;
  subject: string | null;
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
  };
  const channels = (Object.keys(providers) as Channel[]).filter((channel) => providers[channel]);
  if (channels.length === 0) {
    return Response.json({ sent: 0, failed: 0, note: 'no provider connected' });
  }

  const { data, error } = await supabase
    .from('message_log')
    .select('id, channel, recipient, body, subject, appointment_id')
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
